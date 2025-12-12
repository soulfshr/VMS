import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// POST /api/trainings/cancel - Cancel multiple training sessions (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can cancel trainings
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { trainingIds, reason } = body;

    if (!trainingIds || !Array.isArray(trainingIds) || trainingIds.length === 0) {
      return NextResponse.json(
        { error: 'No trainings specified' },
        { status: 400 }
      );
    }

    // Fetch training sessions with their attendees to send notifications
    const trainings = await prisma.trainingSession.findMany({
      where: {
        id: { in: trainingIds },
        status: { not: 'CANCELLED' }, // Only cancel non-cancelled trainings
      },
      include: {
        trainingType: true,
        zone: true,
        attendees: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (trainings.length === 0) {
      return NextResponse.json(
        { error: 'No valid trainings to cancel' },
        { status: 400 }
      );
    }

    // Update all training sessions to CANCELLED status
    await prisma.trainingSession.updateMany({
      where: {
        id: { in: trainings.map(t => t.id) },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // TODO: Add email notifications when training cancellation email template is implemented
    // For now, just log that we would send notifications
    const totalAttendees = trainings.reduce((sum, t) => sum + t.attendees.length, 0);
    console.log(`[Cancel Trainings] Would notify ${totalAttendees} attendees about ${trainings.length} cancelled training(s)`, { reason });

    return NextResponse.json({
      message: `Cancelled ${trainings.length} training(s)`,
      cancelledCount: trainings.length,
      notifiedAttendees: totalAttendees,
    });
  } catch (error) {
    console.error('Error cancelling trainings:', error);
    return NextResponse.json(
      { error: 'Failed to cancel trainings' },
      { status: 500 }
    );
  }
}
