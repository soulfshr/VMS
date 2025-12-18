import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { CoverageOverrideType } from '@/generated/prisma/client';

interface SlotConfig {
  start: number;
  end: number;
  minVols: number;
  needsLead: boolean;
  needsDispatcher: boolean;
}

interface SlotOverride {
  startHour: number;
  endHour: number;
  minVols?: number;
  needsLead?: boolean;
  needsDispatcher?: boolean;
}

interface CoverageOverrideData {
  id: string;
  date: string;
  zoneId: string | null;
  overrideType: CoverageOverrideType;
  slotOverrides: SlotOverride[] | null;
  reason: string | null;
}

/**
 * GET /api/coverage/week?date=YYYY-MM-DD
 *
 * Returns weekly coverage grid data including:
 * - Zone configs (what slots should exist)
 * - Signups (who's signed up for each slot)
 * - Aggregated statistics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's qualifications
    const userQualifications = await prisma.userQualification.findMany({
      where: { userId: user.id },
      include: { qualifiedRole: { select: { slug: true } } },
    });
    const userQualificationSlugs = userQualifications.map(uq => uq.qualifiedRole.slug);

    // Fetch user's primary zone
    const userPrimaryZone = await prisma.userZone.findFirst({
      where: { userId: user.id, isPrimary: true },
      include: { zone: { select: { id: true, name: true } } },
    });
    const primaryZoneId = userPrimaryZone?.zone?.id || null;
    const primaryZoneName = userPrimaryZone?.zone?.name || null;

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // Default to current week's Monday
    let weekStart: Date;
    if (dateParam) {
      weekStart = new Date(dateParam);
    } else {
      weekStart = new Date();
    }

    // Adjust to Monday of the week
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart = new Date(weekStart.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    // Calculate week end (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Get all active zones with their configs
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      include: {
        coverageConfigs: {
          where: { isActive: true },
        },
      },
      orderBy: [
        { county: 'asc' },
        { name: 'asc' },
      ],
    });

    // Get all zone-based signups for the week (excludes coordinators)
    const signups = await prisma.coverageSignup.findMany({
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        status: { in: ['CONFIRMED', 'PENDING'] },
        zoneId: { not: null },  // Zone-based signups only
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            county: true,
          },
        },
      },
    });

    // Get coordinator signups for the week (regional, no zone)
    const coordinatorSignups = await prisma.coverageSignup.findMany({
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        status: { in: ['CONFIRMED', 'PENDING'] },
        zoneId: null,  // Regional coordinator signups
        roleType: 'DISPATCH_COORDINATOR',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get all coverage overrides for the week
    const overrides = await prisma.coverageOverride.findMany({
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        zone: {
          select: { id: true, name: true },
        },
      },
    });

    // Index overrides by date and zone for quick lookup
    // Key format: "YYYY-MM-DD" for global overrides, "YYYY-MM-DD-zoneId" for zone-specific
    const overrideIndex = new Map<string, typeof overrides[0]>();
    for (const override of overrides) {
      const dateStr = override.date.toISOString().split('T')[0];
      if (override.zoneId) {
        // Zone-specific override
        overrideIndex.set(`${dateStr}-${override.zoneId}`, override);
      } else {
        // Global override (applies to all zones)
        overrideIndex.set(dateStr, override);
      }
    }

    // Helper to get override for a specific date/zone
    const getOverride = (dateStr: string, zoneId: string) => {
      // Zone-specific override takes precedence over global
      return overrideIndex.get(`${dateStr}-${zoneId}`) || overrideIndex.get(dateStr) || null;
    };

    // Build the response structure
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }

    // Index signups by date/zone/hour for quick lookup
    const signupIndex = new Map<string, typeof signups>();
    for (const signup of signups) {
      const dateStr = signup.date.toISOString().split('T')[0];
      const key = `${dateStr}-${signup.zoneId}-${signup.startHour}`;
      if (!signupIndex.has(key)) {
        signupIndex.set(key, []);
      }
      signupIndex.get(key)!.push(signup);
    }

    // Index coordinator signups by date/hour for quick lookup
    const coordinatorIndex = new Map<string, typeof coordinatorSignups[0] | null>();
    for (const signup of coordinatorSignups) {
      const dateStr = signup.date.toISOString().split('T')[0];
      const key = `${dateStr}-${signup.startHour}`;
      coordinatorIndex.set(key, signup);
    }

    // Collect unique time slots across all configs
    const timeSlotSet = new Set<string>();
    for (const zone of zones) {
      for (const config of zone.coverageConfigs) {
        const configSlots = config.slots as unknown as SlotConfig[];
        for (const slot of configSlots) {
          timeSlotSet.add(`${slot.start}-${slot.end}`);
        }
      }
    }
    const timeSlots = Array.from(timeSlotSet)
      .map(s => {
        const [start, end] = s.split('-').map(Number);
        return { start, end };
      })
      .sort((a, b) => a.start - b.start);

    // Group zones by county for the counties list
    const countyMap = new Map<string, Array<{ id: string; name: string }>>();
    for (const zone of zones) {
      const county = zone.county || 'Other';
      if (!countyMap.has(county)) {
        countyMap.set(county, []);
      }
      countyMap.get(county)!.push({ id: zone.id, name: zone.name });
    }
    const counties = Array.from(countyMap.entries()).map(([county, zoneList]) => ({
      county,
      zones: zoneList,
    }));

    // Build days array with flattened slots
    const days = weekDates.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();

      // Check for global closure override for this date
      const globalOverride = overrideIndex.get(dateStr);
      const isGlobalClosure = globalOverride?.overrideType === 'CLOSURE' && !globalOverride.zoneId;

      // Collect all slots across all zones for this day
      const slots: Array<{
        zoneId: string;
        zoneName: string;
        county: string;
        startHour: number;
        endHour: number;
        config: SlotConfig;
        signups: Array<{
          id: string;
          userId: string;
          userName: string;
          roleType: 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER';
          status: string;
        }>;
        coverage: 'full' | 'partial' | 'none';
        needsDispatcher: boolean;
        needsZoneLead: boolean;
        volunteerCount: number;
        volunteerTarget: number;
        hasOverride?: boolean;
      }> = [];

      let dayHasSlots = false;

      // If global closure, skip all zone slots
      if (!isGlobalClosure) {
        for (const zone of zones) {
          // Check for zone-specific override
          const override = getOverride(dateStr, zone.id);

          // Skip this zone if it has a CLOSURE override
          if (override?.overrideType === 'CLOSURE') {
            continue;
          }

          const config = zone.coverageConfigs.find(c => c.dayOfWeek === dayOfWeek);
          if (!config) continue;

          let configSlots = config.slots as unknown as SlotConfig[];
          dayHasSlots = true;

          // If there's an ADJUST_REQUIREMENTS override, apply slot overrides
          if (override?.overrideType === 'ADJUST_REQUIREMENTS' && override.slotOverrides) {
            const slotOverrides = override.slotOverrides as unknown as SlotOverride[];
            // Convert slot overrides to SlotConfig format
            // Override takes precedence - replace slots that match, keep others
            const overrideMap = new Map<number, SlotOverride>();
            for (const so of slotOverrides) {
              overrideMap.set(so.startHour, so);
            }
            configSlots = configSlots.map(slot => {
              const slotOverride = overrideMap.get(slot.start);
              if (slotOverride) {
                return {
                  start: slotOverride.startHour,
                  end: slotOverride.endHour,
                  minVols: slotOverride.minVols ?? slot.minVols,
                  needsLead: slotOverride.needsLead ?? slot.needsLead,
                  needsDispatcher: slotOverride.needsDispatcher ?? slot.needsDispatcher,
                };
              }
              return slot;
            });
          }

          for (const slotConfig of configSlots) {
            const key = `${dateStr}-${zone.id}-${slotConfig.start}`;
            const slotSignups = signupIndex.get(key) || [];

            const dispatcher = slotSignups.find(s => s.roleType === 'DISPATCHER');
            const zoneLead = slotSignups.find(s => s.roleType === 'ZONE_LEAD');
            const verifiers = slotSignups.filter(s => s.roleType === 'VERIFIER');

            const volunteersNeeded = slotConfig.minVols;
            const volunteersFilled = verifiers.length;
            const hasDispatcher = !!dispatcher;
            const hasZoneLead = !!zoneLead;

            // Calculate coverage status
            let coverage: 'full' | 'partial' | 'none';
            const totalNeeded =
              (slotConfig.needsDispatcher ? 1 : 0) +
              (slotConfig.needsLead ? 1 : 0) +
              volunteersNeeded;
            const totalFilled =
              (hasDispatcher ? 1 : 0) +
              (hasZoneLead ? 1 : 0) +
              volunteersFilled;

            if (totalFilled >= totalNeeded) {
              coverage = 'full';
            } else if (totalFilled > 0) {
              coverage = 'partial';
            } else {
              coverage = 'none';
            }

            slots.push({
              zoneId: zone.id,
              zoneName: zone.name,
              county: zone.county || 'Other',
              startHour: slotConfig.start,
              endHour: slotConfig.end,
              config: slotConfig,
              signups: slotSignups.map(s => ({
                id: s.id,
                userId: s.user.id,
                userName: s.user.name,
                roleType: s.roleType as 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER',
                status: s.status,
              })),
              coverage,
              needsDispatcher: slotConfig.needsDispatcher && !hasDispatcher,
              needsZoneLead: slotConfig.needsLead && !hasZoneLead,
              volunteerCount: volunteersFilled,
              volunteerTarget: volunteersNeeded,
              hasOverride: !!override,
            });
          }
        }
      }

      // Collect override info for this day
      const dayOverrides: CoverageOverrideData[] = [];
      for (const override of overrides) {
        const overrideDateStr = override.date.toISOString().split('T')[0];
        if (overrideDateStr === dateStr) {
          dayOverrides.push({
            id: override.id,
            date: overrideDateStr,
            zoneId: override.zoneId,
            overrideType: override.overrideType,
            slotOverrides: override.slotOverrides as SlotOverride[] | null,
            reason: override.reason,
          });
        }
      }

      return {
        date: dateStr,
        dayOfWeek,
        isActive: dayHasSlots && !isGlobalClosure,
        isClosed: isGlobalClosure,
        closureReason: isGlobalClosure ? globalOverride?.reason : null,
        overrides: dayOverrides,
        slots,
      };
    });

    // Calculate aggregate stats (only count future slots - today or later)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let totalSlots = 0;
    let coveredSlots = 0;
    let criticalGaps = 0;

    for (const day of days) {
      // Skip past days for coverage stats
      if (day.date < todayStr) continue;

      for (const slot of day.slots) {
        totalSlots++;
        if (slot.coverage === 'full') {
          coveredSlots++;
        } else if (slot.coverage === 'none') {
          criticalGaps++;
        }
      }
    }

    // Coordinator hourly slots (6am-6pm = 12 slots)
    const COORDINATOR_HOURLY_SLOTS = Array.from({ length: 12 }, (_, i) => ({
      start: 6 + i,
      end: 7 + i,
    }));

    // Build coordinator coverage data for each day with hourly slots
    const coordinatorCoverage = weekDates.map(dateStr => {
      // Use hourly slots (6am-6pm) for coordinator coverage
      const slotData = COORDINATOR_HOURLY_SLOTS.map(slot => {
        const key = `${dateStr}-${slot.start}`;
        const signup = coordinatorIndex.get(key);
        return {
          startHour: slot.start,
          endHour: slot.end,
          coordinator: signup ? {
            id: signup.id,
            userId: signup.user.id,
            userName: signup.user.name,
            status: signup.status,
          } : null,
        };
      });

      return {
        date: dateStr,
        slots: slotData,
        filledCount: slotData.filter(s => s.coordinator).length,
        totalCount: slotData.length,
      };
    });

    // Calculate coordinator stats (only count future slots - today or later)
    const totalCoordSlots = coordinatorCoverage
      .filter(day => day.date >= todayStr)
      .reduce((acc, day) => acc + day.totalCount, 0);
    const filledCoordSlots = coordinatorCoverage
      .filter(day => day.date >= todayStr)
      .reduce((acc, day) => acc + day.filledCount, 0);

    return NextResponse.json({
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      days,
      counties,
      timeSlots,
      coordinatorCoverage,
      stats: {
        totalSlots,
        coveredSlots,
        criticalGaps,
        coveragePercent: totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0,
        coordinatorSlots: totalCoordSlots,
        coordinatorFilled: filledCoordSlots,
        coordinatorGaps: totalCoordSlots - filledCoordSlots,
      },
      userQualifications: userQualificationSlugs,
      userPrimaryZone: primaryZoneId ? { id: primaryZoneId, name: primaryZoneName } : null,
    });
  } catch (error) {
    console.error('Error fetching coverage week:', error);
    return NextResponse.json({ error: 'Failed to fetch coverage data' }, { status: 500 });
  }
}
