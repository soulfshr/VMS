import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/profile/availability - Get user's availability
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const availability = await prisma.availability.findMany({
      where: { userId: user.id },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

// PUT /api/profile/availability - Update user's weekly availability
export async function PUT(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { availability } = body;

    if (!Array.isArray(availability)) {
      return NextResponse.json(
        { error: 'Availability must be an array' },
        { status: 400 }
      );
    }

    // Delete existing weekly availability (not specific date exceptions)
    await prisma.availability.deleteMany({
      where: {
        userId: user.id,
        specificDate: null,
      },
    });

    // Create new availability entries
    if (availability.length > 0) {
      await prisma.availability.createMany({
        data: availability.map((slot: {
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          notes?: string;
        }) => ({
          userId: user.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          notes: slot.notes || null,
        })),
      });
    }

    // Fetch and return updated availability
    const updatedAvailability = await prisma.availability.findMany({
      where: { userId: user.id },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json(updatedAvailability);
  } catch (error) {
    console.error('Error updating availability:', error);
    return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 });
  }
}
