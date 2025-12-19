import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';
import {
  getTodayET,
  getCurrentWeekMondayET,
  getWeekBoundaries,
  getWeekDates,
  addDays,
  getDayOfWeekFromDateString,
  dateToString,
  parseDateStringToUTC,
} from '@/lib/dates';

interface SlotConfig {
  start: number;
  end: number;
  minVols: number;
  needsLead: boolean;
  needsDispatcher: boolean;
}

interface SlotOpening {
  date: string;
  startHour: number;
  endHour: number;
  zoneId: string | null;
  zoneName: string | null;
  county: string | null;
  roleType: 'ZONE_LEAD' | 'VERIFIER' | 'DISPATCHER' | 'DISPATCH_COORDINATOR';
  spotsRemaining?: number;
}

/**
 * GET /api/dashboard/coverage
 *
 * Returns coverage-focused dashboard data including:
 * - User's upcoming signups
 * - Next slot with teammates
 * - Stats (slots, hours)
 * - Openings based on user's qualifications
 * - Coverage summary (for coordinators)
 */
export async function GET() {
  try {
    const user = await getDbUserWithZones();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current time for "upcoming" queries
    const now = new Date();

    // Calculate week boundaries for stats (using Eastern Time for "today")
    const todayStr = getTodayET();
    const mondayStr = getCurrentWeekMondayET();
    const { weekStart, weekEnd } = getWeekBoundaries(mondayStr);

    // Get user's upcoming signups (next 14 days)
    const mySignups = await prisma.coverageSignup.findMany({
      where: {
        userId: user.id,
        date: { gte: now },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      include: {
        zone: { select: { id: true, name: true, county: true } },
      },
      orderBy: [{ date: 'asc' }, { startHour: 'asc' }],
      take: 20,
    });

    // Get signups for this week only (for stats)
    const thisWeekSignups = await prisma.coverageSignup.findMany({
      where: {
        userId: user.id,
        date: { gte: weekStart, lte: weekEnd },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    // Calculate stats
    const slotsThisWeek = thisWeekSignups.length;
    const hoursThisWeek = thisWeekSignups.reduce((sum, s) => sum + (s.endHour - s.startHour), 0);

    // Get user's primary zone
    const primaryZone = user.zones.find(uz => uz.isPrimary)?.zone || user.zones[0]?.zone || null;

    // Get user's qualifications
    const userQualifications = await prisma.userQualification.findMany({
      where: { userId: user.id },
      include: { qualifiedRole: { select: { slug: true, name: true, color: true } } },
    });
    const qualSlugs = userQualifications.map(uq => uq.qualifiedRole.slug);

    // Format my signups for response
    const formattedSignups = mySignups.map(s => ({
      id: s.id,
      date: dateToString(s.date),
      startHour: s.startHour,
      endHour: s.endHour,
      zoneId: s.zoneId,
      zoneName: s.zone?.name || null,
      county: s.zone?.county || null,
      roleType: s.roleType as 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER' | 'DISPATCH_COORDINATOR',
      status: s.status as 'CONFIRMED' | 'PENDING',
    }));

    // Get next slot with teammates
    let nextSlot = null;
    if (mySignups.length > 0) {
      const nextSignup = mySignups[0];
      const nextDate = dateToString(nextSignup.date);

      // Get all signups for the same zone/slot
      const teammatesQuery = nextSignup.zoneId
        ? prisma.coverageSignup.findMany({
            where: {
              date: nextSignup.date,
              zoneId: nextSignup.zoneId,
              startHour: nextSignup.startHour,
              status: { in: ['CONFIRMED', 'PENDING'] },
              userId: { not: user.id },
            },
            include: {
              user: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]);

      // Get dispatcher for this zone/slot (if user is not the dispatcher)
      const dispatcherQuery = nextSignup.roleType !== 'DISPATCHER' && nextSignup.zoneId
        ? prisma.coverageSignup.findFirst({
            where: {
              date: nextSignup.date,
              zoneId: nextSignup.zoneId,
              startHour: nextSignup.startHour,
              roleType: 'DISPATCHER',
              status: { in: ['CONFIRMED', 'PENDING'] },
            },
            include: {
              user: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve(null);

      // Get coordinator for this time slot
      const coordinatorQuery = prisma.coverageSignup.findFirst({
        where: {
          date: nextSignup.date,
          startHour: nextSignup.startHour,
          roleType: 'DISPATCH_COORDINATOR',
          zoneId: null,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      const [teammates, dispatcher, coordinator] = await Promise.all([
        teammatesQuery,
        dispatcherQuery,
        coordinatorQuery,
      ]);

      nextSlot = {
        date: nextDate,
        startHour: nextSignup.startHour,
        endHour: nextSignup.endHour,
        zone: nextSignup.zone ? {
          id: nextSignup.zone.id,
          name: nextSignup.zone.name,
          county: nextSignup.zone.county || null,
        } : null,
        userRole: nextSignup.roleType as 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER' | 'DISPATCH_COORDINATOR',
        teammates: teammates.map(t => ({
          id: t.user.id,
          name: t.user.name,
          roleType: t.roleType,
        })),
        dispatcher: dispatcher ? { id: dispatcher.user.id, name: dispatcher.user.name } : null,
        coordinator: coordinator ? { id: coordinator.user.id, name: coordinator.user.name } : null,
      };
    }

    // Get openings based on user's qualifications
    const openings = await getOpeningsForUser(user, qualSlugs, primaryZone?.id || null);

    // Get coverage summary (for coordinators)
    let coverageSummary = null;
    const isLeader = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);
    if (isLeader) {
      coverageSummary = await getCoverageSummary(weekStart, weekEnd);
    }

    // Get organization settings for autoConfirmRsvp
    const settings = await prisma.organizationSettings.findFirst();
    const autoConfirmRsvp = settings?.autoConfirmRsvp ?? true;

    return NextResponse.json({
      mySignups: formattedSignups,
      nextSlot,
      stats: {
        slotsThisWeek,
        hoursThisWeek,
        primaryZone: primaryZone ? { id: primaryZone.id, name: primaryZone.name } : null,
        qualifications: userQualifications.map(uq => ({
          slug: uq.qualifiedRole.slug,
          name: uq.qualifiedRole.name,
          color: uq.qualifiedRole.color,
        })),
      },
      openings,
      coverageSummary,
      autoConfirmRsvp,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching coverage dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

/**
 * Get slot openings based on user's qualifications
 */
async function getOpeningsForUser(
  user: { id: string; zones: Array<{ zone: { id: string } }> },
  qualSlugs: string[],
  primaryZoneId: string | null
): Promise<{
  zoneLeadSlots: SlotOpening[];
  verifierSlots: SlotOpening[];
  dispatcherSlots: SlotOpening[];
  coordinatorSlots: SlotOpening[];
}> {
  // Get today in Eastern Time and calculate date range
  const todayStr = getTodayET();
  const twoWeeksOutStr = addDays(todayStr, 13);
  const startDate = parseDateStringToUTC(todayStr);
  const endDate = parseDateStringToUTC(twoWeeksOutStr);
  endDate.setUTCHours(23, 59, 59, 999);

  const userZoneIds = user.zones.map(uz => uz.zone.id);

  // Get all zone configs for the next 2 weeks
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    include: {
      coverageConfigs: { where: { isActive: true } },
    },
  });

  // Get all existing signups for the date range
  const existingSignups = await prisma.coverageSignup.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
    select: {
      date: true,
      zoneId: true,
      startHour: true,
      roleType: true,
      userId: true,
    },
  });

  // Index signups for quick lookup
  const signupIndex = new Map<string, typeof existingSignups>();
  for (const signup of existingSignups) {
    const signupDateStr = dateToString(signup.date);
    const key = `${signupDateStr}-${signup.zoneId || 'regional'}-${signup.startHour}`;
    if (!signupIndex.has(key)) {
      signupIndex.set(key, []);
    }
    signupIndex.get(key)!.push(signup);
  }

  const zoneLeadSlots: SlotOpening[] = [];
  const verifierSlots: SlotOpening[] = [];
  const dispatcherSlots: SlotOpening[] = [];
  const coordinatorSlots: SlotOpening[] = [];

  // Generate date strings for next 2 weeks
  const dateStrings: string[] = [];
  for (let i = 0; i < 14; i++) {
    dateStrings.push(addDays(todayStr, i));
  }

  // Find openings for each zone/date
  for (const dateStr of dateStrings) {
    const dayOfWeek = getDayOfWeekFromDateString(dateStr);

    for (const zone of zones) {
      const config = zone.coverageConfigs.find(c => c.dayOfWeek === dayOfWeek);
      if (!config) continue;

      const slots = config.slots as unknown as SlotConfig[];

      for (const slot of slots) {
        const key = `${dateStr}-${zone.id}-${slot.start}`;
        const slotSignups = signupIndex.get(key) || [];

        // Check if user already signed up for this slot
        const userAlreadySignedUp = slotSignups.some(s => s.userId === user.id);
        if (userAlreadySignedUp) continue;

        // Check zone lead opening
        if (qualSlugs.includes('ZONE_LEAD') && slot.needsLead) {
          const hasZoneLead = slotSignups.some(s => s.roleType === 'ZONE_LEAD');
          if (!hasZoneLead) {
            const isUserZone = userZoneIds.includes(zone.id);
            zoneLeadSlots.push({
              date: dateStr,
              startHour: slot.start,
              endHour: slot.end,
              zoneId: zone.id,
              zoneName: zone.name,
              county: zone.county,
              roleType: 'ZONE_LEAD',
            });
          }
        }

        // Check verifier opening
        if (qualSlugs.includes('VERIFIER')) {
          const verifierCount = slotSignups.filter(s => s.roleType === 'VERIFIER').length;
          const spotsRemaining = slot.minVols - verifierCount;
          if (spotsRemaining > 0) {
            verifierSlots.push({
              date: dateStr,
              startHour: slot.start,
              endHour: slot.end,
              zoneId: zone.id,
              zoneName: zone.name,
              county: zone.county,
              roleType: 'VERIFIER',
              spotsRemaining,
            });
          }
        }

        // Check dispatcher opening
        if (qualSlugs.includes('DISPATCHER') && slot.needsDispatcher) {
          const hasDispatcher = slotSignups.some(s => s.roleType === 'DISPATCHER');
          if (!hasDispatcher) {
            dispatcherSlots.push({
              date: dateStr,
              startHour: slot.start,
              endHour: slot.end,
              zoneId: zone.id,
              zoneName: zone.name,
              county: zone.county,
              roleType: 'DISPATCHER',
            });
          }
        }
      }
    }

    // Check coordinator openings (regional, no zone)
    if (qualSlugs.includes('REGIONAL_LEAD') || qualSlugs.includes('DISPATCH_COORDINATOR')) {
      // Get unique time slots for this day from all zones
      const timeSlots = new Set<number>();
      for (const zone of zones) {
        const config = zone.coverageConfigs.find(c => c.dayOfWeek === dayOfWeek);
        if (config) {
          const slots = config.slots as unknown as SlotConfig[];
          for (const slot of slots) {
            timeSlots.add(slot.start);
          }
        }
      }

      for (const startHour of timeSlots) {
        const key = `${dateStr}-regional-${startHour}`;
        const coordSignups = signupIndex.get(key) || [];
        const hasCoordinator = coordSignups.some(s => s.roleType === 'DISPATCH_COORDINATOR');
        const userAlreadySignedUp = coordSignups.some(s => s.userId === user.id);

        if (!hasCoordinator && !userAlreadySignedUp) {
          coordinatorSlots.push({
            date: dateStr,
            startHour,
            endHour: startHour + 2, // Assuming 2-hour blocks
            zoneId: null,
            zoneName: null,
            county: null,
            roleType: 'DISPATCH_COORDINATOR',
          });
        }
      }
    }
  }

  // Sort openings: user's zone first, then by date
  const sortOpenings = (slots: SlotOpening[]) => {
    return slots.sort((a, b) => {
      // User's primary zone first
      if (primaryZoneId) {
        if (a.zoneId === primaryZoneId && b.zoneId !== primaryZoneId) return -1;
        if (b.zoneId === primaryZoneId && a.zoneId !== primaryZoneId) return 1;
      }
      // Then by date
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // Then by start hour
      return a.startHour - b.startHour;
    });
  };

  return {
    zoneLeadSlots: sortOpenings(zoneLeadSlots).slice(0, 10),
    verifierSlots: sortOpenings(verifierSlots).slice(0, 10),
    dispatcherSlots: sortOpenings(dispatcherSlots).slice(0, 10),
    coordinatorSlots: sortOpenings(coordinatorSlots).slice(0, 10),
  };
}

/**
 * Get coverage summary for coordinators
 * Uses date strings to avoid timezone issues
 */
async function getCoverageSummary(weekStart: Date, weekEnd: Date) {
  // Get all zones with configs
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    include: {
      coverageConfigs: { where: { isActive: true } },
    },
  });

  // Get all signups for the week
  const signups = await prisma.coverageSignup.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
  });

  // Index signups by date string for quick lookup
  const signupsByDate = new Map<string, typeof signups>();
  for (const signup of signups) {
    const signupDateStr = dateToString(signup.date);
    if (!signupsByDate.has(signupDateStr)) {
      signupsByDate.set(signupDateStr, []);
    }
    signupsByDate.get(signupDateStr)!.push(signup);
  }

  // Calculate this week stats
  let totalSlots = 0;
  let filledSlots = 0;
  let criticalGaps = 0;

  // Get the monday date string from weekStart and generate week dates
  const mondayStr = dateToString(weekStart);
  const weekDates = getWeekDates(mondayStr);

  for (const dateStr of weekDates) {
    const dayOfWeek = getDayOfWeekFromDateString(dateStr);
    const daySignups = signupsByDate.get(dateStr) || [];

    for (const zone of zones) {
      const config = zone.coverageConfigs.find(c => c.dayOfWeek === dayOfWeek);
      if (!config) continue;

      const slots = config.slots as unknown as SlotConfig[];

      for (const slot of slots) {
        totalSlots++;

        const slotSignups = daySignups.filter(
          s => s.zoneId === zone.id && s.startHour === slot.start
        );

        const hasZoneLead = slotSignups.some(s => s.roleType === 'ZONE_LEAD');
        const hasDispatcher = slotSignups.some(s => s.roleType === 'DISPATCHER');
        const verifierCount = slotSignups.filter(s => s.roleType === 'VERIFIER').length;

        // Check if slot is fully covered
        const zoneleadOk = !slot.needsLead || hasZoneLead;
        const dispatcherOk = !slot.needsDispatcher || hasDispatcher;
        const verifiersOk = verifierCount >= slot.minVols;

        if (zoneleadOk && dispatcherOk && verifiersOk) {
          filledSlots++;
        } else if (slotSignups.length === 0) {
          criticalGaps++;
        }
      }
    }
  }

  // Calculate next week stats using date strings
  const nextMondayStr = addDays(mondayStr, 7);
  const { weekStart: nextWeekStart, weekEnd: nextWeekEnd } = getWeekBoundaries(nextMondayStr);

  const nextWeekSignups = await prisma.coverageSignup.findMany({
    where: {
      date: { gte: nextWeekStart, lte: nextWeekEnd },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
  });

  // Index next week signups by date string
  const nextSignupsByDate = new Map<string, typeof nextWeekSignups>();
  for (const signup of nextWeekSignups) {
    const signupDateStr = dateToString(signup.date);
    if (!nextSignupsByDate.has(signupDateStr)) {
      nextSignupsByDate.set(signupDateStr, []);
    }
    nextSignupsByDate.get(signupDateStr)!.push(signup);
  }

  let nextTotalSlots = 0;
  let nextFilledSlots = 0;
  let nextCriticalGaps = 0;

  const nextWeekDates = getWeekDates(nextMondayStr);

  for (const dateStr of nextWeekDates) {
    const dayOfWeek = getDayOfWeekFromDateString(dateStr);
    const daySignups = nextSignupsByDate.get(dateStr) || [];

    for (const zone of zones) {
      const config = zone.coverageConfigs.find(c => c.dayOfWeek === dayOfWeek);
      if (!config) continue;

      const slots = config.slots as unknown as SlotConfig[];

      for (const slot of slots) {
        nextTotalSlots++;

        const slotSignups = daySignups.filter(
          s => s.zoneId === zone.id && s.startHour === slot.start
        );

        const hasZoneLead = slotSignups.some(s => s.roleType === 'ZONE_LEAD');
        const hasDispatcher = slotSignups.some(s => s.roleType === 'DISPATCHER');
        const verifierCount = slotSignups.filter(s => s.roleType === 'VERIFIER').length;

        const zoneleadOk = !slot.needsLead || hasZoneLead;
        const dispatcherOk = !slot.needsDispatcher || hasDispatcher;
        const verifiersOk = verifierCount >= slot.minVols;

        if (zoneleadOk && dispatcherOk && verifiersOk) {
          nextFilledSlots++;
        } else if (slotSignups.length === 0) {
          nextCriticalGaps++;
        }
      }
    }
  }

  return {
    thisWeek: {
      totalSlots,
      filledSlots,
      criticalGaps,
      coveragePercent: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
    },
    nextWeek: {
      totalSlots: nextTotalSlots,
      filledSlots: nextFilledSlots,
      criticalGaps: nextCriticalGaps,
      coveragePercent: nextTotalSlots > 0 ? Math.round((nextFilledSlots / nextTotalSlots) * 100) : 0,
    },
  };
}
