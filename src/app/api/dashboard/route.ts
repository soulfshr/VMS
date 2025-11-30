import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';

// GET /api/dashboard - Get dashboard data for current user
export async function GET() {
  try {
    const user = await getDbUserWithZones();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get user's upcoming shifts (confirmed or pending)
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        date: { gte: now },
        volunteers: {
          some: {
            userId: user.id,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        },
      },
      include: {
        zone: true,
        volunteers: {
          where: { userId: user.id },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
      take: 5,
    });

    // Get count of available shifts (published, future, with spots available)
    const availableShifts = await prisma.shift.findMany({
      where: {
        status: 'PUBLISHED',
        date: { gte: now },
      },
      include: {
        volunteers: {
          where: { status: 'CONFIRMED' },
        },
      },
    });

    const shiftsWithSpots = availableShifts.filter(
      shift => shift.volunteers.length < shift.maxVolunteers
    );

    // Get user's completed hours this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedShifts = await prisma.shift.findMany({
      where: {
        status: 'COMPLETED',
        date: {
          gte: startOfMonth,
          lt: now,
        },
        volunteers: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
    });

    let hoursThisMonth = 0;
    completedShifts.forEach(shift => {
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      hoursThisMonth += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    });

    // Get user's training status
    const trainings = await prisma.userTraining.findMany({
      where: { userId: user.id },
      include: { training: true },
    });

    const requiredTrainings = await prisma.training.findMany({
      where: { isRequired: true },
    });

    const completedTrainings = trainings.filter(t => t.status === 'COMPLETED');
    const trainingProgress = requiredTrainings.length > 0
      ? Math.round((completedTrainings.length / requiredTrainings.length) * 100)
      : 100;

    // Get user's primary zone info
    const primaryZone = user.zones.find(uz => uz.isPrimary)?.zone;
    let zoneStats = null;

    if (primaryZone) {
      const zoneVolunteers = await prisma.userZone.count({
        where: { zoneId: primaryZone.id },
      });

      const zoneShiftsThisWeek = await prisma.shift.count({
        where: {
          zoneId: primaryZone.id,
          date: {
            gte: now,
            lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      zoneStats = {
        zone: primaryZone,
        volunteerCount: zoneVolunteers,
        shiftsThisWeek: zoneShiftsThisWeek,
      };
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        zones: user.zones,
      },
      upcomingShifts: upcomingShifts.map(shift => ({
        ...shift,
        userRsvpStatus: shift.volunteers[0]?.status || null,
      })),
      stats: {
        upcomingShiftCount: upcomingShifts.length,
        availableShiftCount: shiftsWithSpots.length,
        hoursThisMonth: Math.round(hoursThisMonth),
        completedShiftCount: completedShifts.length,
        trainingProgress,
      },
      zoneStats,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
