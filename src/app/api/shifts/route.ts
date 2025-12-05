import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/shifts - List shifts with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const zoneId = searchParams.get('zoneId');
    const status = searchParams.get('status') || 'PUBLISHED';
    const includeMyShifts = searchParams.get('myShifts') === 'true';

    // Build filter conditions
    const where: Record<string, unknown> = {};

    if (type && type !== 'all') {
      where.type = type;
    }

    if (zoneId && zoneId !== 'all') {
      where.zoneId = zoneId;
    }

    if (status !== 'all') {
      where.status = status;
    }

    // Only show future shifts by default (unless showing all for calendar)
    if (status !== 'all') {
      where.date = {
        gte: new Date(),
      };
    }

    const shifts = await prisma.shift.findMany({
      where,
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
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                countsTowardMinimum: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    // Transform to include computed fields
    const shiftsWithMeta = shifts.map(shift => {
      // Only count volunteers whose qualified role counts toward minimum (or have no role assigned)
      const countingVolunteers = shift.volunteers.filter(v =>
        v.status === 'CONFIRMED' && (v.qualifiedRole?.countsTowardMinimum !== false)
      );
      const confirmedCount = countingVolunteers.length;

      // Total confirmed (including non-counting roles like Shadowers)
      const totalConfirmed = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
      const pendingCount = shift.volunteers.filter(v => v.status === 'PENDING').length;
      const userRsvp = shift.volunteers.find(v => v.userId === user.id);

      return {
        ...shift,
        confirmedCount,        // Volunteers that count toward minimum
        totalConfirmed,        // All confirmed volunteers (including shadows)
        pendingCount,
        spotsLeft: shift.maxVolunteers - confirmedCount,
        userRsvpStatus: userRsvp?.status || null,
        userRsvpId: userRsvp?.id || null,
      };
    });

    // If requesting only user's shifts, filter
    if (includeMyShifts) {
      return NextResponse.json(
        shiftsWithMeta.filter(s => s.userRsvpStatus !== null)
      );
    }

    return NextResponse.json(shiftsWithMeta);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

// Helper: Calculate all shift dates based on repeat pattern
// Uses UTC methods consistently to ensure same behavior on local dev and Vercel
function calculateRepeatDates(
  startDate: Date,
  repeat: {
    frequency: 'daily' | 'weekly' | 'custom';
    days?: number[];
    endType: 'count' | 'date';
    count?: number;
    endDate?: string;
  }
): Date[] {
  const dates: Date[] = [new Date(startDate)];
  const endDate = repeat.endType === 'date' && repeat.endDate
    ? new Date(repeat.endDate)
    : null;
  const maxCount = repeat.endType === 'count' ? (repeat.count || 4) : 52; // Max 52 weeks

  let current = new Date(startDate);

  while (dates.length < maxCount) {
    if (repeat.frequency === 'daily') {
      current = new Date(current);
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (repeat.frequency === 'weekly') {
      current = new Date(current);
      current.setUTCDate(current.getUTCDate() + 7);
    } else if (repeat.frequency === 'custom' && repeat.days && repeat.days.length > 0) {
      // Find next matching day of week (using UTC day to match client's day selection)
      current = new Date(current);
      let found = false;
      for (let i = 1; i <= 7 && !found; i++) {
        current.setUTCDate(current.getUTCDate() + 1);
        if (repeat.days.includes(current.getUTCDay())) {
          found = true;
        }
      }
      if (!found) break;
    } else {
      break;
    }

    // Check end date
    if (endDate && current > endDate) break;

    dates.push(new Date(current));
  }

  return dates;
}

// POST /api/shifts - Create a new shift (Coordinator/Admin only)
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
    const {
      type,
      title,
      description,
      date,
      startTime,
      endTime,
      zoneId,
      meetingLocation,
      minVolunteers = 2,
      idealVolunteers = 4,
      maxVolunteers = 6,
      status = 'DRAFT',
      repeat,
    } = body;

    // Validate required fields
    if (!type || !title || !date || !startTime || !endTime || !zoneId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const baseDate = new Date(date);
    const baseStartTime = new Date(startTime);
    const baseEndTime = new Date(endTime);

    // Calculate time offsets from base date using UTC methods for consistent behavior
    const startHour = baseStartTime.getUTCHours();
    const startMinute = baseStartTime.getUTCMinutes();
    const endHour = baseEndTime.getUTCHours();
    const endMinute = baseEndTime.getUTCMinutes();

    // If repeat is enabled, create multiple shifts
    if (repeat && repeat.frequency) {
      const shiftDates = calculateRepeatDates(baseDate, repeat);

      const shiftsData = shiftDates.map(shiftDate => {
        const shiftStartTime = new Date(shiftDate);
        shiftStartTime.setUTCHours(startHour, startMinute, 0, 0);

        const shiftEndTime = new Date(shiftDate);
        shiftEndTime.setUTCHours(endHour, endMinute, 0, 0);

        return {
          type,
          title,
          description,
          date: shiftDate,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          zoneId,
          meetingLocation,
          minVolunteers,
          idealVolunteers,
          maxVolunteers,
          status,
          createdById: user.id,
        };
      });

      // Create all shifts
      const result = await prisma.shift.createMany({
        data: shiftsData,
      });

      return NextResponse.json(
        { message: `Created ${result.count} shifts`, count: result.count },
        { status: 201 }
      );
    }

    // Single shift creation
    const shift = await prisma.shift.create({
      data: {
        type,
        title,
        description,
        date: baseDate,
        startTime: baseStartTime,
        endTime: baseEndTime,
        zoneId,
        meetingLocation,
        minVolunteers,
        idealVolunteers,
        maxVolunteers,
        status,
        createdById: user.id,
      },
      include: {
        zone: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
  }
}
