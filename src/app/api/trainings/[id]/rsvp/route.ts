import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/trainings/[id]/rsvp - Sign up for training
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Check if session exists and is published
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        attendees: true,
        trainingType: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    if (session.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Training session is not open for signups' },
        { status: 400 }
      );
    }

    // Check if user already signed up
    const existingRsvp = session.attendees.find(a => a.userId === user.id);
    if (existingRsvp) {
      return NextResponse.json(
        { error: 'You have already signed up for this training', rsvp: existingRsvp },
        { status: 400 }
      );
    }

    // Check if session is full
    const confirmedCount = session.attendees.filter(a => a.status === 'CONFIRMED').length;
    if (confirmedCount >= session.maxAttendees) {
      return NextResponse.json(
        { error: 'This training session is full' },
        { status: 400 }
      );
    }

    // Check organization settings for auto-confirm
    const orgSettings = await prisma.organizationSettings.findFirst();
    const autoConfirm = orgSettings?.autoConfirmRsvp ?? false;

    // Create attendance record
    const attendee = await prisma.trainingSessionAttendee.create({
      data: {
        sessionId,
        userId: user.id,
        status: autoConfirm ? 'CONFIRMED' : 'PENDING',
        confirmedAt: autoConfirm ? new Date() : null,
      },
      include: {
        session: {
          include: {
            trainingType: true,
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

    return NextResponse.json(attendee, { status: 201 });
  } catch (error) {
    console.error('Error creating training RSVP:', error);
    return NextResponse.json({ error: 'Failed to sign up for training' }, { status: 500 });
  }
}

// DELETE /api/trainings/[id]/rsvp - Cancel signup
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Find user's signup
    const attendee = await prisma.trainingSessionAttendee.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
    });

    if (!attendee) {
      return NextResponse.json(
        { error: 'No signup found for this training session' },
        { status: 404 }
      );
    }

    // Delete the signup
    await prisma.trainingSessionAttendee.delete({
      where: { id: attendee.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling training signup:', error);
    return NextResponse.json({ error: 'Failed to cancel signup' }, { status: 500 });
  }
}

// PATCH /api/trainings/[id]/rsvp - Update attendance status (Coordinator/Admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const { attendeeId, status, completedAt } = body;

    if (!attendeeId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update attendance record
    const attendee = await prisma.trainingSessionAttendee.update({
      where: {
        id: attendeeId,
        sessionId, // Ensure attendee belongs to this session
      },
      data: {
        status,
        confirmedAt: status === 'CONFIRMED' ? new Date() : undefined,
        attendedAt: status === 'CONFIRMED' && body.attended ? new Date() : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
      },
      include: {
        session: {
          include: {
            trainingType: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            qualifiedRoles: true,
          },
        },
      },
    });

    // If training is marked as completed and grants a role, update user's qualifiedRoles
    if (completedAt && attendee.session.trainingType.grantsRole) {
      const grantedRole = attendee.session.trainingType.grantsRole;
      const currentRoles = attendee.user.qualifiedRoles || [];

      if (!currentRoles.includes(grantedRole)) {
        await prisma.user.update({
          where: { id: attendee.userId },
          data: {
            qualifiedRoles: [...currentRoles, grantedRole],
          },
        });
      }
    }

    return NextResponse.json(attendee);
  } catch (error) {
    console.error('Error updating training attendance:', error);
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }
}
