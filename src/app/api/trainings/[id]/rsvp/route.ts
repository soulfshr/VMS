import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

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
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Check if session exists, is published, and belongs to current org
    const session = await prisma.trainingSession.findFirst({
      where: {
        id: sessionId,
        ...orgFilter,
      },
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

    // Check organization settings for auto-confirm (scoped to org)
    const orgSettings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
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

    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const { attendeeId, status, completedAt, resetCompletion, revokeQualification } = body;

    if (!attendeeId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Handle reset completion
    if (resetCompletion) {
      // Get the attendee with training type info first
      const existingAttendee = await prisma.trainingSessionAttendee.findUnique({
        where: { id: attendeeId, sessionId },
        include: {
          session: {
            include: {
              trainingType: {
                include: {
                  grantsQualifiedRole: true,
                },
              },
            },
          },
        },
      });

      if (!existingAttendee) {
        return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
      }

      // Reset completion status
      const updatedAttendee = await prisma.trainingSessionAttendee.update({
        where: { id: attendeeId, sessionId },
        data: {
          completedAt: null,
          status: 'CONFIRMED',
        },
        include: {
          session: {
            include: {
              trainingType: {
                include: {
                  grantsQualifiedRole: true,
                },
              },
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

      // If revokeQualification is requested and training grants a role
      if (revokeQualification && existingAttendee.session.trainingType.grantsQualifiedRoleId) {
        await prisma.userQualification.deleteMany({
          where: {
            userId: existingAttendee.userId,
            qualifiedRoleId: existingAttendee.session.trainingType.grantsQualifiedRoleId,
            trainingSessionId: sessionId, // Only delete if granted by THIS training
          },
        });
      }

      return NextResponse.json(updatedAttendee);
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
            trainingType: {
              include: {
                grantsQualifiedRole: true,
              },
            },
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

    // If training is marked as completed and grants a qualified role, create UserQualification
    if (completedAt && attendee.session.trainingType.grantsQualifiedRoleId) {
      const qualifiedRoleId = attendee.session.trainingType.grantsQualifiedRoleId;

      // Check if user already has this qualified role
      const existingQualification = await prisma.userQualification.findUnique({
        where: {
          userId_qualifiedRoleId: {
            userId: attendee.userId,
            qualifiedRoleId,
          },
        },
      });

      if (!existingQualification) {
        await prisma.userQualification.create({
          data: {
            userId: attendee.userId,
            qualifiedRoleId,
            trainingSessionId: sessionId,
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
