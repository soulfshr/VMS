import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/profile/zones - Get user's zone assignments
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userZones = await prisma.userZone.findMany({
      where: { userId: user.id },
      include: {
        zone: true,
      },
    });

    return NextResponse.json(userZones);
  } catch (error) {
    console.error('Error fetching user zones:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}

// PUT /api/profile/zones - Update user's zone preferences
export async function PUT(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { zoneIds, primaryZoneId } = body;

    if (!Array.isArray(zoneIds)) {
      return NextResponse.json(
        { error: 'zoneIds must be an array' },
        { status: 400 }
      );
    }

    // Delete existing zone assignments
    await prisma.userZone.deleteMany({
      where: { userId: user.id },
    });

    // Create new zone assignments
    if (zoneIds.length > 0) {
      await prisma.userZone.createMany({
        data: zoneIds.map((zoneId: string) => ({
          userId: user.id,
          zoneId,
          isPrimary: zoneId === primaryZoneId,
        })),
      });
    }

    // Fetch and return updated zones
    const userZones = await prisma.userZone.findMany({
      where: { userId: user.id },
      include: {
        zone: true,
      },
    });

    return NextResponse.json(userZones);
  } catch (error) {
    console.error('Error updating zones:', error);
    return NextResponse.json({ error: 'Failed to update zones' }, { status: 500 });
  }
}
