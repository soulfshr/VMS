import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditUpdate, auditDelete, toAuditUser } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/zones/[id] - Get single zone
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const zone = await prisma.zone.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            shifts: true,
          },
        },
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

// PUT /api/admin/zones/[id] - Update zone
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, county, description, signalGroup, isActive, color, fillOpacity, strokeWeight, boundaries } = body;

    // Check if zone exists
    const existing = await prisma.zone.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // Check for duplicate name (excluding current)
    if (name && name !== existing.name) {
      const duplicate = await prisma.zone.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Zone with this name already exists' }, { status: 400 });
      }
    }

    const zone = await prisma.zone.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(county !== undefined && { county }),
        ...(description !== undefined && { description }),
        ...(signalGroup !== undefined && { signalGroup }),
        ...(isActive !== undefined && { isActive }),
        ...(color !== undefined && { color }),
        ...(fillOpacity !== undefined && { fillOpacity }),
        ...(strokeWeight !== undefined && { strokeWeight }),
        ...(boundaries !== undefined && { boundaries }),
      },
    });

    // Audit log the zone update
    await auditUpdate(
      toAuditUser(user),
      'Zone',
      zone.id,
      existing as unknown as Record<string, unknown>,
      zone as unknown as Record<string, unknown>
    );

    return NextResponse.json(zone);
  } catch (error) {
    console.error('Error updating zone:', error);
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 });
  }
}

// DELETE /api/admin/zones/[id] - Archive (soft delete) zone
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Check if zone exists
    const existing = await prisma.zone.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            shifts: true,
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // If no users or shifts use this zone, hard delete; otherwise soft delete
    if (existing._count.users === 0 && existing._count.shifts === 0) {
      await prisma.zone.delete({
        where: { id },
      });

      // Audit log the hard delete
      await auditDelete(
        toAuditUser(user),
        'Zone',
        id,
        existing as unknown as Record<string, unknown>
      );

      return NextResponse.json({ message: 'Zone deleted' });
    } else {
      // Soft delete - just mark as inactive
      const archived = await prisma.zone.update({
        where: { id },
        data: { isActive: false },
      });

      // Audit log the archive (soft delete)
      await auditUpdate(
        toAuditUser(user),
        'Zone',
        id,
        existing as unknown as Record<string, unknown>,
        archived as unknown as Record<string, unknown>
      );

      return NextResponse.json({ message: 'Zone archived (has existing users or shifts)' });
    }
  } catch (error) {
    console.error('Error deleting zone:', error);
    return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 });
  }
}
