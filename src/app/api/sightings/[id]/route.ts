import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { SightingStatus } from '@/generated/prisma/enums';

// GET /api/sightings/[id] - Get a single sighting (requires authentication)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only dispatchers, coordinators, and admins can view sightings
    const allowedRoles = ['DISPATCHER', 'COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const sighting = await prisma.iceSighting.findUnique({
      where: { id },
      include: {
        media: true,
      },
    });

    if (!sighting) {
      return NextResponse.json({ error: 'Sighting not found' }, { status: 404 });
    }

    return NextResponse.json(sighting);
  } catch (error) {
    console.error('[Sightings] Error fetching sighting:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sighting' },
      { status: 500 }
    );
  }
}

// PATCH /api/sightings/[id] - Update a sighting (status, notes, assignment)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only dispatchers, coordinators, and admins can update sightings
    const allowedRoles = ['DISPATCHER', 'COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const { status, notes, assignedToId } = body;

    // Validate status if provided
    if (status && !Object.values(SightingStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const sighting = await prisma.iceSighting.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(assignedToId !== undefined && { assignedToId }),
      },
      include: {
        media: true,
      },
    });

    return NextResponse.json(sighting);
  } catch (error) {
    console.error('[Sightings] Error updating sighting:', error);
    return NextResponse.json(
      { error: 'Failed to update sighting' },
      { status: 500 }
    );
  }
}
