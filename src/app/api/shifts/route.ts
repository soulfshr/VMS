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

    // Only show future shifts by default
    where.date = {
      gte: new Date(),
    };

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
      const confirmedCount = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
      const pendingCount = shift.volunteers.filter(v => v.status === 'PENDING').length;
      const userRsvp = shift.volunteers.find(v => v.userId === user.id);

      return {
        ...shift,
        confirmedCount,
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
    } = body;

    // Validate required fields
    if (!type || !title || !date || !startTime || !endTime || !zoneId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        type,
        title,
        description,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
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
