import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';
import { getOrgTimezone, createHourExtractor } from '@/lib/timezone';
import { getCurrentOrgId, orgScope } from '@/lib/org-context';

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

    // Get org scope for filtering queries
    const orgScopeFilter = await orgScope();

    // Get user's upcoming shifts (confirmed, pending, or cancelled but not dismissed)
    // Include cancelled shifts so users can see what was cancelled
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        ...orgScopeFilter,
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

    // Get user's upcoming dispatcher assignments (scoped to current org)
    const upcomingDispatcherAssignments = await prisma.dispatcherAssignment.findMany({
      where: {
        ...orgScopeFilter,
        userId: user.id,
        date: { gte: now },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
      take: 10,
    });

    // Get user's upcoming regional lead (dispatch coordinator) assignments (scoped to current org)
    const upcomingRegionalLeadAssignments = await prisma.regionalLeadAssignment.findMany({
      where: {
        ...orgScopeFilter,
        userId: user.id,
        date: { gte: now },
      },
      orderBy: [
        { date: 'asc' },
      ],
      take: 10,
    });

    // Get the next confirmed shift with ALL teammates (for the "Your Next Shift" widget)
    const nextConfirmedShift = await prisma.shift.findFirst({
      where: {
        ...orgScopeFilter,
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
    // Extract date portion and use range to handle different UTC times
    const shiftDateStr = nextConfirmedShift ? nextConfirmedShift.date.toISOString().split('T')[0] : null;
    const coordDateStart = shiftDateStr ? new Date(shiftDateStr + 'T00:00:00.000Z') : null;
    const coordDateEnd = coordDateStart ? new Date(coordDateStart.getTime() + 24 * 60 * 60 * 1000) : null;

    const dispatchCoordinators = (coordDateStart && coordDateEnd) ? await prisma.regionalLeadAssignment.findMany({
      where: {
        ...orgScopeFilter,
        date: { gte: coordDateStart, lt: coordDateEnd },
      },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { isPrimary: 'desc' }
    }) : [];

    // Get dispatcher for the next shift's county/time slot
    // Use date range to match by day (shift dates may be stored at different UTC times)
    // Match by extracted hours since startTime/endTime may have inconsistent date portions
    const shiftDateStart = nextConfirmedShift ? new Date(nextConfirmedShift.date.toISOString().split('T')[0] + 'T00:00:00.000Z') : null;
    const shiftDateEnd = shiftDateStart ? new Date(shiftDateStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const shiftStartHour = nextConfirmedShift ? getHourInTimezone(nextConfirmedShift.startTime) : null;

    // First fetch all dispatchers for the county/date, then filter by hour
    const candidateDispatchers = (nextConfirmedShift?.zone?.county && shiftDateStart && shiftDateEnd) ? await prisma.dispatcherAssignment.findMany({
      where: {
        ...orgScopeFilter,
        county: nextConfirmedShift.zone.county,
        date: { gte: shiftDateStart, lt: shiftDateEnd },
        isBackup: false,
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    }) : [];

    // Find dispatcher whose time slot covers the shift start hour
    const shiftDispatcher = candidateDispatchers.find(d => {
      const dispatcherStartHour = getHourInTimezone(d.startTime);
      const dispatcherEndHour = getHourInTimezone(d.endTime);
      return shiftStartHour !== null && dispatcherStartHour <= shiftStartHour && dispatcherEndHour > shiftStartHour;
    }) || null;

    // Get user's zone IDs for filtering
    const userZoneIds = user.zones.map(uz => uz.zone.id);

    // Get org context for org-scoped queries
    const orgId = await getCurrentOrgId();

    // Check scheduling mode - in SIMPLE mode, only show available shifts to leads
    const settings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
    const schedulingMode = settings?.schedulingMode || 'SIMPLE';
    const isAdmin = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);

    // Check if user has lead qualifications from their qualified roles
    // Slugs are stored as uppercase with underscores (e.g., ZONE_LEAD, DISPATCHER)
    const hasLeadQualification = user.userQualifications?.some(uq =>
      uq.qualifiedRole.slug === 'DISPATCHER' || uq.qualifiedRole.slug === 'ZONE_LEAD'
    );
    const canBrowseShifts = schedulingMode === 'FULL' || isAdmin || hasLeadQualification;

    // Get user's specific qualifications for filtering openings
    const userHasZoneLeadQual = user.userQualifications?.some(uq => uq.qualifiedRole.slug === 'ZONE_LEAD');
    const userHasVerifierQual = user.userQualifications?.some(uq => uq.qualifiedRole.slug === 'VERIFIER');

    // Determine relevant qualifications based on scheduling mode
    // SIMPLE mode: Only Zone Lead openings
    // FULL mode: All qualified role openings (Zone Lead + Verifier spots)
    const showZoneLeadOpenings = userHasZoneLeadQual;
    const showVerifierOpenings = schedulingMode === 'FULL' && userHasVerifierQual;

    // Get qualified openings - shifts matching user's qualifications
    // Only fetch if user can browse shifts AND has relevant qualifications
    const canSeeOpenings = canBrowseShifts && (showZoneLeadOpenings || showVerifierOpenings);

    const allQualifiedOpenings = canSeeOpenings ? await prisma.shift.findMany({
      where: {
        ...orgScopeFilter,
        status: 'PUBLISHED',
        date: { gte: now },
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
          include: {
            qualifiedRole: { select: { slug: true } },
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
      take: 50, // Get more to filter
    }) : [];

    // Filter shifts based on user's qualifications and what's needed
    type ShiftWithVolunteers = typeof allQualifiedOpenings[number];
    const qualifiedOpeningsFiltered = allQualifiedOpenings.filter((shift: ShiftWithVolunteers) => {
      const needsZoneLead = !shift.volunteers.some(v => v.isZoneLead);
      const hasOpenSpots = shift.volunteers.length < shift.maxVolunteers;

      // If user has zone lead qualification and shift needs zone lead
      if (showZoneLeadOpenings && needsZoneLead) {
        return true;
      }

      // If FULL mode and user has verifier qualification and shift has open spots
      if (showVerifierOpenings && hasOpenSpots) {
        return true;
      }

      return false;
    });

    // Group openings by user's zones vs other zones
    const userZoneOpenings = qualifiedOpeningsFiltered.filter(s => userZoneIds.includes(s.zoneId));
    const otherZoneOpenings = qualifiedOpeningsFiltered.filter(s => !userZoneIds.includes(s.zoneId));

    // Get user's qualified role names for display
    const userQualificationNames = user.userQualifications?.map(uq => uq.qualifiedRole.name) || [];

    // Get dispatcher slot openings for users with DISPATCHER qualification
    const userHasDispatcherQual = user.userQualifications?.some(uq => uq.qualifiedRole.slug === 'DISPATCHER');

    // Get dispatcher scheduling mode - determines how slots are grouped
    const dispatcherSchedulingMode = settings?.dispatcherSchedulingMode || 'ZONE';

    interface DispatcherSlotOpening {
      county: string;
      date: string;
      startTime: string;
      endTime: string;
      startHour: number;
      endHour: number;
      zoneCount: number;
      zones: string[];
    }

    let dispatcherSlotOpenings: DispatcherSlotOpening[] = [];

    // Only show dispatcher slots for COUNTY or REGIONAL mode
    // ZONE mode requires zone-specific assignment which is more complex
    const showDispatcherSlots = userHasDispatcherQual && canBrowseShifts &&
      (dispatcherSchedulingMode === 'COUNTY' || dispatcherSchedulingMode === 'REGIONAL');

    if (showDispatcherSlots) {
      // Get next 2 weeks of shifts to determine needed dispatcher slots
      const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const upcomingShiftsForDispatch = await prisma.shift.findMany({
        where: {
          ...orgScopeFilter,
          status: 'PUBLISHED',
          date: { gte: now, lt: twoWeeksOut },
        },
        include: {
          zone: { select: { name: true, county: true } },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });

      // Get existing dispatcher assignments (scoped to current org)
      const existingDispatcherAssignments = await prisma.dispatcherAssignment.findMany({
        where: {
          ...orgScopeFilter,
          date: { gte: now, lt: twoWeeksOut },
          isBackup: false,
        },
      });

      // Group shifts by date/time (and county if COUNTY mode) to find slots
      const slotMap = new Map<string, {
        county: string;
        date: Date;
        startTime: Date;
        endTime: Date;
        startHour: number;
        endHour: number;
        zones: Set<string>;
        counties: Set<string>;
      }>();

      upcomingShiftsForDispatch.forEach(shift => {
        const county = shift.zone?.county || 'Unknown';
        const dateStr = shift.date.toISOString().split('T')[0];
        const startHour = getHourInTimezone(shift.startTime);
        const endHour = getHourInTimezone(shift.endTime);

        // In REGIONAL mode, group by date/time only (not county)
        // In COUNTY mode, group by county/date/time
        const key = dispatcherSchedulingMode === 'REGIONAL'
          ? `REGIONAL-${dateStr}-${startHour}-${endHour}`
          : `${county}-${dateStr}-${startHour}-${endHour}`;

        if (!slotMap.has(key)) {
          slotMap.set(key, {
            county: dispatcherSchedulingMode === 'REGIONAL' ? 'REGIONAL' : county,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            startHour,
            endHour,
            zones: new Set(),
            counties: new Set(),
          });
        }
        const slot = slotMap.get(key)!;
        slot.zones.add(shift.zone?.name || 'Unknown');
        slot.counties.add(county);
      });

      // Mark slots that already have dispatchers
      const coveredSlots = new Set<string>();
      existingDispatcherAssignments.forEach(assignment => {
        const dateStr = assignment.date.toISOString().split('T')[0];
        const startHour = getHourInTimezone(assignment.startTime);
        const endHour = getHourInTimezone(assignment.endTime);

        // In REGIONAL mode, any assignment with county='REGIONAL' covers the whole slot
        // In COUNTY mode, assignment covers its specific county slot
        if (dispatcherSchedulingMode === 'REGIONAL') {
          // In REGIONAL mode, only 'REGIONAL' assignments count as coverage
          if (assignment.county === 'REGIONAL') {
            const key = `REGIONAL-${dateStr}-${startHour}-${endHour}`;
            coveredSlots.add(key);
          }
        } else {
          const key = `${assignment.county}-${dateStr}-${startHour}-${endHour}`;
          coveredSlots.add(key);
        }
      });

      // Filter to uncovered slots
      dispatcherSlotOpenings = Array.from(slotMap.entries())
        .filter(([key]) => !coveredSlots.has(key))
        .map(([, slot]) => ({
          county: slot.county,
          date: slot.date.toISOString(),
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          startHour: slot.startHour,
          endHour: slot.endHour,
          zoneCount: slot.zones.size,
          zones: Array.from(slot.zones),
        }))
        .slice(0, 20); // Limit to 20 openings
    }

    // Get Regional Lead (Dispatch Coordinator) openings for qualified users
    const userHasRegionalLeadQual = user.userQualifications?.some(uq => uq.qualifiedRole.slug === 'REGIONAL_LEAD');

    interface RegionalLeadOpening {
      date: string;
      shiftCount: number;
      hasExistingAssignment: boolean;
    }

    let regionalLeadOpenings: RegionalLeadOpening[] = [];

    if (userHasRegionalLeadQual && canBrowseShifts) {
      // Get next 2 weeks of dates with shifts
      const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const shiftsForRegionalLead = await prisma.shift.findMany({
        where: {
          ...orgScopeFilter,
          status: 'PUBLISHED',
          date: { gte: now, lt: twoWeeksOut },
        },
        select: { date: true },
      });

      // Get existing regional lead assignments (scoped to current org)
      const existingRegionalLeadAssignments = await prisma.regionalLeadAssignment.findMany({
        where: {
          ...orgScopeFilter,
          date: { gte: now, lt: twoWeeksOut },
        },
        select: { date: true },
      });

      // Group shifts by date
      const shiftsByDate = new Map<string, number>();
      shiftsForRegionalLead.forEach(shift => {
        const dateStr = shift.date.toISOString().split('T')[0];
        shiftsByDate.set(dateStr, (shiftsByDate.get(dateStr) || 0) + 1);
      });

      // Mark dates that already have regional lead assignments
      const coveredDates = new Set<string>();
      existingRegionalLeadAssignments.forEach(assignment => {
        const dateStr = assignment.date.toISOString().split('T')[0];
        coveredDates.add(dateStr);
      });

      // Filter to uncovered dates with shifts
      regionalLeadOpenings = Array.from(shiftsByDate.entries())
        .filter(([dateStr]) => !coveredDates.has(dateStr))
        .map(([dateStr, count]) => ({
          date: dateStr,
          shiftCount: count,
          hasExistingAssignment: false,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 14); // Limit to 14 days
    }

    // Get user's completed hours this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedShifts = await prisma.shift.findMany({
      where: {
        ...orgScopeFilter,
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

    // Get organization settings for autoConfirmRsvp
    const orgSettings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
    const autoConfirmRsvp = orgSettings?.autoConfirmRsvp ?? false;

    // Coordinator/Admin stats
    let coordinatorStats = null;
    if (['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      // Get pending RSVPs count
      const pendingRsvps = await prisma.shiftVolunteer.count({
        where: {
          status: 'PENDING',
          shift: {
            ...orgScopeFilter,
            date: { gte: now },
          },
        },
      });

      // Get this week's shifts with coverage info
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thisWeekShifts = await prisma.shift.findMany({
        where: {
          ...orgScopeFilter,
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

      // Get dispatcher assignments for this week (scoped to current org)
      const dispatcherAssignments = await prisma.dispatcherAssignment.findMany({
        where: {
          ...orgScopeFilter,
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
      // Use Monday-Sunday weeks in America/New_York timezone
      // Get the current date components in the target timezone
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      });
      const parts = dateFormatter.formatToParts(now);
      const todayYear = parseInt(parts.find(p => p.type === 'year')?.value || '2025');
      const todayMonth = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // 0-indexed
      const todayDay = parseInt(parts.find(p => p.type === 'day')?.value || '1');
      const todayWeekday = parts.find(p => p.type === 'weekday')?.value || 'Mon';

      // Map weekday to number (Mon=1, Tue=2, ..., Sun=0 but we want Sun=7 for our calc)
      const weekdayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const dayOfWeek = weekdayMap[todayWeekday] ?? 1;

      // Calculate days to subtract to get to Monday
      // Sunday (0) -> go back 6 days, Monday (1) -> go back 0 days, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      // Create date boundaries at midnight UTC
      // Shift dates are stored as midnight UTC (e.g., 2025-12-15T00:00:00.000Z)
      const thisWeekStart = new Date(Date.UTC(todayYear, todayMonth, todayDay - daysToMonday, 0, 0, 0));
      const thisWeekEnd = new Date(Date.UTC(todayYear, todayMonth, todayDay - daysToMonday + 7, 0, 0, 0));
      const nextWeekEnd = new Date(Date.UTC(todayYear, todayMonth, todayDay - daysToMonday + 14, 0, 0, 0));

      // Get this week's shifts with confirmed volunteers (to check zone lead coverage)
      const thisWeekAllShifts = await prisma.shift.findMany({
        where: {
          ...orgScopeFilter,
          status: 'PUBLISHED',
          date: { gte: thisWeekStart, lt: thisWeekEnd },
        },
        include: {
          volunteers: {
            where: { status: 'CONFIRMED' },
          },
        },
      });

      // Get next week's shifts
      const nextWeekAllShifts = await prisma.shift.findMany({
        where: {
          ...orgScopeFilter,
          status: 'PUBLISHED',
          date: { gte: thisWeekEnd, lt: nextWeekEnd },
        },
        include: {
          volunteers: {
            where: { status: 'CONFIRMED' },
          },
        },
      });

      // Get dispatcher assignments for both weeks (scoped to current org)
      const thisWeekDispatcherAssignments = await prisma.dispatcherAssignment.findMany({
        where: { ...orgScopeFilter, date: { gte: thisWeekStart, lt: thisWeekEnd } },
      });
      const nextWeekDispatcherAssignments = await prisma.dispatcherAssignment.findMany({
        where: { ...orgScopeFilter, date: { gte: thisWeekEnd, lt: nextWeekEnd } },
      });

      // Get regional lead (coordinator) assignments for both weeks (scoped to current org)
      const thisWeekRegionalLeadAssignments = await prisma.regionalLeadAssignment.findMany({
        where: { ...orgScopeFilter, date: { gte: thisWeekStart, lt: thisWeekEnd } },
      });
      const nextWeekRegionalLeadAssignments = await prisma.regionalLeadAssignment.findMany({
        where: { ...orgScopeFilter, date: { gte: thisWeekEnd, lt: nextWeekEnd } },
      });

      // Calculate LEADERSHIP coverage for each week
      // Leadership roles: Zone Leads (1 per shift), Dispatchers (3 time blocks/day), Coordinators (1/day)
      const DISPATCHER_TIME_BLOCKS_PER_DAY = 3; // Morning, Afternoon, Evening

      const calculateWeekCoverage = (
        shifts: typeof thisWeekAllShifts,
        dispatcherAssignments: typeof thisWeekDispatcherAssignments,
        regionalLeadAssignments: typeof thisWeekRegionalLeadAssignments
      ) => {
        // Zone Lead slots - each shift needs 1 zone lead
        const totalZoneLeadSlots = shifts.length;
        const filledZoneLeadSlots = shifts.filter(s =>
          s.volunteers.some(v => v.isZoneLead)
        ).length;
        const shiftsNeedingZoneLead = totalZoneLeadSlots - filledZoneLeadSlots;

        // Get unique dates with shifts
        const uniqueDates = [...new Set(shifts.map(s => {
          const d = new Date(s.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }))];
        const daysWithShifts = uniqueDates.length;

        // Dispatcher slots - 3 time blocks per day (REGIONAL mode)
        const totalDispatcherSlots = daysWithShifts * DISPATCHER_TIME_BLOCKS_PER_DAY;
        const filledDispatcherSlots = dispatcherAssignments.length;

        // Coordinator slots - 1 per day with shifts
        const totalCoordinatorSlots = daysWithShifts;
        // Count unique dates with coordinator assignments
        const filledCoordinatorDates = [...new Set(
          regionalLeadAssignments.map(a => {
            const d = new Date(a.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })
        )];
        const filledCoordinatorSlots = filledCoordinatorDates.length;

        // Total leadership slots
        const totalSlots = totalZoneLeadSlots + totalDispatcherSlots + totalCoordinatorSlots;
        const filledSlots = filledZoneLeadSlots + filledDispatcherSlots + filledCoordinatorSlots;

        return {
          totalShifts: shifts.length,
          totalSlots,
          filledSlots,
          openSlots: totalSlots - filledSlots,
          shiftsNeedingHelp: shiftsNeedingZoneLead, // Shifts without a zone lead
          coveragePercent: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
        };
      };

      const thisWeekCoverage = calculateWeekCoverage(thisWeekAllShifts, thisWeekDispatcherAssignments, thisWeekRegionalLeadAssignments);
      const nextWeekCoverage = calculateWeekCoverage(nextWeekAllShifts, nextWeekDispatcherAssignments, nextWeekRegionalLeadAssignments);

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
        // Look up the user's role color
        let userRoleColor: string | null = null;
        let userRoleName: string | null = null;
        if (userVolunteer?.isZoneLead) {
          const zoneLeadRole = user.userQualifications?.find(uq => uq.qualifiedRole.slug === 'ZONE_LEAD');
          userRoleColor = zoneLeadRole?.qualifiedRole.color || '#8b5cf6'; // purple fallback
          userRoleName = 'Zone Lead';
        } else {
          // Default to Verifier role or first qualification
          const verifierRole = user.userQualifications?.find(uq => uq.qualifiedRole.slug === 'VERIFIER');
          const defaultRole = verifierRole || user.userQualifications?.[0];
          userRoleColor = defaultRole?.qualifiedRole.color || '#14b8a6'; // cyan fallback
          userRoleName = defaultRole?.qualifiedRole.name || 'Volunteer';
        }
        return {
          ...shift,
          shiftStatus: shift.status, // Include shift status (PUBLISHED, CANCELLED, etc.)
          shiftType: shift.typeConfig ? {
            name: shift.typeConfig.name,
            color: shift.typeConfig.color,
          } : null,
          signedUpCount: shift.volunteers.length,
          userRsvp: userVolunteer ? {
            status: userVolunteer.status,
            isZoneLead: userVolunteer.isZoneLead || false,
            roleName: userRoleName,
            roleColor: userRoleColor,
          } : null,
        };
      }),
      // Qualified openings - shifts matching user's qualifications
      qualifiedOpenings: {
        userZones: userZoneOpenings.slice(0, 10).map((shift: typeof allQualifiedOpenings[number]) => ({
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
          needsZoneLead: !shift.volunteers.some(v => v.isZoneLead),
          spotsRemaining: shift.maxVolunteers - shift.volunteers.length,
        })),
        otherZones: otherZoneOpenings.slice(0, 10).map((shift: typeof allQualifiedOpenings[number]) => ({
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
          needsZoneLead: !shift.volunteers.some(v => v.isZoneLead),
          spotsRemaining: shift.maxVolunteers - shift.volunteers.length,
        })),
        userQualifications: userQualificationNames,
      },
      // Dispatcher slot openings - county/time slots needing a dispatcher
      dispatcherSlotOpenings,
      // Dispatcher scheduling mode for UI labels
      dispatcherSchedulingMode,
      // User's upcoming dispatcher assignments
      upcomingDispatcherAssignments: upcomingDispatcherAssignments.map(assignment => ({
        id: assignment.id,
        county: assignment.county,
        date: assignment.date,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        isBackup: assignment.isBackup,
        notes: assignment.notes,
      })),
      // Regional Lead (Dispatch Coordinator) openings - days needing a coordinator
      regionalLeadOpenings,
      // User's upcoming regional lead assignments
      upcomingRegionalLeadAssignments: upcomingRegionalLeadAssignments.map(assignment => ({
        id: assignment.id,
        date: assignment.date,
        isPrimary: assignment.isPrimary,
        notes: assignment.notes,
      })),
      // Stats in the format expected by DashboardClient
      volunteerStats: {
        myShifts: upcomingShifts.length + upcomingDispatcherAssignments.length + upcomingRegionalLeadAssignments.length,
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
        availableShiftCount: userZoneOpenings.length + otherZoneOpenings.length,
        hoursThisMonth: Math.round(hoursThisMonth),
        completedShiftCount: completedShifts.length,
        trainingProgress,
      },
      zoneStats,
      coordinatorStats,
      autoConfirmRsvp,
      // Scheduling mode - SIMPLE (shifts only) vs FULL (shifts + coverage)
      schedulingMode,
      // Next confirmed shift with all teammates
      nextShift: nextConfirmedShift ? (() => {
        // Get user's volunteer entry for this shift
        const userVolunteer = nextConfirmedShift.volunteers.find(v => v.userId === user.id);
        // Look up the user's role color
        let userRoleColor: string | null = null;
        let userRoleName: string | null = null;
        if (userVolunteer?.isZoneLead) {
          const zoneLeadRole = user.userQualifications?.find(uq => uq.qualifiedRole.slug === 'ZONE_LEAD');
          userRoleColor = zoneLeadRole?.qualifiedRole.color || '#8b5cf6'; // purple fallback
          userRoleName = 'Zone Lead';
        } else {
          // Default to Verifier role or first qualification
          const verifierRole = user.userQualifications?.find(uq => uq.qualifiedRole.slug === 'VERIFIER');
          const defaultRole = verifierRole || user.userQualifications?.[0];
          userRoleColor = defaultRole?.qualifiedRole.color || '#14b8a6'; // cyan fallback
          userRoleName = defaultRole?.qualifiedRole.name || 'Volunteer';
        }
        return {
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
          userRole: {
            name: userRoleName,
            color: userRoleColor,
            isZoneLead: userVolunteer?.isZoneLead || false,
          },
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
        };
      })() : null,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
