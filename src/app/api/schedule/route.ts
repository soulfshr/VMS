import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface TimeBlock {
  startTime: string;
  endTime: string;
  label: string;
}

interface ZoneData {
  zoneId: string;
  zoneName: string;
  zoneLeads: Array<{
    id: string;
    name: string;
    rsvpId: string;
  }>;
  volunteers: Array<{
    id: string;
    name: string;
    rsvpId: string;
    status: string;
  }>;
  shifts: Array<{
    id: string;
    title: string;
    type: string;
  }>;
}

interface CellData {
  county: string;
  date: string;
  timeBlock: TimeBlock;
  dispatcher: {
    id: string;
    name: string;
    assignmentId: string;
    isBackup: boolean;
    notes: string | null;
  } | null;
  backupDispatchers: Array<{
    id: string;
    name: string;
    assignmentId: string;
    notes: string | null;
  }>;
  zones: ZoneData[];
  coverage: 'full' | 'partial' | 'none';
  gaps: {
    needsDispatcher: boolean;
    zonesNeedingLeads: string[];  // Zone names that have shifts but no zone lead
  };
}

// GET /api/schedule - Get aggregated schedule data for dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const county = searchParams.get('county');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch all zones grouped by county
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Group zones by county
    const counties = [...new Set(zones.map(z => z.county).filter(Boolean))] as string[];

    // Fetch shifts in date range
    const shiftsWhere: Record<string, unknown> = {
      date: { gte: start, lte: end },
      status: 'PUBLISHED',
    };
    if (county && county !== 'all') {
      shiftsWhere.zone = { county };
    }

    const shifts = await prisma.shift.findMany({
      where: shiftsWhere,
      include: {
        zone: true,
        volunteers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Fetch dispatcher assignments in date range
    const dispatcherWhere: Record<string, unknown> = {
      date: { gte: start, lte: end },
    };
    if (county && county !== 'all') {
      dispatcherWhere.county = county;
    }

    const dispatcherAssignments = await prisma.dispatcherAssignment.findMany({
      where: dispatcherWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Derive time blocks from shifts (use Eastern Time consistently)
    const timeBlocksMap = new Map<string, TimeBlock>();
    shifts.forEach(shift => {
      const startHour = getHourInTimezone(shift.startTime);
      const endHour = getHourInTimezone(shift.endTime);
      const key = `${startHour}-${endHour}`;
      if (!timeBlocksMap.has(key)) {
        timeBlocksMap.set(key, {
          startTime: `${startHour}:00`,
          endTime: `${endHour}:00`,
          label: `${formatHour(startHour)} - ${formatHour(endHour)}`,
        });
      }
    });

    // Also include dispatcher assignment time blocks (use Eastern Time consistently)
    dispatcherAssignments.forEach(assignment => {
      const startHour = getHourInTimezone(assignment.startTime);
      const endHour = getHourInTimezone(assignment.endTime);
      const key = `${startHour}-${endHour}`;
      if (!timeBlocksMap.has(key)) {
        timeBlocksMap.set(key, {
          startTime: `${startHour}:00`,
          endTime: `${endHour}:00`,
          label: `${formatHour(startHour)} - ${formatHour(endHour)}`,
        });
      }
    });

    const timeBlocks = Array.from(timeBlocksMap.values()).sort((a, b) => {
      return parseInt(a.startTime) - parseInt(b.startTime);
    });

    // Generate dates in range
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Build schedule data
    const schedule: CellData[] = [];

    for (const countyName of (county && county !== 'all' ? [county] : counties)) {
      const countyZones = zones.filter(z => z.county === countyName);

      for (const date of dates) {
        for (const timeBlock of timeBlocks) {
          const startHour = parseInt(timeBlock.startTime);
          const endHour = parseInt(timeBlock.endTime);

          // Find dispatcher for this county/date/time (use Eastern Time)
          const dispatchers = dispatcherAssignments.filter(a => {
            const assignmentDate = a.date.toISOString().split('T')[0];
            const assignmentStartHour = getHourInTimezone(a.startTime);
            const assignmentEndHour = getHourInTimezone(a.endTime);
            return (
              a.county === countyName &&
              assignmentDate === date &&
              assignmentStartHour === startHour &&
              assignmentEndHour === endHour
            );
          });

          const primaryDispatcher = dispatchers.find(d => !d.isBackup);
          const backupDispatchers = dispatchers.filter(d => d.isBackup);

          // Build zone data
          const zoneDataList: ZoneData[] = [];

          for (const zone of countyZones) {
            // Find shifts for this zone/date/time (use Eastern Time)
            const zoneShifts = shifts.filter(s => {
              const shiftDate = s.date.toISOString().split('T')[0];
              const shiftStartHour = getHourInTimezone(s.startTime);
              const shiftEndHour = getHourInTimezone(s.endTime);
              return (
                s.zoneId === zone.id &&
                shiftDate === date &&
                shiftStartHour === startHour &&
                shiftEndHour === endHour
              );
            });

            // Aggregate volunteers across shifts
            const allVolunteers: ZoneData['volunteers'] = [];
            const zoneLeads: ZoneData['zoneLeads'] = [];

            zoneShifts.forEach(shift => {
              shift.volunteers.forEach(v => {
                if (v.status === 'CONFIRMED' || v.status === 'PENDING') {
                  if (v.isZoneLead) {
                    zoneLeads.push({
                      id: v.user.id,
                      name: v.user.name,
                      rsvpId: v.id,
                    });
                  } else {
                    allVolunteers.push({
                      id: v.user.id,
                      name: v.user.name,
                      rsvpId: v.id,
                      status: v.status,
                    });
                  }
                }
              });
            });

            if (zoneShifts.length > 0 || zoneLeads.length > 0 || allVolunteers.length > 0) {
              zoneDataList.push({
                zoneId: zone.id,
                zoneName: zone.name,
                zoneLeads,
                volunteers: allVolunteers,
                shifts: zoneShifts.map(s => ({
                  id: s.id,
                  title: s.title,
                  type: s.type,
                })),
              });
            }
          }

          // Calculate coverage with stricter rules:
          // - "full" = dispatcher + ALL zones with shifts have zone leads
          // - "partial" = has dispatcher OR any zones with shifts
          // - "none" = nothing scheduled
          let coverage: 'full' | 'partial' | 'none' = 'none';
          const hasDispatcher = !!primaryDispatcher;
          const zonesWithShifts = zoneDataList.filter(z => z.shifts.length > 0);
          const zonesNeedingLeads = zonesWithShifts
            .filter(z => z.zoneLeads.length === 0)
            .map(z => z.zoneName);
          const allZonesHaveLeads = zonesWithShifts.length > 0 && zonesNeedingLeads.length === 0;

          if (hasDispatcher && allZonesHaveLeads) {
            coverage = 'full';
          } else if (hasDispatcher || zonesWithShifts.length > 0) {
            coverage = 'partial';
          }

          // Track gaps for display
          const gaps = {
            needsDispatcher: !hasDispatcher && zonesWithShifts.length > 0,
            zonesNeedingLeads,
          };

          // Only add cell if there's any data
          if (hasDispatcher || zonesWithShifts.length > 0 || zoneDataList.length > 0) {
            schedule.push({
              county: countyName,
              date,
              timeBlock,
              dispatcher: primaryDispatcher
                ? {
                    id: primaryDispatcher.user.id,
                    name: primaryDispatcher.user.name,
                    assignmentId: primaryDispatcher.id,
                    isBackup: false,
                    notes: primaryDispatcher.notes,
                  }
                : null,
              backupDispatchers: backupDispatchers.map(d => ({
                id: d.user.id,
                name: d.user.name,
                assignmentId: d.id,
                notes: d.notes,
              })),
              zones: zoneDataList,
              coverage,
              gaps,
            });
          }
        }
      }
    }

    return NextResponse.json({
      counties,
      zones,
      timeBlocks,
      dates,
      schedule,
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

// Organization timezone - Eastern Time
const ORG_TIMEZONE = 'America/New_York';

function getHourInTimezone(date: Date): number {
  // Get hour in Eastern Time
  const hourStr = date.toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: ORG_TIMEZONE,
  });
  return parseInt(hourStr);
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}
