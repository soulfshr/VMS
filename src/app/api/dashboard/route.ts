import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';

// Organization timezone - Eastern Time
const ORG_TIMEZONE = 'America/New_York';

function getHourInTimezone(date: Date): number {
  const hourStr = date.toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: ORG_TIMEZONE,
  });
  return parseInt(hourStr);
}

// GET /api/dashboard - Get dashboard data for current user
export async function GET() {
  try {
    const user = await getDbUserWithZones();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get user's upcoming shifts (confirmed, pending, or cancelled but not dismissed)
    // Include cancelled shifts so users can see what was cancelled
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
        typeConfig: true,
        volunteers: {
          where: {
            userId: user.id,
            status: { in: ['PENDING', 'CONFIRMED'] }
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
      take: 10, // Get more to account for cancelled ones
    });

    // Get user's zone IDs for filtering
    const userZoneIds = user.zones.map(uz => uz.zone.id);

    // Get available shifts in user's zones (published, future, with spots available)
    const availableZoneShifts = await prisma.shift.findMany({
      where: {
        status: 'PUBLISHED',
        date: { gte: now },
        zoneId: { in: userZoneIds.length > 0 ? userZoneIds : ['no-zones'] },
        // Exclude shifts user already signed up for
        NOT: {
          volunteers: {
            some: {
              userId: user.id,
              status: { in: ['PENDING', 'CONFIRMED'] },
            },
          },
        },
      },
      include: {
        zone: true,
        typeConfig: true,
        volunteers: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
      take: 20, // Get more to filter for spots
    });

    // Filter to only shifts with available spots
    const shiftsWithSpots = availableZoneShifts.filter(
      shift => shift.volunteers.length < shift.maxVolunteers
    ).slice(0, 5); // Take top 5 for the widget

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

      // Get zone shifts with volunteer counts for open slots calculation
      const zoneShifts = await prisma.shift.findMany({
        where: {
          zoneId: primaryZone.id,
          date: {
            gte: now,
            lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          volunteers: {
            where: { status: 'CONFIRMED' },
          },
        },
      });

      const openSlots = zoneShifts.reduce((sum, shift) => {
        const spotsRemaining = shift.maxVolunteers - shift.volunteers.length;
        return sum + Math.max(0, spotsRemaining);
      }, 0);

      zoneStats = {
        zone: primaryZone,
        upcomingShifts: zoneShifts.length,
        activeVolunteers: zoneVolunteers,
        openSlots,
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
        const startHour = getHourInTimezone(shift.startTime);
        const endHour = getHourInTimezone(shift.endTime);
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
        const startHour = getHourInTimezone(assignment.startTime);
        const endHour = getHourInTimezone(assignment.endTime);
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

      // Calculate week-by-week volunteer coverage summary
      const nextWeekStart = new Date(weekEnd);
      const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get this week's shifts with all confirmed/pending volunteers
      const thisWeekAllShifts = await prisma.shift.findMany({
        where: {
          status: 'PUBLISHED',
          date: { gte: now, lt: weekEnd },
        },
        include: {
          volunteers: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
          },
        },
      });

      // Get next week's shifts
      const nextWeekAllShifts = await prisma.shift.findMany({
        where: {
          status: 'PUBLISHED',
          date: { gte: nextWeekStart, lt: nextWeekEnd },
        },
        include: {
          volunteers: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
          },
        },
      });

      // Calculate coverage for each week
      const calculateWeekCoverage = (shifts: typeof thisWeekAllShifts) => {
        let totalSlots = 0;
        let filledSlots = 0;
        let shiftsNeedingHelp = 0;

        shifts.forEach(shift => {
          totalSlots += shift.maxVolunteers;
          const confirmed = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
          filledSlots += confirmed;
          if (confirmed < shift.minVolunteers) {
            shiftsNeedingHelp++;
          }
        });

        return {
          totalShifts: shifts.length,
          totalSlots,
          filledSlots,
          openSlots: totalSlots - filledSlots,
          shiftsNeedingHelp,
          coveragePercent: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
        };
      };

      const thisWeekCoverage = calculateWeekCoverage(thisWeekAllShifts);
      const nextWeekCoverage = calculateWeekCoverage(nextWeekAllShifts);

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
        // New week-by-week coverage summary
        weeklyCoverage: {
          thisWeek: thisWeekCoverage,
          nextWeek: nextWeekCoverage,
        },
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
      upcomingShifts: upcomingShifts.map(shift => {
        const userVolunteer = shift.volunteers.find(v => v.userId === user.id);
        return {
          ...shift,
          shiftStatus: shift.status, // Include shift status (PUBLISHED, CANCELLED, etc.)
          shiftType: shift.typeConfig ? {
            name: shift.typeConfig.name,
            color: shift.typeConfig.color,
          } : null,
          signedUpCount: shift.volunteers.length,
          userRsvp: userVolunteer ? { status: userVolunteer.status } : null,
        };
      }),
      // Available shifts in user's zones (not yet signed up)
      availableZoneShifts: shiftsWithSpots.map(shift => ({
        id: shift.id,
        title: shift.title,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.typeConfig ? {
          name: shift.typeConfig.name,
          color: shift.typeConfig.color,
        } : null,
        zone: shift.zone ? {
          id: shift.zone.id,
          name: shift.zone.name,
        } : null,
        signedUpCount: shift.volunteers.length,
        minVolunteers: shift.minVolunteers,
        maxVolunteers: shift.maxVolunteers,
        spotsRemaining: shift.maxVolunteers - shift.volunteers.length,
      })),
      // Stats in the format expected by DashboardClient
      volunteerStats: {
        myShifts: upcomingShifts.length,
        hoursThisMonth: Math.round(hoursThisMonth),
        zones: user.zones,
        qualifiedRoles: user.userQualifications.map(uq => ({
          id: uq.qualifiedRole.id,
          name: uq.qualifiedRole.name,
          slug: uq.qualifiedRole.slug,
          color: uq.qualifiedRole.color,
        })),
      },
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
