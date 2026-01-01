import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role, AccountStatus } from '@/generated/prisma/enums';
import { auditUpdate, auditDelete, toAuditUser } from '@/lib/audit';
import { sendWelcomeEmail, sendApplicationRejectedEmail } from '@/lib/email';
import { getCurrentOrgId } from '@/lib/org-context';

// PATCH /api/volunteers/[id] - Update a volunteer
// - ADMINISTRATOR, DEVELOPER: Can update all fields
// - COORDINATOR: Can update qualifiedRoleIds, zoneIds, and approve/reject applications
// - DISPATCHER: Can only update qualifiedRoleIds
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasFullAccess = ['ADMINISTRATOR', 'DEVELOPER'].includes(user.role);
    const isCoordinator = user.role === 'COORDINATOR';
    const canEditQualifications = ['ADMINISTRATOR', 'COORDINATOR', 'DISPATCHER', 'DEVELOPER'].includes(user.role);

    // Must be admin, coordinator, or dispatcher
    if (!canEditQualifications) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const body = await request.json();

    // Non-admins have limited fields they can update
    if (!hasFullAccess) {
      // Coordinators can approve/reject applications, manage qualifications/zones, and edit notes
      // Dispatchers can only update qualifications
      const allowedFields = isCoordinator
        ? ['qualifiedRoleIds', 'zoneIds', 'action', 'role', 'rejectionReason', 'notes']
        : ['qualifiedRoleIds'];
      const providedFields = Object.keys(body);
      const disallowedFields = providedFields.filter(f => !allowedFields.includes(f));
      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: `Only administrators or developers can update: ${disallowedFields.join(', ')}` },
          { status: 403 }
        );
      }
    }

    // Find the volunteer (scoped to current org via OrganizationMember)
    const volunteer = await prisma.user.findFirst({
      where: {
        id,
        // Multi-tenant: verify user is a member of current org
        memberships: orgId ? {
          some: {
            organizationId: orgId,
          },
        } : { none: {} },
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    // Handle approval/rejection actions
    if (body.action === 'approve' || body.action === 'reject') {
      // Only admins and coordinators can approve/reject applications
      if (!['ADMINISTRATOR', 'COORDINATOR', 'DEVELOPER'].includes(user.role)) {
        return NextResponse.json(
          { error: 'Only administrators and coordinators can approve or reject applications' },
          { status: 403 }
        );
      }

      // Must be a PENDING user
      if (volunteer.accountStatus !== 'PENDING') {
        return NextResponse.json(
          { error: 'Can only approve or reject pending applications' },
          { status: 400 }
        );
      }

      if (body.action === 'approve') {
        // Update user to APPROVED with role and qualifications
        const roleToSet = (body.role || 'VOLUNTEER') as Role;
        const qualifiedRoleIds = body.qualifiedRoleIds || [];
        const zoneIds = body.zoneIds || [];

        // Remove existing qualifications and add new ones
        await prisma.userQualification.deleteMany({
          where: { userId: id },
        });

        for (const qualifiedRoleId of qualifiedRoleIds) {
          await prisma.userQualification.create({
            data: {
              userId: id,
              qualifiedRoleId,
              grantedById: user.id,
            },
          });
        }

        // Update zones if provided
        if (zoneIds.length > 0) {
          await prisma.userZone.deleteMany({
            where: { userId: id },
          });

          for (let i = 0; i < zoneIds.length; i++) {
            await prisma.userZone.create({
              data: {
                userId: id,
                zoneId: zoneIds[i],
                isPrimary: i === 0,
              },
            });
          }
        }

        const updated = await prisma.user.update({
          where: { id },
          data: {
            accountStatus: 'APPROVED' as AccountStatus,
            role: roleToSet,
            approvedById: user.id,
            approvedAt: new Date(),
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            accountStatus: true,
          },
        });

        // Also update OrganizationMember if it exists (new multi-org system)
        if (orgId) {
          await prisma.organizationMember.updateMany({
            where: {
              userId: id,
              organizationId: orgId,
            },
            data: {
              accountStatus: 'APPROVED',
              role: roleToSet,
              approvedById: user.id,
              approvedAt: new Date(),
              isActive: true,
            },
          });
        }

        // Audit log the approval
        await auditUpdate(
          toAuditUser(user),
          'User',
          updated.id,
          { accountStatus: 'PENDING', role: volunteer.role },
          { accountStatus: 'APPROVED', role: updated.role }
        );

        // Send welcome email
        try {
          await sendWelcomeEmail({
            email: updated.email,
            name: updated.name,
            role: updated.role,
            orgId: orgId || undefined, // Multi-tenant: Use org-specific branding
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the request if email fails
        }

        return NextResponse.json({
          success: true,
          message: 'Application approved',
          volunteer: updated,
        });
      } else if (body.action === 'reject') {
        const rejectionReason = body.rejectionReason || null;

        const updated = await prisma.user.update({
          where: { id },
          data: {
            accountStatus: 'REJECTED' as AccountStatus,
            rejectionReason,
          },
          select: {
            id: true,
            name: true,
            email: true,
            accountStatus: true,
            rejectionReason: true,
          },
        });

        // Also update OrganizationMember if it exists (new multi-org system)
        if (orgId) {
          await prisma.organizationMember.updateMany({
            where: {
              userId: id,
              organizationId: orgId,
            },
            data: {
              accountStatus: 'REJECTED',
              rejectionReason,
            },
          });
        }

        // Audit log the rejection
        await auditUpdate(
          toAuditUser(user),
          'User',
          updated.id,
          { accountStatus: 'PENDING' },
          { accountStatus: 'REJECTED', rejectionReason }
        );

        // Send rejection email
        try {
          await sendApplicationRejectedEmail({
            email: updated.email,
            name: updated.name,
            rejectionReason,
            orgId: orgId || undefined, // Multi-tenant: Use org-specific branding
          });
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
          // Don't fail the request if email fails
        }

        return NextResponse.json({
          success: true,
          message: 'Application rejected',
          volunteer: updated,
        });
      }
    }

    // Prevent admin from demoting themselves
    if (id === user.id && body.role && !hasFullAccess) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Build update data for User model
    const updateData: {
      isVerified?: boolean;
      name?: string;
      email?: string;
      phone?: string | null;
      signalHandle?: string | null;
      primaryLanguage?: string;
      otherLanguages?: string[];
      notes?: string | null;
    } = {};

    // Build update data for OrganizationMember (per-org fields)
    const membershipUpdateData: {
      role?: Role;
      isActive?: boolean;
    } = {};

    if (body.role !== undefined) {
      const validRoles = ['VOLUNTEER', 'COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      membershipUpdateData.role = body.role as Role;
    }

    if (body.isActive !== undefined) {
      membershipUpdateData.isActive = body.isActive;
    }

    if (body.isVerified !== undefined) {
      updateData.isVerified = body.isVerified;
    }

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: body.email,
          id: { not: id },
        },
      });
      if (existingUser) {
        return NextResponse.json({ error: 'Email is already in use by another user' }, { status: 400 });
      }
      updateData.email = body.email;
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone || null;
    }

    if (body.signalHandle !== undefined) {
      updateData.signalHandle = body.signalHandle || null;
    }

    if (body.primaryLanguage !== undefined) {
      updateData.primaryLanguage = body.primaryLanguage;
    }

    if (body.otherLanguages !== undefined) {
      updateData.otherLanguages = body.otherLanguages;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    // Handle zones update
    if (body.zoneIds !== undefined) {
      if (!Array.isArray(body.zoneIds)) {
        return NextResponse.json({ error: 'zoneIds must be an array' }, { status: 400 });
      }

      // Validate that all zone IDs exist and belong to current org
      if (body.zoneIds.length > 0) {
        const existingZones = await prisma.zone.findMany({
          where: {
            id: { in: body.zoneIds },
            isActive: true,
            // Security: Only allow zones from current org
            ...(orgId ? { organizationId: orgId } : {}),
          },
          select: { id: true },
        });
        const existingIds = new Set(existingZones.map(z => z.id));
        const invalidIds = body.zoneIds.filter((zId: string) => !existingIds.has(zId));
        if (invalidIds.length > 0) {
          return NextResponse.json({ error: 'Invalid or unauthorized zone IDs' }, { status: 400 });
        }
      }

      // Remove existing zone assignments
      await prisma.userZone.deleteMany({
        where: { userId: id },
      });

      // Add new zone assignments (first one is primary)
      for (let i = 0; i < body.zoneIds.length; i++) {
        await prisma.userZone.create({
          data: {
            userId: id,
            zoneId: body.zoneIds[i],
            isPrimary: i === 0,
          },
        });
      }
    }

    // Handle qualified roles update
    if (body.qualifiedRoleIds !== undefined) {
      if (!Array.isArray(body.qualifiedRoleIds)) {
        return NextResponse.json({ error: 'qualifiedRoleIds must be an array' }, { status: 400 });
      }

      // Validate that all IDs exist and belong to current org
      if (body.qualifiedRoleIds.length > 0) {
        const existingRoles = await prisma.qualifiedRole.findMany({
          where: {
            id: { in: body.qualifiedRoleIds },
            isActive: true,
            // Security: Only allow qualified roles from current org
            ...(orgId ? { organizationId: orgId } : {}),
          },
          select: { id: true },
        });
        const existingIds = new Set(existingRoles.map(r => r.id));
        const invalidIds = body.qualifiedRoleIds.filter((roleId: string) => !existingIds.has(roleId));
        if (invalidIds.length > 0) {
          return NextResponse.json({ error: 'Invalid or unauthorized qualified role IDs' }, { status: 400 });
        }
      }

      // Remove existing qualified role assignments
      await prisma.userQualification.deleteMany({
        where: { userId: id },
      });

      // Add new qualified role assignments
      for (const qualifiedRoleId of body.qualifiedRoleIds) {
        await prisma.userQualification.create({
          data: {
            userId: id,
            qualifiedRoleId,
            grantedById: user.id,
          },
        });
      }
    }

    // Update membership (per-org role and isActive) if any membership fields changed
    let updatedMembership = null;
    if (Object.keys(membershipUpdateData).length > 0 && orgId) {
      updatedMembership = await prisma.organizationMember.updateMany({
        where: {
          userId: id,
          organizationId: orgId,
        },
        data: membershipUpdateData,
      });
    }

    // Update the volunteer
    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        signalHandle: true,
        primaryLanguage: true,
        otherLanguages: true,
        notes: true,
        isVerified: true,
        userQualifications: {
          select: {
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
        // Include membership for current org to get per-org role and isActive
        memberships: orgId ? {
          where: { organizationId: orgId },
          select: {
            role: true,
            isActive: true,
          },
        } : false,
      },
    });

    // Get per-org role and isActive from membership
    const membership = updated.memberships && updated.memberships[0];

    // Audit log the volunteer update
    await auditUpdate(
      toAuditUser(user),
      'User',
      updated.id,
      volunteer as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );

    return NextResponse.json({
      ...updated,
      // Use per-org fields from membership
      role: membership?.role ?? 'VOLUNTEER',
      isActive: membership?.isActive ?? true,
      qualifiedRoles: updated.userQualifications.map(uq => uq.qualifiedRole),
    });
  } catch (error) {
    console.error('Error updating volunteer:', error);
    return NextResponse.json({ error: 'Failed to update volunteer' }, { status: 500 });
  }
}

