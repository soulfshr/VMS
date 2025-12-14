import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';
import { getOrgTimezone, createHourExtractor } from '@/lib/timezone';

// GET /api/dashboard - Get dashboard data for current user
export async function GET() {
  try {
    const user = await getDbUserWithZones();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get organization timezone for consistent date/time handling
    const timezone = await getOrgTimezone();
    const getHourInTimezone = createHourExtractor(timezone);

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

    // Get the next confirmed shift with ALL teammates (for the "Your Next Shift" widget)
    const nextConfirmedShift = await prisma.shift.findFirst({
      where: {
        date: { gte: now },
        status: 'PUBLISHED',
        volunteers: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        zone: true,
        typeConfig: true,
        volunteers: {
          where: {
            status: 'CONFIRMED',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    // Get dispatch coordinators (regional leads) for the next shift's day
    const dispatchCoordinators = nextConfirmedShift ? await prisma.regionalLeadAssignment.findMany({
      where: {
        date: nextConfirmedShift.date,
      },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { isPrimary: 'desc' }
    }) : [];

    // Get dispatcher for the next shift's county/time slot
    const shiftDispatcher = nextConfirmedShift?.zone?.county ? await prisma.dispatcherAssignment.findFirst({
      where: {
        county: nextConfirmedShift.zone.county,
        date: nextConfirmedShift.date,
        startTime: { lte: nextConfirmedShift.startTime },
        endTime: { gte: nextConfirmedShift.startTime },
        isBackup: false,
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    }) : null;

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
    if (['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
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
      // Use calendar week (Sunday to Saturday) to match Schedule page
      const today = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
      thisWeekStart.setHours(0, 0, 0, 0);
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 7); // Saturday end / Sunday start
      const nextWeekEnd = new Date(thisWeekEnd);
      nextWeekEnd.setDate(thisWeekEnd.getDate() + 7);

      // Get this week's shifts with all confirmed/pending volunteers
      const thisWeekAllShifts = await prisma.shift.findMany({
        where: {
          status: 'PUBLISHED',
          date: { gte: thisWeekStart, lt: thisWeekEnd },
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
          date: { gte: thisWeekEnd, lt: nextWeekEnd },
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
      // Next confirmed shift with all teammates
      nextShift: nextConfirmedShift ? {
        id: nextConfirmedShift.id,
        title: nextConfirmedShift.title,
        date: nextConfirmedShift.date,
        startTime: nextConfirmedShift.startTime,
        endTime: nextConfirmedShift.endTime,
        shiftType: nextConfirmedShift.typeConfig ? {
          name: nextConfirmedShift.typeConfig.name,
          color: nextConfirmedShift.typeConfig.color,
        } : null,
        zone: nextConfirmedShift.zone ? {
          id: nextConfirmedShift.zone.id,
          name: nextConfirmedShift.zone.name,
        } : null,
        teammates: nextConfirmedShift.volunteers
          .filter(v => v.userId !== user.id) // Exclude current user
          .map(v => ({
            id: v.user.id,
            name: v.user.name,
            qualifiedRole: v.qualifiedRole,
          })),
        dispatchCoordinators: dispatchCoordinators.map(dc => ({
          id: dc.user.id,
          name: dc.user.name,
          isPrimary: dc.isPrimary,
          notes: dc.notes,
        })),
        dispatcher: shiftDispatcher ? {
          id: shiftDispatcher.user.id,
          name: shiftDispatcher.user.name,
          notes: shiftDispatcher.notes,
        } : null,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
