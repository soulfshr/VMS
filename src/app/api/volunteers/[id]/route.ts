import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role } from '@/generated/prisma/enums';

// PATCH /api/volunteers/[id] - Update a volunteer
// - ADMINISTRATOR: Can update all fields
// - COORDINATOR, DISPATCHER: Can only update qualifiedRoleIds
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.role === 'ADMINISTRATOR';
    const canEditQualifications = ['ADMINISTRATOR', 'COORDINATOR', 'DISPATCHER'].includes(user.role);

    // Must be admin, coordinator, or dispatcher
    if (!canEditQualifications) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Non-admins can only update qualifiedRoleIds
    if (!isAdmin) {
      const allowedFields = ['qualifiedRoleIds'];
      const providedFields = Object.keys(body);
      const disallowedFields = providedFields.filter(f => !allowedFields.includes(f));
      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: `Only administrators can update: ${disallowedFields.join(', ')}` },
          { status: 403 }
        );
      }
    }

    // Find the volunteer
    const volunteer = await prisma.user.findUnique({
      where: { id },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    // Prevent admin from demoting themselves
    if (id === user.id && body.role && body.role !== 'ADMINISTRATOR') {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      role?: Role;
      isActive?: boolean;
      isVerified?: boolean;
      name?: string;
      email?: string;
      phone?: string | null;
      signalHandle?: string | null;
      primaryLanguage?: string;
      otherLanguages?: string[];
    } = {};

    if (body.role !== undefined) {
      const validRoles = ['VOLUNTEER', 'COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData.role = body.role as Role;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
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

    // Handle zones update
    if (body.zoneIds !== undefined) {
      if (!Array.isArray(body.zoneIds)) {
        return NextResponse.json({ error: 'zoneIds must be an array' }, { status: 400 });
      }

      // Validate that all zone IDs exist
      if (body.zoneIds.length > 0) {
        const existingZones = await prisma.zone.findMany({
          where: { id: { in: body.zoneIds }, isActive: true },
          select: { id: true },
        });
        const existingIds = new Set(existingZones.map(z => z.id));
        const invalidIds = body.zoneIds.filter((zId: string) => !existingIds.has(zId));
        if (invalidIds.length > 0) {
          return NextResponse.json({ error: `Invalid zone IDs: ${invalidIds.join(', ')}` }, { status: 400 });
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

      // Validate that all IDs exist
      if (body.qualifiedRoleIds.length > 0) {
        const existingRoles = await prisma.qualifiedRole.findMany({
          where: { id: { in: body.qualifiedRoleIds }, isActive: true },
          select: { id: true },
        });
        const existingIds = new Set(existingRoles.map(r => r.id));
        const invalidIds = body.qualifiedRoleIds.filter((id: string) => !existingIds.has(id));
        if (invalidIds.length > 0) {
          return NextResponse.json({ error: `Invalid qualified role IDs: ${invalidIds.join(', ')}` }, { status: 400 });
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
        role: true,
        primaryLanguage: true,
        otherLanguages: true,
        isActive: true,
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
      },
    });

    return NextResponse.json({
      ...updated,
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

    const volunteer = await prisma.user.findUnique({
      where: { id },
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
        zone: sv.shift.zone.name,
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

    // Prevent admin from deleting themselves
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if volunteer exists
    const volunteer = await prisma.user.findUnique({
      where: { id },
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

    // Finally delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Volunteer deleted' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    return NextResponse.json({ error: 'Failed to delete volunteer' }, { status: 500 });
  }
}
