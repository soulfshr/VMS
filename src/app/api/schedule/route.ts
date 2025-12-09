import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface TimeBlock {
  startTime: string;      // Eastern time format "6:00"
  endTime: string;        // Eastern time format "10:00"
  label: string;          // Display label "6am - 10am"
  startTimeUTC: string;   // UTC ISO string for saving
  endTimeUTC: string;     // UTC ISO string for saving
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
    typeConfigName: string | null;
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
    zonesNeedingLeads: string[];
  };
}

// Build a helper that extracts the hour for any timezone defined in settings
function createHourExtractor(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  });

  return (date: Date): number => {
    const hourPart = formatter.formatToParts(date).find(part => part.type === 'hour');
    if (!hourPart) {
      return date.getUTCHours();
    }

    const hour = parseInt(hourPart.value, 10);
    return Number.isNaN(hour) ? date.getUTCHours() : hour % 24;
  };
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

// Type for shift with volunteers included
type ShiftWithVolunteers = Awaited<ReturnType<typeof prisma.shift.findMany<{
  include: {
    zone: true;
    typeConfig: {
      select: { name: true };
    };
    volunteers: {
      include: {
        user: {
          select: { id: true; name: true; email: true };
        };
      };
    };
  };
}>>>[0];

// Type for dispatcher with user included
type DispatcherWithUser = Awaited<ReturnType<typeof prisma.dispatcherAssignment.findMany<{
  include: {
    user: {
      select: { id: true; name: true; email: true };
    };
  };
}>>>[0];

// Pre-computed shift data with cached timezone hours
interface ShiftWithHours {
  shift: ShiftWithVolunteers;
  dateStr: string;
  startHour: number;
  endHour: number;
  timeBlockKey: string;
}

// Pre-computed dispatcher data with cached timezone hours
interface DispatcherWithHours {
  assignment: DispatcherWithUser;
  dateStr: string;
  startHour: number;
  endHour: number;
  timeBlockKey: string;
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

    // Parse dates - ensure end date is inclusive of the entire day
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    // Build query filters
    const shiftsWhere: Record<string, unknown> = {
      date: { gte: start, lte: end },
      status: 'PUBLISHED',
    };
    if (county && county !== 'all') {
      shiftsWhere.zone = { county };
    }

    const dispatcherWhere: Record<string, unknown> = {
      date: { gte: start, lte: end },
    };
    if (county && county !== 'all') {
      dispatcherWhere.county = county;
    }

    // Regional lead assignments (day-level, no county filter)
    const regionalLeadWhere: Record<string, unknown> = {
      date: { gte: start, lte: end },
    };

