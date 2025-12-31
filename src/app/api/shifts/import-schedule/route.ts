import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getOrgIdForCreate } from '@/lib/org-context';
import { parseScheduleDocx, scheduleToShifts } from '@/lib/schedule-parser';

interface ImportOptions {
  zoneId: string;
  shiftTypeId: string;
  shiftDurationMinutes?: number;
  offsetBeforeMinutes?: number;
  status?: 'DRAFT' | 'PUBLISHED';
}

// POST /api/shifts/import-schedule - Import shifts from a clinic schedule docx
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getOrgIdForCreate();

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const optionsJson = formData.get('options') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'File must be a .docx document' }, { status: 400 });
    }

    let options: ImportOptions;
    try {
      options = optionsJson ? JSON.parse(optionsJson) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid options format' }, { status: 400 });
    }

    if (!options.zoneId) {
      return NextResponse.json({ error: 'Zone is required' }, { status: 400 });
    }

    if (!options.shiftTypeId) {
      return NextResponse.json({ error: 'Shift type is required' }, { status: 400 });
    }

    // Validate zone exists and belongs to org
    const zone = await prisma.zone.findFirst({
      where: {
        id: options.zoneId,
        isActive: true,
        ...(orgId ? { organizationId: orgId } : {}),
      },
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // Validate shift type exists and belongs to org
    const shiftType = await prisma.shiftTypeConfig.findFirst({
      where: {
        id: options.shiftTypeId,
        isActive: true,
        ...(orgId ? { organizationId: orgId } : {}),
      },
    });

    if (!shiftType) {
      return NextResponse.json({ error: 'Shift type not found' }, { status: 404 });
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the schedule
    const schedule = await parseScheduleDocx(buffer);

    if (schedule.errors.length > 0 && schedule.days.length === 0) {
      return NextResponse.json({
        error: 'Failed to parse schedule',
        details: schedule.errors,
      }, { status: 400 });
    }

    // Convert to shifts
    const shiftsData = scheduleToShifts(schedule, {
      zoneName: zone.name,
      shiftType: shiftType.slug,
      shiftDurationMinutes: options.shiftDurationMinutes || 120,
      offsetBeforeMinutes: options.offsetBeforeMinutes || 30,
    });

    if (shiftsData.length === 0) {
      return NextResponse.json({
        error: 'No shifts found in schedule',
        details: schedule.errors,
        parsed: {
          month: schedule.month,
          year: schedule.year,
          locationCode: schedule.locationCode,
        },
      }, { status: 400 });
    }

    // Map the legacy shift type enum
    const SHIFT_TYPE_MAP: Record<string, 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT'> = {
      'patrol': 'PATROL',
      'collection': 'COLLECTION',
      'on-call-field-support': 'ON_CALL_FIELD_SUPPORT',
      'on_call_field_support': 'ON_CALL_FIELD_SUPPORT',
    };
    const legacyType = SHIFT_TYPE_MAP[shiftType.slug.toLowerCase()] || 'PATROL';

    // Create shifts in database
    const results = {
      success: 0,
      failed: 0,
      errors: [] as { date: string; error: string }[],
      shiftsCreated: [] as { id: string; title: string; date: string }[],
    };

    for (const shiftData of shiftsData) {
      try {
        // Create date at midnight UTC for the date field
        const dateOnly = new Date(Date.UTC(
          shiftData.date.getFullYear(),
          shiftData.date.getMonth(),
          shiftData.date.getDate()
        ));

        // Create start/end times in Eastern time zone
        // We need to convert local times to UTC for storage
        const startTime = new Date(Date.UTC(
          shiftData.date.getFullYear(),
          shiftData.date.getMonth(),
          shiftData.date.getDate(),
          shiftData.startTime.getHours(),
          shiftData.startTime.getMinutes(),
          0,
          0
        ));

        const endTime = new Date(Date.UTC(
          shiftData.date.getFullYear(),
          shiftData.date.getMonth(),
          shiftData.date.getDate(),
          shiftData.endTime.getHours(),
          shiftData.endTime.getMinutes(),
          0,
          0
        ));

        const shift = await prisma.shift.create({
          data: {
            title: shiftData.title,
            type: legacyType,
            typeConfigId: shiftType.id,
            date: dateOnly,
            startTime,
            endTime,
            zoneId: zone.id,
            organizationId: orgId,
            minVolunteers: shiftType.defaultMinVolunteers || 2,
            idealVolunteers: shiftType.defaultIdealVolunteers || 4,
            maxVolunteers: shiftType.defaultMaxVolunteers || 6,
            status: options.status || 'DRAFT',
            createdById: user.id,
          },
        });

        results.success++;
        results.shiftsCreated.push({
          id: shift.id,
          title: shift.title,
          date: dateOnly.toISOString().split('T')[0],
        });
      } catch (err) {
        results.failed++;
        results.errors.push({
          date: shiftData.date.toISOString().split('T')[0],
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${results.success} shifts`,
      parsed: {
        month: schedule.month + 1, // Convert to 1-indexed for display
        year: schedule.year,
        locationCode: schedule.locationCode,
        daysFound: schedule.days.length,
      },
      results,
      warnings: schedule.errors,
    });
  } catch (error) {
    console.error('Error in schedule import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import schedule' },
      { status: 500 }
    );
  }
}
