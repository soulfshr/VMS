import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { RSVPStatus } from '@/generated/prisma/enums';
import {
  sendShiftSignupEmail,
  sendShiftConfirmationEmail,
  sendShiftCancellationEmail,
} from '@/lib/email';

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

    // Send appropriate email based on auto-confirm setting
    if (autoConfirm) {
      // Send confirmation email with calendar invite
      sendShiftConfirmationEmail({
        to: rsvp.user.email,
        volunteerName: rsvp.user.name,
        shiftTitle: rsvp.shift.title,
        shiftType: rsvp.shift.type,
        shiftDate: rsvp.shift.date,
        startTime: rsvp.shift.startTime,
        endTime: rsvp.shift.endTime,
        zoneName: rsvp.shift.zone.name,
        description: rsvp.shift.description || undefined,
      }).catch(err => console.error('Email send error:', err));
    } else {
      // Send signup confirmation email (pending status)
      sendShiftSignupEmail({
        to: rsvp.user.email,
        volunteerName: rsvp.user.name,
        shiftTitle: rsvp.shift.title,
        shiftType: rsvp.shift.type,
        shiftDate: rsvp.shift.date,
        startTime: rsvp.shift.startTime,
        endTime: rsvp.shift.endTime,
        zoneName: rsvp.shift.zone.name,
      }).catch(err => console.error('Email send error:', err));
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

    // Send cancellation email (async, don't block response)
    sendShiftCancellationEmail({
      to: rsvp.user.email,
      volunteerName: rsvp.user.name,
      shiftTitle: rsvp.shift.title,
      shiftType: rsvp.shift.type,
      shiftDate: rsvp.shift.date,
      startTime: rsvp.shift.startTime,
      endTime: rsvp.shift.endTime,
      zoneName: rsvp.shift.zone.name,
    }).catch(err => console.error('Email send error:', err));

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
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
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
    if (status !== undefined) {
      updateData.status = status as RSVPStatus;
      updateData.confirmedAt = status === 'CONFIRMED' ? new Date() : null;
    }
    if (isZoneLead !== undefined) {
      updateData.isZoneLead = isZoneLead;
    }

    // Update RSVP
    const rsvp = await prisma.shiftVolunteer.update({
      where: {
        shiftId_userId: {
          shiftId,
          userId: volunteerId,
        },
      },
      data: updateData,
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

    // Send confirmation email with calendar invite when status is changed to CONFIRMED
    if (status === 'CONFIRMED' && updateData.status === 'CONFIRMED') {
      sendShiftConfirmationEmail({
        to: rsvp.user.email,
        volunteerName: rsvp.user.name,
        shiftTitle: rsvp.shift.title,
        shiftType: rsvp.shift.type,
        shiftDate: rsvp.shift.date,
        startTime: rsvp.shift.startTime,
        endTime: rsvp.shift.endTime,
        zoneName: rsvp.shift.zone.name,
        description: rsvp.shift.description || undefined,
      }).catch(err => console.error('Email send error:', err));
    }

    return NextResponse.json(rsvp);
  } catch (error) {
    console.error('Error updating RSVP:', error);
    return NextResponse.json({ error: 'Failed to update RSVP' }, { status: 500 });
  }
}
