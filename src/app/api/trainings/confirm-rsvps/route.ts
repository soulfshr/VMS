import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { canManageOrgSettings, createPermissionContext } from '@/lib/permissions';

// POST /api/trainings/confirm-rsvps - Confirm all pending RSVPs for selected training sessions (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can confirm RSVPs
    const ctx = createPermissionContext(user.role);
    if (!canManageOrgSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { trainingIds } = body;

    if (!trainingIds || !Array.isArray(trainingIds) || trainingIds.length === 0) {
      return NextResponse.json(
        { error: 'No trainings specified' },
        { status: 400 }
      );
    }

    // Find all pending RSVPs for the selected training sessions
    const pendingRsvps = await prisma.trainingSessionAttendee.findMany({
      where: {
        sessionId: { in: trainingIds },
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        session: {
          include: {
            trainingType: true,
            zone: true,
          },
        },
      },
    });

    if (pendingRsvps.length === 0) {
      return NextResponse.json(
        { error: 'No pending RSVPs found for selected trainings' },
        { status: 400 }
      );
    }

    // Update all pending RSVPs to CONFIRMED
    await prisma.trainingSessionAttendee.updateMany({
      where: {
        id: { in: pendingRsvps.map(r => r.id) },
      },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // TODO: Add email notifications when training confirmation email template is implemented
    // For now, just log that we would send notifications
    console.log(`[Confirm Training RSVPs] Confirmed ${pendingRsvps.length} RSVPs`);

    // Count unique training sessions affected
    const uniqueTrainings = new Set(pendingRsvps.map(r => r.sessionId));

    return NextResponse.json({
      message: `Confirmed ${pendingRsvps.length} RSVP(s)`,
      confirmedCount: pendingRsvps.length,
      trainingsAffected: uniqueTrainings.size,
    });
  } catch (error) {
    console.error('Error confirming training RSVPs:', error);
    return NextResponse.json(
      { error: 'Failed to confirm RSVPs' },
      { status: 500 }
    );
  }
}