    // Run all queries in PARALLEL for better performance
    const [zones, shifts, dispatcherAssignments, regionalLeadAssignments, settings] = await Promise.all([
      prisma.zone.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.shift.findMany({
        where: shiftsWhere,
        include: {
          zone: true,
          typeConfig: {
            select: { name: true },
          },
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
      }),
      prisma.dispatcherAssignment.findMany({
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
      }),
      prisma.regionalLeadAssignment.findMany({
        where: regionalLeadWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ date: 'asc' }, { isPrimary: 'desc' }],
      }),
      prisma.organizationSettings.findFirst(),
    ]);

    // Get dispatcher scheduling mode (default to ZONE for backwards compatibility)
    const dispatcherSchedulingMode = settings?.dispatcherSchedulingMode || 'ZONE';
    // Get volunteer scheduling mode (default to SIMPLE)
    const schedulingMode = settings?.schedulingMode || 'SIMPLE';
    const timezone = settings?.timezone || 'America/New_York';
    const getHourFromDate = createHourExtractor(timezone);

    // For REGIONAL mode, we also need dispatchers with county = 'ALL'
    let regionalDispatcherAssignments: typeof dispatcherAssignments = [];
    if (dispatcherSchedulingMode === 'REGIONAL') {
      regionalDispatcherAssignments = await prisma.dispatcherAssignment.findMany({
        where: {
          date: { gte: start, lte: end },
          county: 'ALL',
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
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    }

    // Group zones by county
    const counties = [...new Set(zones.map(z => z.county).filter(Boolean))] as string[];

    // PRE-COMPUTE timezone hours ONCE per shift (not in loops!)
    const shiftsWithHours: ShiftWithHours[] = shifts.map(shift => {
      const startHour = getHourFromDate(shift.startTime);
      const endHour = getHourFromDate(shift.endTime);
      return {
        shift,
        dateStr: shift.date.toISOString().split('T')[0],
        startHour,
        endHour,
        timeBlockKey: `${startHour}-${endHour}`,
      };
    });

    // PRE-COMPUTE timezone hours ONCE per dispatcher assignment
    const dispatchersWithHours: DispatcherWithHours[] = dispatcherAssignments.map(assignment => {
      const startHour = getHourFromDate(assignment.startTime);
      const endHour = getHourFromDate(assignment.endTime);
      return {
        assignment,
        dateStr: assignment.date.toISOString().split('T')[0],
        startHour,
        endHour,
        timeBlockKey: `${startHour}-${endHour}`,
      };
    });

    // PRE-COMPUTE regional dispatchers (county = 'ALL')
    const regionalDispatchersWithHours: DispatcherWithHours[] = regionalDispatcherAssignments.map(assignment => {
      const startHour = getHourFromDate(assignment.startTime);
      const endHour = getHourFromDate(assignment.endTime);
      return {
        assignment,
        dateStr: assignment.date.toISOString().split('T')[0],
        startHour,
        endHour,
        timeBlockKey: `${startHour}-${endHour}`,
      };
    });

    // Build time blocks from SHIFTS ONLY (not dispatcher assignments)
    // This ensures we only show valid time slots that have actual shifts
    // Dispatcher assignments with incorrect times (from before timezone fix) will be hidden
    const timeBlocksMap = new Map<string, TimeBlock>();
    for (const { shift, startHour, endHour, timeBlockKey } of shiftsWithHours) {
      if (!timeBlocksMap.has(timeBlockKey)) {
        timeBlocksMap.set(timeBlockKey, {
          startTime: `${startHour}:00`,
          endTime: `${endHour}:00`,
          label: `${formatHour(startHour)} - ${formatHour(endHour)}`,
          startTimeUTC: shift.startTime.toISOString(),
          endTimeUTC: shift.endTime.toISOString(),
        });
      }
    }
    // Note: We no longer create time blocks from dispatcher assignments
    // This prevents orphaned time blocks from bad data

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

    // BUILD LOOKUP MAPS for O(1) access instead of O(n) filtering in loops
    // This is the KEY optimization - changes O(n³) to O(n)

    // Map for shifts by zone: `${zoneId}-${date}-${timeBlockKey}` -> ShiftWithHours[]
    const shiftsByZoneDateTime = new Map<string, ShiftWithHours[]>();
    for (const shiftData of shiftsWithHours) {
      const key = `${shiftData.shift.zoneId}-${shiftData.dateStr}-${shiftData.timeBlockKey}`;
      const existing = shiftsByZoneDateTime.get(key) || [];
      existing.push(shiftData);
      shiftsByZoneDateTime.set(key, existing);
    }

    // Map for dispatchers: `${county}-${date}-${timeBlockKey}` -> DispatcherWithHours[]
    const dispatchersByCountyDateTime = new Map<string, DispatcherWithHours[]>();
    for (const dispatcherData of dispatchersWithHours) {
      const key = `${dispatcherData.assignment.county}-${dispatcherData.dateStr}-${dispatcherData.timeBlockKey}`;
      const existing = dispatchersByCountyDateTime.get(key) || [];
      existing.push(dispatcherData);
      dispatchersByCountyDateTime.set(key, existing);
    }

    // Group zones by county for quick lookup
    const zonesByCounty = new Map<string, typeof zones>();
    for (const zone of zones) {
      if (zone.county) {
        const existing = zonesByCounty.get(zone.county) || [];
        existing.push(zone);
        zonesByCounty.set(zone.county, existing);
      }
    }

    // Build schedule data using O(1) Map lookups
    const schedule: CellData[] = [];
    const targetCounties = county && county !== 'all' ? [county] : counties;

    for (const countyName of targetCounties) {
      const countyZones = zonesByCounty.get(countyName) || [];

      for (const date of dates) {
        for (const timeBlock of timeBlocks) {
          const startHour = parseInt(timeBlock.startTime);
          const endHour = parseInt(timeBlock.endTime);
          const timeBlockKey = `${startHour}-${endHour}`;

          // O(1) lookup for dispatchers (was O(n) filter)
          const dispatcherKey = `${countyName}-${date}-${timeBlockKey}`;
          const dispatchers = dispatchersByCountyDateTime.get(dispatcherKey) || [];

          const primaryDispatcher = dispatchers.find(d => !d.assignment.isBackup);
          const backupDispatchers = dispatchers.filter(d => d.assignment.isBackup);

          // Build zone data using O(1) lookups
          const zoneDataList: ZoneData[] = [];

          for (const zone of countyZones) {
            // O(1) lookup for shifts in this zone (was O(n) filter)
            const zoneShiftKey = `${zone.id}-${date}-${timeBlockKey}`;
            const zoneShiftData = shiftsByZoneDateTime.get(zoneShiftKey) || [];

            // Aggregate volunteers across shifts
            const allVolunteers: ZoneData['volunteers'] = [];
            const zoneLeads: ZoneData['zoneLeads'] = [];

            for (const { shift } of zoneShiftData) {
              for (const v of shift.volunteers) {
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
              }
            }

            if (zoneShiftData.length > 0 || zoneLeads.length > 0 || allVolunteers.length > 0) {
              zoneDataList.push({
                zoneId: zone.id,
                zoneName: zone.name,
                zoneLeads,
                volunteers: allVolunteers,
                shifts: zoneShiftData.map(({ shift }) => ({
                  id: shift.id,
                  title: shift.title,
                  type: shift.type,
                  typeConfigName: shift.typeConfig?.name || null,
                })),
              });
            }
          }

          // Calculate coverage based on dispatcher scheduling mode
          let coverage: 'full' | 'partial' | 'none' = 'none';
          const hasDispatcher = !!primaryDispatcher;
          const zonesWithShifts = zoneDataList.filter(z => z.shifts.length > 0);
          const zonesNeedingLeads = zonesWithShifts
            .filter(z => z.zoneLeads.length === 0)
            .map(z => z.zoneName);
          const zonesWithLeads = zonesWithShifts.filter(z => z.zoneLeads.length > 0);
          const allZonesHaveLeads = zonesWithShifts.length > 0 && zonesNeedingLeads.length === 0;

          if (dispatcherSchedulingMode === 'ZONE') {
            // ZONE mode: Cell coverage = dispatcher + zone leads
            if (hasDispatcher && allZonesHaveLeads) {
              coverage = 'full';
            } else if (hasDispatcher || zonesWithShifts.length > 0) {
              coverage = 'partial';
            }
          } else {
            // COUNTY/REGIONAL mode: Cell coverage = zone leads only (dispatcher shown in separate row)
            if (zonesWithShifts.length > 0) {
              if (allZonesHaveLeads) {
                coverage = 'full';
              } else if (zonesWithLeads.length > 0) {
                coverage = 'partial';
              } else {
                // Has shifts but no zone leads
                coverage = 'none';
              }
            }
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
                    id: primaryDispatcher.assignment.user.id,
                    name: primaryDispatcher.assignment.user.name,
                    assignmentId: primaryDispatcher.assignment.id,
                    isBackup: false,
                    notes: primaryDispatcher.assignment.notes,
                  }
                : null,
              backupDispatchers: backupDispatchers.map(d => ({
                id: d.assignment.user.id,
                name: d.assignment.user.name,
                assignmentId: d.assignment.id,
                notes: d.assignment.notes,
              })),
              zones: zoneDataList,
              coverage,
              gaps,
            });
          }
        }
      }
    }

    // Build regional dispatchers array (for REGIONAL mode UI)
    const regionalDispatchersMap = new Map<string, DispatcherWithHours[]>();
    for (const dispatcherData of regionalDispatchersWithHours) {
      const key = `${dispatcherData.dateStr}-${dispatcherData.timeBlockKey}`;
      const existing = regionalDispatchersMap.get(key) || [];
      existing.push(dispatcherData);
      regionalDispatchersMap.set(key, existing);
    }

    // Build county dispatchers by date (for COUNTY mode UI)
    // Groups dispatchers by county+date, showing one per day
    const countyDispatchersByDate = new Map<string, DispatcherWithHours[]>();
    for (const dispatcherData of dispatchersWithHours) {
      const key = `${dispatcherData.assignment.county}-${dispatcherData.dateStr}`;
      const existing = countyDispatchersByDate.get(key) || [];
      existing.push(dispatcherData);
      countyDispatchersByDate.set(key, existing);
    }

    // Format regional dispatchers for response
    const regionalDispatchers: Array<{
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
      coverage: 'full' | 'none';
    }> = [];

    // Only populate if in REGIONAL mode
    if (dispatcherSchedulingMode === 'REGIONAL') {
      for (const date of dates) {
        for (const timeBlock of timeBlocks) {
          const startHour = parseInt(timeBlock.startTime);
          const endHour = parseInt(timeBlock.endTime);
          const timeBlockKey = `${startHour}-${endHour}`;
          const key = `${date}-${timeBlockKey}`;
          const dispatchers = regionalDispatchersMap.get(key) || [];

          const primaryDispatcher = dispatchers.find(d => !d.assignment.isBackup);
          const backupDispatchersList = dispatchers.filter(d => d.assignment.isBackup);

          regionalDispatchers.push({
            date,
            timeBlock,
            dispatcher: primaryDispatcher
              ? {
                  id: primaryDispatcher.assignment.user.id,
                  name: primaryDispatcher.assignment.user.name,
                  assignmentId: primaryDispatcher.assignment.id,
                  isBackup: false,
                  notes: primaryDispatcher.assignment.notes,
                }
              : null,
            backupDispatchers: backupDispatchersList.map(d => ({
              id: d.assignment.user.id,
              name: d.assignment.user.name,
              assignmentId: d.assignment.id,
              notes: d.assignment.notes,
            })),
            coverage: primaryDispatcher ? 'full' : 'none',
          });
        }
      }
    }

    // Format county dispatchers for response (for COUNTY mode)
    // Now includes timeBlock data for per-time-block assignments
    const countyDispatchers: Array<{
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
      coverage: 'full' | 'none';
    }> = [];

    // Only populate if in COUNTY mode
    if (dispatcherSchedulingMode === 'COUNTY') {
      const targetCounties = county && county !== 'all' ? [county] : counties;
      for (const countyName of targetCounties) {
        for (const date of dates) {
          for (const timeBlock of timeBlocks) {
            const startHour = parseInt(timeBlock.startTime);
            const endHour = parseInt(timeBlock.endTime);
            const timeBlockKey = `${startHour}-${endHour}`;
            const key = `${countyName}-${date}-${timeBlockKey}`;
            const dispatchers = dispatchersByCountyDateTime.get(key) || [];

            const primaryDispatcher = dispatchers.find(d => !d.assignment.isBackup);
            const backupDispatchersList = dispatchers.filter(d => d.assignment.isBackup);

            countyDispatchers.push({
              county: countyName,
              date,
              timeBlock,
              dispatcher: primaryDispatcher
                ? {
                    id: primaryDispatcher.assignment.user.id,
                    name: primaryDispatcher.assignment.user.name,
                    assignmentId: primaryDispatcher.assignment.id,
                    isBackup: false,
                    notes: primaryDispatcher.assignment.notes,
                  }
                : null,
              backupDispatchers: backupDispatchersList.map(d => ({
                id: d.assignment.user.id,
                name: d.assignment.user.name,
                assignmentId: d.assignment.id,
                notes: d.assignment.notes,
              })),
              coverage: primaryDispatcher ? 'full' : 'none',
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
      dispatcherSchedulingMode,
      schedulingMode,
      regionalDispatchers,
      countyDispatchers,
      regionalLeads: regionalLeadAssignments.map(a => ({
        id: a.id,
        userId: a.user.id,
        userName: a.user.name,
        date: a.date.toISOString().split('T')[0],
        isPrimary: a.isPrimary,
        notes: a.notes,
      })),
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
