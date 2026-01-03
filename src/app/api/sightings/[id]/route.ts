import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { SightingStatus, SightingDisposition } from '@/generated/prisma/enums';
import { getCurrentOrgId } from '@/lib/org-context';
import { hasElevatedPrivileges, createPermissionContext } from '@/lib/permissions';

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
    const ctx = createPermissionContext(user.role);
    if (!hasElevatedPrivileges(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const sighting = await prisma.iceSighting.findFirst({
      where: {
        id,
        ...orgFilter,
      },
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

// PATCH /api/sightings/[id] - Update a sighting (status, disposition, notes, assignment)
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
    const ctx = createPermissionContext(user.role);
    if (!hasElevatedPrivileges(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const body = await request.json();

    const {
      status,
      disposition,
      notes,
      assignedToId,
      // SALUTE fields
      size,
      activity,
      location,
      uniform,
      equipment,
      observedAt,
    } = body;

    // Validate status if provided
    if (status && !Object.values(SightingStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Validate disposition if provided
    if (disposition && !Object.values(SightingDisposition).includes(disposition)) {
      return NextResponse.json(
        { error: 'Invalid disposition' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;

    // SALUTE fields - only allow editing for non-closed sightings
    // Check if sighting exists and belongs to current org
    const existingSighting = await prisma.iceSighting.findFirst({
      where: {
        id,
        ...orgFilter,
      },
      select: { status: true },
    });

    if (!existingSighting) {
      return NextResponse.json({ error: 'Sighting not found' }, { status: 404 });
    }

    // Allow SALUTE edits only for active sightings (not closed)
    if (existingSighting.status !== SightingStatus.CLOSED) {
      if (size !== undefined) updateData.size = size;
      if (activity !== undefined) updateData.activity = activity;
      if (location !== undefined) updateData.location = location;
      if (uniform !== undefined) updateData.uniform = uniform;
      if (equipment !== undefined) updateData.equipment = equipment;
      if (observedAt !== undefined) updateData.observedAt = new Date(observedAt);
    }

    // Handle disposition - auto-close when disposition is set
    if (disposition) {
      updateData.disposition = disposition;
      // Auto-set status to CLOSED when a disposition is set
      updateData.status = SightingStatus.CLOSED;
    }

    const sighting = await prisma.iceSighting.update({
      where: { id },
      data: updateData,
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
