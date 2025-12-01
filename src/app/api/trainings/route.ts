import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/trainings - List training sessions with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const typeId = searchParams.get('typeId');
    const status = searchParams.get('status') || 'PUBLISHED';
    const zoneId = searchParams.get('zoneId');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (typeId && typeId !== 'all') {
      where.trainingTypeId = typeId;
    }

    if (status !== 'all') {
      where.status = status;
    }

    if (zoneId && zoneId !== 'all') {
      where.zoneId = zoneId;
    }

    const sessions = await prisma.trainingSession.findMany({
      where,
      include: {
        trainingType: true,
        zone: true,
        createdBy: {
          select: { id: true, name: true },
        },
        attendees: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Add computed fields
    const sessionsWithCounts = sessions.map(session => ({
      ...session,
      confirmedCount: session.attendees.filter(a => a.status === 'CONFIRMED').length,
      pendingCount: session.attendees.filter(a => a.status === 'PENDING').length,
      spotsLeft: session.maxAttendees - session.attendees.filter(a => a.status === 'CONFIRMED').length,
    }));

    return NextResponse.json(sessionsWithCounts);
  } catch (error) {
    console.error('Error fetching training sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch training sessions' }, { status: 500 });
  }
}

// POST /api/trainings - Create training session (Coordinator/Admin)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can create training sessions
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      trainingTypeId,
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      meetingLink,
      zoneId,
      minAttendees,
      maxAttendees,
      status,
    } = body;

    // Validate required fields
    if (!trainingTypeId || !title || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: trainingTypeId, title, date, startTime, endTime' },
        { status: 400 }
      );
    }

    // Verify training type exists
    const trainingType = await prisma.trainingType.findUnique({
      where: { id: trainingTypeId },
    });
    if (!trainingType) {
      return NextResponse.json({ error: 'Training type not found' }, { status: 404 });
    }

    const session = await prisma.trainingSession.create({
      data: {
        trainingTypeId,
        title,
        description: description || null,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: location || null,
        meetingLink: meetingLink || null,
        zoneId: zoneId || null,
        minAttendees: minAttendees ?? trainingType.defaultCapacity,
        maxAttendees: maxAttendees ?? trainingType.defaultCapacity,
        status: status || 'DRAFT',
        createdById: user.id,
      },
      include: {
        trainingType: true,
        zone: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating training session:', error);
    return NextResponse.json({ error: 'Failed to create training session' }, { status: 500 });
  }
}
