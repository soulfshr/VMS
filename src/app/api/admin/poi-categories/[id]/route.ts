import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/poi-categories/[id] - Get single POI category with stats
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    const category = await prisma.pOICategory.findFirst({
      where: {
        id,
        ...orgFilter,
      },
      include: {
        _count: {
          select: {
            pois: true,
          },
        },
        pois: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            address: true,
            isActive: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'POI category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching POI category:', error);
    return NextResponse.json({ error: 'Failed to fetch POI category' }, { status: 500 });
  }
}

// PUT /api/admin/poi-categories/[id] - Update POI category
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    // Check if category exists (scoped to org)
    const existing = await prisma.pOICategory.findFirst({
      where: {
        id,
        ...orgFilter,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'POI category not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      color?: string;
      icon?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    } = {};

    if (body.name !== undefined) {
      // Check for duplicate name
      const duplicate = await prisma.pOICategory.findFirst({
        where: {
          name: body.name,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A POI category with this name already exists' },
          { status: 400 }
        );
      }
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (body.color !== undefined) {
      updateData.color = body.color;
    }

    if (body.icon !== undefined) {
      updateData.icon = body.icon || null;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    const category = await prisma.pOICategory.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            pois: true,
          },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating POI category:', error);
    return NextResponse.json({ error: 'Failed to update POI category' }, { status: 500 });
  }
}

// DELETE /api/admin/poi-categories/[id] - Delete/archive POI category
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    // Check usage (scoped to org)
    const category = await prisma.pOICategory.findFirst({
      where: {
        id,
        ...orgFilter,
      },
      include: {
        _count: {
          select: {
            pois: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'POI category not found' }, { status: 404 });
    }

    if (category._count.pois > 0) {
      // Archive instead of delete
      await prisma.pOICategory.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: 'POI category archived (has associated POIs)',
        archived: true,
        poiCount: category._count.pois,
      });
    }

    // Safe to delete
    await prisma.pOICategory.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'POI category deleted',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting POI category:', error);
    return NextResponse.json({ error: 'Failed to delete POI category' }, { status: 500 });
  }
}
