import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { sendShiftCancelledByCoordinatorEmail } from '@/lib/email';

// POST /api/shifts/cancel - Cancel multiple shifts (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can cancel shifts
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { shiftIds, reason } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'No shifts specified' },
        { status: 400 }
      );
    }

    // Fetch shifts with their volunteers to send notifications
    const shifts = await prisma.shift.findMany({
      where: {
        id: { in: shiftIds },
        status: { not: 'CANCELLED' }, // Only cancel non-cancelled shifts
      },
      include: {
        zone: true,
        volunteers: {
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

    if (shifts.length === 0) {
      return NextResponse.json(
        { error: 'No valid shifts to cancel' },
        { status: 400 }
      );
    }

    // Update all shifts to CANCELLED status
    await prisma.shift.updateMany({
      where: {
        id: { in: shifts.map(s => s.id) },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // Send email notifications to all affected volunteers
    const emailPromises: Promise<void>[] = [];

    for (const shift of shifts) {
      for (const volunteer of shift.volunteers) {
        emailPromises.push(
          sendShiftCancelledByCoordinatorEmail({
            to: volunteer.user.email,
            volunteerName: volunteer.user.name,
            shiftTitle: shift.title,
            shiftType: shift.type.replace(/_/g, ' '),
            shiftDate: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            zoneName: shift.zone.name,
            reason,
          })
        );
      }
    }

    // Send all emails (don't await - fire and forget for performance)
    Promise.all(emailPromises).catch(err => {
      console.error('[Cancel Shifts] Error sending notification emails:', err);
    });

    const totalVolunteers = shifts.reduce((sum, s) => sum + s.volunteers.length, 0);

    return NextResponse.json({
      message: `Cancelled ${shifts.length} shift(s)`,
      cancelledCount: shifts.length,
      notifiedVolunteers: totalVolunteers,
    });
  } catch (error) {
    console.error('Error cancelling shifts:', error);
    return NextResponse.json(
      { error: 'Failed to cancel shifts' },
      { status: 500 }
    );
  }
}
