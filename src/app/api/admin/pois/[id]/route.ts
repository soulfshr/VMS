import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/pois/[id] - Get single POI
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const poi = await prisma.pointOfInterest.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            county: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    return NextResponse.json(poi);
  } catch (error) {
    console.error('Error fetching POI:', error);
    return NextResponse.json({ error: 'Failed to fetch POI' }, { status: 500 });
  }
}

// PUT /api/admin/pois/[id] - Update POI
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if POI exists
    const existing = await prisma.pointOfInterest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      address?: string | null;
      latitude?: number;
      longitude?: number;
      phone?: string | null;
      website?: string | null;
      notes?: string | null;
      categoryId?: string;
      zoneId?: string | null;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (body.address !== undefined) {
      updateData.address = body.address || null;
    }

    if (body.latitude !== undefined) {
      updateData.latitude = body.latitude;
    }

    if (body.longitude !== undefined) {
      updateData.longitude = body.longitude;
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone || null;
    }

    if (body.website !== undefined) {
      updateData.website = body.website || null;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    if (body.categoryId !== undefined) {
      // Verify category exists
      const category = await prisma.pOICategory.findUnique({
        where: { id: body.categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { error: 'Invalid category' },
          { status: 400 }
        );
      }
      updateData.categoryId = body.categoryId;
    }

    if (body.zoneId !== undefined) {
      if (body.zoneId) {
        // Verify zone exists
        const zone = await prisma.zone.findUnique({
          where: { id: body.zoneId },
        });

        if (!zone) {
          return NextResponse.json(
            { error: 'Invalid zone' },
            { status: 400 }
          );
        }
        updateData.zoneId = body.zoneId;
      } else {
        updateData.zoneId = null;
      }
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    const poi = await prisma.pointOfInterest.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            county: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(poi);
  } catch (error) {
    console.error('Error updating POI:', error);
    return NextResponse.json({ error: 'Failed to update POI' }, { status: 500 });
  }
}

// DELETE /api/admin/pois/[id] - Delete POI
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const poi = await prisma.pointOfInterest.findUnique({
      where: { id },
    });

    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    // Delete the POI (no soft delete needed for POIs)
    await prisma.pointOfInterest.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'POI deleted',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting POI:', error);
    return NextResponse.json({ error: 'Failed to delete POI' }, { status: 500 });
  }
}
