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

    // Parse optional qualification from body
    let qualification: Qualification | null = null;
    try {
      const body = await request.json();
      if (body.qualification && Object.values(Qualification).includes(body.qualification)) {
        qualification = body.qualification as Qualification;
      }
    } catch {
      // No body or invalid JSON is fine - qualification is optional
    }

    // Check if shift exists and is published
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
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

    // Check if user already has an RSVP
    const existingRsvp = shift.volunteers.find(v => v.userId === user.id);
    if (existingRsvp) {
      return NextResponse.json(
        { error: 'You have already signed up for this shift', rsvp: existingRsvp },
        { status: 400 }
      );
    }

    // Check if shift is full
    const confirmedCount = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
    if (confirmedCount >= shift.maxVolunteers) {
      return NextResponse.json(
        { error: 'This shift is full' },
        { status: 400 }
      );
    }

    // Check organization settings for auto-confirm
    const orgSettings = await prisma.organizationSettings.findFirst();
    const autoConfirm = orgSettings?.autoConfirmRsvp ?? false;

    // Create RSVP with status based on auto-confirm setting
    const rsvp = await prisma.shiftVolunteer.create({
      data: {
        shiftId,
        userId: user.id,
        status: autoConfirm ? 'CONFIRMED' : 'PENDING',
        confirmedAt: autoConfirm ? new Date() : null,
        qualification,
      },
      include: {
        shift: {
          include: {
            zone: true,
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

    // Audit log the RSVP creation
    auditCreate(
      toAuditUser(user),
      'ShiftVolunteer',
      rsvp.id,
      {
        shiftId,
        shiftTitle: rsvp.shift.title,
        status: rsvp.status,
        qualification: rsvp.qualification,
      }
    );

    // Send appropriate email based on auto-confirm setting
    // Use try/catch with await to ensure email completes before serverless function terminates
    try {
      if (autoConfirm) {
        // Send confirmation email with calendar invite
        await sendShiftConfirmationEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType: rsvp.shift.type,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone.name,
          description: rsvp.shift.description || undefined,
        });
      } else {
        // Send signup confirmation email (pending status)
        await sendShiftSignupEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType: rsvp.shift.type,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone.name,
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
    auditDelete(
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
      await sendShiftCancellationEmail({
        to: rsvp.user.email,
        volunteerName: rsvp.user.name,
        shiftTitle: rsvp.shift.title,
        shiftType: rsvp.shift.type,
        shiftDate: rsvp.shift.date,
        startTime: rsvp.shift.startTime,
        endTime: rsvp.shift.endTime,
        zoneName: rsvp.shift.zone.name,
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
    auditUpdate(
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
        await sendShiftConfirmationEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType: rsvp.shift.type,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone.name,
          description: rsvp.shift.description || undefined,
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