// GET /api/volunteers/[id] - Get a single volunteer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Coordinators, dispatchers, and admins can view volunteer details
    if (!['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();

    const volunteer = await prisma.user.findFirst({
      where: {
        id,
        // Multi-tenant: verify volunteer is a member of current org
        memberships: orgId ? {
          some: {
            organizationId: orgId,
          },
        } : { none: {} },
      },
      include: {
        zones: {
          include: {
            zone: {
              select: {
                id: true,
                name: true,
                county: true,
              },
            },
          },
        },
        userQualifications: {
          // Only include qualifications for roles belonging to current org
          where: orgId ? {
            qualifiedRole: {
              organizationId: orgId,
            },
          } : {},
          include: {
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
        trainingAttendances: {
          where: {
            status: 'CONFIRMED',
          },
          include: {
            session: {
              include: {
                trainingType: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        shiftVolunteers: {
          include: {
            shift: {
              select: {
                id: true,
                title: true,
                date: true,
                type: true,
                zone: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            shift: {
              date: 'desc',
            },
          },
        },
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: volunteer.id,
      name: volunteer.name,
      email: volunteer.email,
      phone: volunteer.phone,
      signalHandle: volunteer.signalHandle,
      role: volunteer.role,
      primaryLanguage: volunteer.primaryLanguage,
      otherLanguages: volunteer.otherLanguages,
      isActive: volunteer.isActive,
      isVerified: volunteer.isVerified,
      createdAt: volunteer.createdAt,
      zones: volunteer.zones.map(uz => ({
        id: uz.zone.id,
        name: uz.zone.name,
        county: uz.zone.county,
        isPrimary: uz.isPrimary,
      })),
      qualifiedRoles: volunteer.userQualifications.map(uq => uq.qualifiedRole),
      completedTrainings: volunteer.trainingAttendances.map(ta => ({
        id: ta.session.trainingType.id,
        name: ta.session.trainingType.name,
        slug: ta.session.trainingType.slug,
        completedAt: ta.confirmedAt,
      })),
      shifts: volunteer.shiftVolunteers.map(sv => ({
        id: sv.shift.id,
        title: sv.shift.title,
        date: sv.shift.date,
        type: sv.shift.type,
        zone: sv.shift.zone?.name || null,
        status: sv.status,
        isZoneLead: sv.isZoneLead,
      })),
    });
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    return NextResponse.json({ error: 'Failed to fetch volunteer' }, { status: 500 });
  }
}

// DELETE /api/volunteers/[id] - Delete a volunteer (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can delete volunteers
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();

    // Prevent admin from deleting themselves
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if volunteer exists and is a member of current org
    const volunteer = await prisma.user.findFirst({
      where: {
        id,
        // Multi-tenant: verify user is a member of current org
        memberships: orgId ? {
          some: {
            organizationId: orgId,
          },
        } : { none: {} },
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    // Delete related records first (cascade doesn't work with all relations)
    // Delete zone memberships
    await prisma.userZone.deleteMany({
      where: { userId: id },
    });

    // Delete qualified role assignments
    await prisma.userQualification.deleteMany({
      where: { userId: id },
    });

    // Delete shift assignments
    await prisma.shiftVolunteer.deleteMany({
      where: { userId: id },
    });

    // Delete training session attendances
    await prisma.trainingSessionAttendee.deleteMany({
      where: { userId: id },
    });

    // Delete email blast recipients (no cascade on this relation)
    await prisma.emailBlastRecipient.deleteMany({
      where: { userId: id },
    });

    // Delete organization memberships
    await prisma.organizationMember.deleteMany({
      where: { userId: id },
    });

    // Delete coverage signups
    await prisma.coverageSignup.deleteMany({
      where: { userId: id },
    });

    // Delete dispatcher assignments
    await prisma.dispatcherAssignment.deleteMany({
      where: { userId: id },
    });

    // Delete regional lead assignments
    await prisma.regionalLeadAssignment.deleteMany({
      where: { userId: id },
    });

    // Delete module enrollments (and cascades to section progress)
    await prisma.moduleEnrollment.deleteMany({
      where: { userId: id },
    });

    // Delete user trainings
    await prisma.userTraining.deleteMany({
      where: { userId: id },
    });

    // Delete availability records
    await prisma.availability.deleteMany({
      where: { userId: id },
    });

    // Clear references where this user approved other users
    await prisma.user.updateMany({
      where: { approvedById: id },
      data: { approvedById: null },
    });

    // Clear references where this user approved org memberships
    await prisma.organizationMember.updateMany({
      where: { approvedById: id },
      data: { approvedById: null },
    });

    // Clear references where this user created regional lead assignments
    await prisma.regionalLeadAssignment.updateMany({
      where: { createdById: id },
      data: { createdById: null },
    });

    // Delete coverage overrides created by this user (createdById is required)
    await prisma.coverageOverride.deleteMany({
      where: { createdById: id },
    });

    // Delete POIs created by this user (createdById is required)
    await prisma.pointOfInterest.deleteMany({
      where: { createdById: id },
    });

    // Delete email blasts sent by this user (sentById is required)
    // First delete the recipients, then the blast
    const blasts = await prisma.emailBlast.findMany({
      where: { sentById: id },
      select: { id: true },
    });
    if (blasts.length > 0) {
      await prisma.emailBlastRecipient.deleteMany({
        where: { blastId: { in: blasts.map(b => b.id) } },
      });
      await prisma.emailBlast.deleteMany({
        where: { sentById: id },
      });
    }

    // Delete training sessions created by this user (createdById is required)
    // First delete attendees, then the sessions
    const sessions = await prisma.trainingSession.findMany({
      where: { createdById: id },
      select: { id: true },
    });
    if (sessions.length > 0) {
      await prisma.trainingSessionAttendee.deleteMany({
        where: { sessionId: { in: sessions.map(s => s.id) } },
      });
      await prisma.trainingSession.deleteMany({
        where: { createdById: id },
      });
    }

    // Delete shifts created by this user (createdById is required)
    // First delete volunteers, then the shifts
    const shifts = await prisma.shift.findMany({
      where: { createdById: id },
      select: { id: true },
    });
    if (shifts.length > 0) {
      await prisma.shiftVolunteer.deleteMany({
        where: { shiftId: { in: shifts.map(s => s.id) } },
      });
      await prisma.shift.deleteMany({
        where: { createdById: id },
      });
    }

    // Clear invite request reviews
    await prisma.inviteRequest.updateMany({
      where: { reviewedById: id },
      data: { reviewedById: null },
    });

    // Finally delete the user
    await prisma.user.delete({
      where: { id },
    });

    // Audit log the deletion
    await auditDelete(
      toAuditUser(user),
      'User',
      id,
      volunteer as unknown as Record<string, unknown>
    );

    return NextResponse.json({ success: true, message: 'Volunteer deleted' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    return NextResponse.json({ error: 'Failed to delete volunteer' }, { status: 500 });
  }
}
