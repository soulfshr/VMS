import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';
import { isAdmin, createPermissionContext } from '@/lib/permissions';

// GET /api/zones/[id] - Get a single zone
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const zone = await prisma.zone.findFirst({
      where: {
        id,
        ...orgFilter,
      },
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    return NextResponse.json(zone);
  } catch (error) {
    console.error('Error fetching zone:', error);
    return NextResponse.json({ error: 'Failed to fetch zone' }, { status: 500 });
  }
}

// PATCH /api/zones/[id] - Update a zone (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!isAdmin(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const body = await request.json();

    // Check if zone exists and belongs to current org
    const existingZone = await prisma.zone.findFirst({
      where: {
        id,
        ...orgFilter,
      },
    });

    if (!existingZone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.county !== undefined) updateData.county = body.county;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.signalGroup !== undefined) updateData.signalGroup = body.signalGroup;
    if (body.boundaries !== undefined) updateData.boundaries = body.boundaries;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.fillOpacity !== undefined) updateData.fillOpacity = body.fillOpacity;
    if (body.strokeWeight !== undefined) updateData.strokeWeight = body.strokeWeight;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const zone = await prisma.zone.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(zone);
  } catch (error) {
    console.error('Error updating zone:', error);
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 });
  }
}

// DELETE /api/zones/[id] - Delete a zone (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!isAdmin(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Check if zone exists and belongs to current org
    const existingZone = await prisma.zone.findFirst({
      where: {
        id,
        ...orgFilter,
      },
    });

    if (!existingZone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // Check if zone has any associated data
    const [userCount, shiftCount] = await Promise.all([
      prisma.userZone.count({ where: { zoneId: id } }),
      prisma.shift.count({ where: { zoneId: id } }),
    ]);

    if (userCount > 0 || shiftCount > 0) {
      // Soft delete - just mark as inactive
      const zone = await prisma.zone.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        ...zone,
        _warning: 'Zone has associated data. Marked as inactive instead of deleted.'
      });
    }

    // Hard delete if no associated data
    await prisma.zone.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting zone:', error);
    return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 });
  }
}
