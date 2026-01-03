import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { hasElevatedPrivileges, canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/admin/poi-categories - List all POI categories
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!hasElevatedPrivileges(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const categories = await prisma.pOICategory.findMany({
      where: {
        ...orgFilter,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            pois: true,
          },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching POI categories:', error);
    return NextResponse.json({ error: 'Failed to fetch POI categories' }, { status: 500 });
  }
}

// POST /api/admin/poi-categories - Create new POI category
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, color, icon } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check for duplicate name or slug
    const existing = await prisma.pOICategory.findFirst({
      where: {
        OR: [{ name }, { slug: slug.toUpperCase() }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A POI category with this name or slug already exists' },
        { status: 400 }
      );
    }

    // Get max sort order
    const maxSort = await prisma.pOICategory.aggregate({
      _max: { sortOrder: true },
    });

    const orgId = await getOrgIdForCreate();

    const category = await prisma.pOICategory.create({
      data: {
        organizationId: orgId,
        name,
        slug: slug.toUpperCase(),
        description: description || null,
        color: color || '#6366f1',
        icon: icon || null,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
      include: {
        _count: {
          select: {
            pois: true,
          },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating POI category:', error);
    return NextResponse.json({ error: 'Failed to create POI category' }, { status: 500 });
  }
}
