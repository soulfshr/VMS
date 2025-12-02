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

    // Coordinator/Admin stats
    let coordinatorStats = null;
    if (['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      // Get pending RSVPs count
      const pendingRsvps = await prisma.shiftVolunteer.count({
        where: {
          status: 'PENDING',
          shift: {
            date: { gte: now },
          },
        },
      });

      // Get this week's shifts with coverage info
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thisWeekShifts = await prisma.shift.findMany({
        where: {
          status: 'PUBLISHED',
          date: { gte: now, lt: weekEnd },
        },
        include: {
          zone: true,
          volunteers: {
            where: { status: 'CONFIRMED', isZoneLead: true },
          },
        },
      });

      // Get dispatcher assignments for this week
      const dispatcherAssignments = await prisma.dispatcherAssignment.findMany({
        where: {
          date: { gte: now, lt: weekEnd },
          isBackup: false,
        },
      });

      // Group shifts by date/time to count slots needing coverage
      const slotsByKey = new Map<string, { hasDispatcher: boolean; zones: Set<string>; zonesWithLeads: Set<string> }>();

      thisWeekShifts.forEach(shift => {
        const dateStr = shift.date.toISOString().split('T')[0];
        const startHour = shift.startTime.getUTCHours();
        const endHour = shift.endTime.getUTCHours();
        const county = shift.zone?.county || 'Unknown';
        const key = `${county}-${dateStr}-${startHour}-${endHour}`;

        if (!slotsByKey.has(key)) {
          slotsByKey.set(key, { hasDispatcher: false, zones: new Set(), zonesWithLeads: new Set() });
        }
        const slot = slotsByKey.get(key)!;
        slot.zones.add(shift.zone?.name || 'Unknown');
        if (shift.volunteers.length > 0) {
          slot.zonesWithLeads.add(shift.zone?.name || 'Unknown');
        }
      });

      // Mark slots with dispatchers
      dispatcherAssignments.forEach(assignment => {
        const dateStr = assignment.date.toISOString().split('T')[0];
        const startHour = assignment.startTime.getUTCHours();
        const endHour = assignment.endTime.getUTCHours();
        const key = `${assignment.county}-${dateStr}-${startHour}-${endHour}`;

        if (slotsByKey.has(key)) {
          slotsByKey.get(key)!.hasDispatcher = true;
        }
      });

      // Calculate coverage stats
      let fullCoverage = 0;
      let partialCoverage = 0;
      let noCoverage = 0;
      let slotsNeedingDispatcher = 0;
      let zonesNeedingLeads = 0;
      const topGaps: Array<{ slot: string; needs: string[] }> = [];

      slotsByKey.forEach((slot, key) => {
        const allZonesHaveLeads = slot.zones.size > 0 && slot.zones.size === slot.zonesWithLeads.size;

        if (slot.hasDispatcher && allZonesHaveLeads) {
          fullCoverage++;
        } else if (slot.hasDispatcher || slot.zones.size > 0) {
          partialCoverage++;

          const needs: string[] = [];
          if (!slot.hasDispatcher) {
            slotsNeedingDispatcher++;
            needs.push('dispatcher');
          }
          const missingLeads = slot.zones.size - slot.zonesWithLeads.size;
          if (missingLeads > 0) {
            zonesNeedingLeads += missingLeads;
            needs.push(`${missingLeads} zone lead${missingLeads > 1 ? 's' : ''}`);
          }

          if (needs.length > 0 && topGaps.length < 5) {
            const [county, date, startH] = key.split('-');
            const dateObj = new Date(date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const hour = parseInt(startH);
            const timeStr = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
            topGaps.push({ slot: `${dayName} ${timeStr} - ${county}`, needs });
          }
        } else {
          noCoverage++;
        }
      });

      coordinatorStats = {
        pendingRsvps,
        coverage: {
          full: fullCoverage,
          partial: partialCoverage,
          none: noCoverage,
          total: fullCoverage + partialCoverage,
        },
        gaps: {
          slotsNeedingDispatcher,
          zonesNeedingLeads,
        },
        topGaps,
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
      coordinatorStats,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
