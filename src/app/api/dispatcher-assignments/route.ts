import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/dispatcher-assignments - List dispatcher assignments with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const county = searchParams.get('county');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filter conditions
    const where: Record<string, unknown> = {};

    if (county && county !== 'all') {
      where.county = county;
    }

    if (startDate) {
      where.date = {
        ...((where.date as object) || {}),
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.date = {
        ...((where.date as object) || {}),
        lte: new Date(endDate),
      };
    }

    const assignments = await prisma.dispatcherAssignment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching dispatcher assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch dispatcher assignments' }, { status: 500 });
  }
}

// POST /api/dispatcher-assignments - Create a new dispatcher assignment (Coordinator/Admin only)
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

    const body = await request.json();
    const {
      userId,
      county,
      date,
      startTime,
      endTime,
      isBackup = false,
      notes,
    } = body;

    // Validate required fields
    if (!userId || !county || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create the assignment
    const assignment = await prisma.dispatcherAssignment.create({
      data: {
        userId,
        county,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isBackup,
        notes,
        createdById: user.id,
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

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error creating dispatcher assignment:', error);
    // Check for unique constraint violation
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Dispatcher already assigned to this time block' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create dispatcher assignment' }, { status: 500 });
  }
}
