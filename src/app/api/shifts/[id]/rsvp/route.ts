import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { RSVPStatus, Qualification } from '@/generated/prisma/enums';
import {
  sendShiftSignupEmail,
  sendShiftConfirmationEmail,
  sendShiftCancellationEmail,
} from '@/lib/email';
import { auditCreate, auditUpdate, auditDelete, toAuditUser } from '@/lib/audit';
import { getCurrentOrgId } from '@/lib/org-context';
import { hasLeadQualification } from '@/lib/role-utils';

// POST /api/shifts/[id]/rsvp - RSVP to a shift
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: shiftId } = await params;

    // Parse optional parameters from body
    let qualification: Qualification | null = null;
    let qualifiedRoleId: string | null = null;
    let asZoneLead = false;
    try {
      const body = await request.json();
      if (body.qualification && Object.values(Qualification).includes(body.qualification)) {
        qualification = body.qualification as Qualification;
      }
      if (body.qualifiedRoleId) {
        qualifiedRoleId = body.qualifiedRoleId;
      }
      if (body.asZoneLead === true) {
        asZoneLead = true;
      }
    } catch {
      // No body or invalid JSON is fine - parameters are optional
    }

    const orgIdForQual = await getCurrentOrgId();

    // Get user's qualifications for validation
    const userQualifications = await prisma.userQualification.findMany({
      where: {
        userId: user.id,
        // Multi-org: Only check qualifications from current org's qualified roles
        qualifiedRole: orgIdForQual ? { organizationId: orgIdForQual } : {},
      },
      include: { qualifiedRole: { select: { id: true, slug: true } } },
    });

    // If signing up for a specific role, verify user has that qualification
    if (qualifiedRoleId) {
      const hasQualification = userQualifications.some(
        uq => uq.qualifiedRole.id === qualifiedRoleId
      );
      if (!hasQualification) {
        return NextResponse.json(
          { error: 'You are not qualified for this role' },
          { status: 403 }
        );
      }
    }

    // If requesting lead assignment, verify user has a lead qualification in current org
    // Different orgs may use different slugs for their lead role (ZONE_LEAD, SHIFT_LEAD, etc.)
    if (asZoneLead) {
      // Accept any lead-type qualification using pattern-based detection
      const qualificationSlugs = userQualifications.map(uq => uq.qualifiedRole.slug);
      const hasLeadQual = hasLeadQualification(qualificationSlugs);

      if (!hasLeadQual) {
        return NextResponse.json(
          { error: 'You are not qualified as a shift lead' },
          { status: 403 }
        );
      }
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Check if shift exists, is published, and belongs to current org
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        // Multi-org: Verify shift belongs to current org
        ...orgFilter,
      },
      include: {
        volunteers: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    if (shift.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Shift is not open for signups' },
        { status: 400 }
      );
    }

    // NOTE: Duplicate check moved inside transaction to prevent race condition
    // The check below ensures atomicity with capacity check

    // Check organization settings for auto-confirm (scoped to org)
    const orgSettings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
    const autoConfirm = orgSettings?.autoConfirmRsvp ?? true; // Default to auto-confirm ON

    // Use transaction to prevent race condition on capacity AND duplicate check
    // This ensures atomic check-and-create to prevent overselling and duplicate RSVPs
    const rsvp = await prisma.$transaction(async (tx) => {
      // Re-fetch shift with lock to get accurate count and check for existing RSVP
      const currentShift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: {
          volunteers: {
            select: { id: true, userId: true, status: true },
          },
        },
      });

      if (!currentShift) {
        throw new Error('SHIFT_NOT_FOUND');
      }

      // Check for existing RSVP (inside transaction to prevent race condition)
      const existingRsvp = currentShift.volunteers.find(v => v.userId === user.id);
      if (existingRsvp) {
        throw new Error('ALREADY_RSVPED');
      }

      // Check if shift is full (inside transaction for accuracy)
      const confirmedCount = currentShift.volunteers.filter(v => v.status === 'CONFIRMED').length;
      if (confirmedCount >= currentShift.maxVolunteers) {
        throw new Error('SHIFT_FULL');
      }

      // Create RSVP with status based on auto-confirm setting
      return tx.shiftVolunteer.create({
        data: {
          shiftId,
          userId: user.id,
          status: autoConfirm ? 'CONFIRMED' : 'PENDING',
          confirmedAt: autoConfirm ? new Date() : null,
          qualification,
          qualifiedRoleId, // Link to the specific role if provided
          isZoneLead: asZoneLead,
        },
        include: {
          shift: {
            include: {
              zone: true,
              typeConfig: { select: { name: true } },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }).catch((err) => {
      if (err.message === 'SHIFT_NOT_FOUND') {
        return { error: 'Shift not found', status: 404 };
      }
      if (err.message === 'ALREADY_RSVPED') {
        return { error: 'You have already signed up for this shift', status: 400 };
      }
      if (err.message === 'SHIFT_FULL') {
        return { error: 'This shift is full', status: 400 };
      }
      throw err;
    });

    // Handle transaction errors
    if ('error' in rsvp) {
      return NextResponse.json({ error: rsvp.error }, { status: rsvp.status });
    }

    // Audit log the RSVP creation
    await auditCreate(
      toAuditUser(user),
      'ShiftVolunteer',
      rsvp.id,
      {
        shiftId,
        shiftTitle: rsvp.shift.title,
        status: rsvp.status,
        qualification: rsvp.qualification,
        isZoneLead: rsvp.isZoneLead,
      }
    );

    // Send appropriate email based on auto-confirm setting
    // Use try/catch with await to ensure email completes before serverless function terminates
    try {
      // Get shift type display name (prefer typeConfig, fallback to legacy type)
      const shiftType = rsvp.shift.typeConfig?.name || rsvp.shift.type?.replace(/_/g, ' ') || 'Shift';

      if (autoConfirm) {
        // Send confirmation email with calendar invite
        await sendShiftConfirmationEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone?.name || '',
          description: rsvp.shift.description || undefined,
          orgId: orgId || undefined, // Multi-tenant: Use org-specific branding
        });
      } else {
        // Send signup confirmation email (pending status)
        await sendShiftSignupEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone?.name || '',
          orgId: orgId || undefined, // Multi-tenant: Use org-specific branding
        });
      }
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      // Don't fail the RSVP if email fails
    }

    return NextResponse.json(rsvp, { status: 201 });
  } catch (error) {
    console.error('Error creating RSVP:', error);
    return NextResponse.json({ error: 'Failed to create RSVP' }, { status: 500 });
  }
}

