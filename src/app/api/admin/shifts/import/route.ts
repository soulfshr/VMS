import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface ShiftImportData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  zone: string;
  type: string;
  description?: string;
  meetingLocation?: string;
  minVolunteers?: string;
  idealVolunteers?: string;
  maxVolunteers?: string;
  status?: string;
}

// Parse date string to Date object
function parseDate(value: string): Date | null {
  if (!value) return null;

  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
  ];

  for (const format of formats) {
    const match = value.match(format);
    if (match) {
      if (format === formats[0]) {
        return new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
      } else if (format === formats[1]) {
        return new Date(Date.UTC(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2])));
      } else if (format === formats[2]) {
        const year = parseInt(match[3]) + 2000;
        return new Date(Date.UTC(year, parseInt(match[1]) - 1, parseInt(match[2])));
      }
    }
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Parse time string to hours and minutes
function parseTime(value: string): { hours: number; minutes: number } | null {
  if (!value) return null;

  const timeMatch = value.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();

    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  return null;
}

// Map shift type name to enum value
const SHIFT_TYPE_MAP: Record<string, string> = {
  'patrol': 'PATROL',
  'collection': 'COLLECTION',
  'on-call field support': 'ON_CALL_FIELD_SUPPORT',
  'on_call_field_support': 'ON_CALL_FIELD_SUPPORT',
  'oncall': 'ON_CALL_FIELD_SUPPORT',
  'on call': 'ON_CALL_FIELD_SUPPORT',
};

// POST /api/admin/shifts/import - Bulk import shifts
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { shifts } = body as { shifts: ShiftImportData[] };

    if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json({ error: 'No shifts data provided' }, { status: 400 });
    }

    // Load zones and shift types for validation
    const [zones, shiftTypes] = await Promise.all([
      prisma.zone.findMany({ where: { isActive: true } }),
      prisma.shiftTypeConfig.findMany({ where: { isActive: true } }),
    ]);

    const zoneMap = new Map(zones.map(z => [z.name.toLowerCase(), z]));
    const shiftTypeMap = new Map(shiftTypes.map(t => [t.name.toLowerCase(), t]));

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; errors: string[] }[],
    };

    // Process each shift
    for (let i = 0; i < shifts.length; i++) {
      const shiftData = shifts[i];
      const rowNumber = i + 2; // Account for header row and 0-index
      const errors: string[] = [];

      try {
        // Validate and transform data
        const title = shiftData.title?.trim();
        if (!title) {
          errors.push('Title is required');
        }

        // Parse date
        const date = parseDate(shiftData.date);
        if (!date) {
          errors.push('Invalid date format');
        }

        // Parse times
        const startTimeParts = parseTime(shiftData.startTime);
        const endTimeParts = parseTime(shiftData.endTime);

        if (!startTimeParts) {
          errors.push('Invalid start time format');
        }
        if (!endTimeParts) {
          errors.push('Invalid end time format');
        }

        // Validate times order
        if (startTimeParts && endTimeParts) {
          const startMins = startTimeParts.hours * 60 + startTimeParts.minutes;
          const endMins = endTimeParts.hours * 60 + endTimeParts.minutes;
          if (endMins <= startMins) {
            errors.push('End time must be after start time');
          }
        }

        // Find zone
        const zoneName = shiftData.zone?.trim().toLowerCase();
        const zone = zoneName ? zoneMap.get(zoneName) : null;
        if (!zone) {
          errors.push(`Zone "${shiftData.zone}" not found`);
        }

        // Determine shift type
        let shiftType: string | null = null;
        let typeConfig = null;

        const typeName = shiftData.type?.trim().toLowerCase();
        if (typeName) {
          // First try to match against ShiftTypeConfig
          typeConfig = shiftTypeMap.get(typeName);
          if (typeConfig) {
            // Map the slug to the enum value
            shiftType = SHIFT_TYPE_MAP[typeConfig.slug.toLowerCase()] || 'PATROL';
          } else {
            // Try to match against enum directly
            shiftType = SHIFT_TYPE_MAP[typeName];
          }
        }

        if (!shiftType) {
          errors.push(`Shift type "${shiftData.type}" not recognized`);
        }

        // Parse volunteer counts
        const minVolunteers = shiftData.minVolunteers ? parseInt(shiftData.minVolunteers) : 2;
        const idealVolunteers = shiftData.idealVolunteers ? parseInt(shiftData.idealVolunteers) : 4;
        const maxVolunteers = shiftData.maxVolunteers ? parseInt(shiftData.maxVolunteers) : 6;

        if (isNaN(minVolunteers) || minVolunteers < 1) {
          errors.push('Invalid min volunteers');
        }
        if (isNaN(idealVolunteers) || idealVolunteers < 1) {
          errors.push('Invalid ideal volunteers');
        }
        if (isNaN(maxVolunteers) || maxVolunteers < 1) {
          errors.push('Invalid max volunteers');
        }
        if (minVolunteers > idealVolunteers) {
          errors.push('Min volunteers cannot exceed ideal');
        }
        if (idealVolunteers > maxVolunteers) {
          errors.push('Ideal volunteers cannot exceed max');
        }

        // Parse status
        const validStatuses = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        let status = shiftData.status?.toUpperCase() || 'DRAFT';
        if (!validStatuses.includes(status)) {
          errors.push(`Invalid status "${shiftData.status}"`);
          status = 'DRAFT';
        }

        // If validation errors, skip this row
        if (errors.length > 0) {
          results.failed++;
          results.errors.push({ row: rowNumber, errors });
          continue;
        }

        // Build start and end DateTime
        const startTime = new Date(date!);
        startTime.setUTCHours(startTimeParts!.hours, startTimeParts!.minutes, 0, 0);

        const endTime = new Date(date!);
        endTime.setUTCHours(endTimeParts!.hours, endTimeParts!.minutes, 0, 0);

        // Create the shift
        await prisma.shift.create({
          data: {
            title: title!,
            type: shiftType as 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT',
            typeConfigId: typeConfig?.id,
            description: shiftData.description?.trim() || null,
            date: date!,
            startTime,
            endTime,
            zoneId: zone!.id,
            meetingLocation: shiftData.meetingLocation?.trim() || null,
            minVolunteers,
            idealVolunteers,
            maxVolunteers,
            status: status as 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
            createdById: user.id,
          },
        });

        results.success++;
      } catch (err) {
        console.error(`Error importing shift at row ${rowNumber}:`, err);
        results.failed++;
        results.errors.push({
          row: rowNumber,
          errors: [err instanceof Error ? err.message : 'Unknown error'],
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in bulk shift import:', error);
    return NextResponse.json({ error: 'Failed to import shifts' }, { status: 500 });
  }
}