// DELETE /api/shifts/[id]/rsvp - Cancel RSVP
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: shiftId } = await params;

    // Find user's RSVP for this shift with shift details for email
    const rsvp = await prisma.shiftVolunteer.findUnique({
      where: {
        shiftId_userId: {
          shiftId,
          userId: user.id,
        },
      },
      include: {
        shift: {
          include: {
            zone: true,
            typeConfig: { select: { name: true } },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!rsvp) {
      return NextResponse.json(
        { error: 'No RSVP found for this shift' },
        { status: 404 }
      );
    }

    // Delete the RSVP
    await prisma.shiftVolunteer.delete({
      where: { id: rsvp.id },
    });

    // Audit log the RSVP cancellation
    await auditDelete(
      toAuditUser(user),
      'ShiftVolunteer',
      rsvp.id,
      {
        shiftId,
        shiftTitle: rsvp.shift.title,
        status: rsvp.status,
      }
    );

    // Send cancellation email - await to ensure it completes before function terminates
    try {
      const shiftType = rsvp.shift.typeConfig?.name || rsvp.shift.type?.replace(/_/g, ' ') || 'Shift';
      const orgId = await getCurrentOrgId();
      await sendShiftCancellationEmail({
        to: rsvp.user.email,
        volunteerName: rsvp.user.name,
        shiftTitle: rsvp.shift.title,
        shiftType,
        shiftDate: rsvp.shift.date,
        startTime: rsvp.shift.startTime,
        endTime: rsvp.shift.endTime,
        zoneName: rsvp.shift.zone?.name || '',
        orgId: orgId || undefined, // Multi-tenant: Use org-specific branding
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling RSVP:', error);
    return NextResponse.json({ error: 'Failed to cancel RSVP' }, { status: 500 });
  }
}

// PATCH /api/shifts/[id]/rsvp - Update RSVP status (Coordinator/Admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can update RSVP status
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: shiftId } = await params;
    const body = await request.json();
    const { volunteerId, status, isZoneLead } = body;

    if (!volunteerId) {
      return NextResponse.json(
        { error: 'Missing volunteerId' },
        { status: 400 }
      );
    }

    // Build update data based on what was provided
    const updateData: { status?: RSVPStatus; confirmedAt?: Date | null; isZoneLead?: boolean } = {};
    let statusUpdated: RSVPStatus | undefined;
    if (status !== undefined) {
      statusUpdated = status as RSVPStatus;
      updateData.status = statusUpdated;
      updateData.confirmedAt = status === 'CONFIRMED' ? new Date() : null;
    }
    if (isZoneLead !== undefined) {
      updateData.isZoneLead = isZoneLead;
    }

    // Get previous RSVP state for audit log
    const previousRsvp = await prisma.shiftVolunteer.findUnique({
      where: {
        shiftId_userId: {
          shiftId,
          userId: volunteerId,
        },
      },
      select: { status: true, isZoneLead: true },
    });

    // Update RSVP
    const rsvp = await prisma.shiftVolunteer.update({
      where: {
        shiftId_userId: {
          shiftId,
          userId: volunteerId,
        },
      },
      data: {
        ...(statusUpdated && { status: statusUpdated, confirmedAt: updateData.confirmedAt }),
        ...(isZoneLead !== undefined && { isZoneLead }),
      },
      include: {
        shift: {
          include: {
            zone: true,
            typeConfig: { select: { name: true } },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log the RSVP update
    await auditUpdate(
      toAuditUser(user),
      'ShiftVolunteer',
      rsvp.id,
      { status: previousRsvp?.status, isZoneLead: previousRsvp?.isZoneLead },
      { status: rsvp.status, isZoneLead: rsvp.isZoneLead },
      { shiftId, shiftTitle: rsvp.shift.title, volunteerName: rsvp.user.name }
    );

    // Send confirmation email with calendar invite when status is changed to CONFIRMED
    if (statusUpdated === 'CONFIRMED') {
      try {
        const shiftType = rsvp.shift.typeConfig?.name || rsvp.shift.type?.replace(/_/g, ' ') || 'Shift';
        const orgId = await getCurrentOrgId();
        await sendShiftConfirmationEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone?.name || '',
          description: rsvp.shift.description || undefined,
          orgId: orgId || undefined, // Multi-tenant: Use org-specific branding
        });
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
      }
    }

    return NextResponse.json(rsvp);
  } catch (error) {
    console.error('Error updating RSVP:', error);
    return NextResponse.json({ error: 'Failed to update RSVP' }, { status: 500 });
  }
}
