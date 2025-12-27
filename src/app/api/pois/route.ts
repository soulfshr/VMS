import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/pois - Get active POIs for map display (authenticated users only)
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('category');
    const zoneId = searchParams.get('zone');

    const orgId = await getCurrentOrgId();

    // Strict org scoping - only show POIs for the current org
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    // Build where clause - only active POIs with active categories (scoped to org)
    const where: Record<string, unknown> = {
      isActive: true,
      category: {
        isActive: true,
      },
      ...orgFilter,
    };

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (zoneId) {
      if (zoneId === 'none') {
        where.zoneId = null;
      } else if (zoneId !== 'all') {
        where.zoneId = zoneId;
      }
    }

    const pois = await prisma.pointOfInterest.findMany({
      where,
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
          },
        },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Get active categories for filtering (scoped to org)
    const categories = await prisma.pOICategory.findMany({
      where: {
        isActive: true,
        ...orgFilter,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        icon: true,
        _count: {
          select: {
            pois: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    // Group POIs by category for easy rendering
    const groupedByCategory = categories.map(cat => ({
      category: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        color: cat.color,
        icon: cat.icon,
        count: cat._count.pois,
      },
      pois: pois.filter(poi => poi.categoryId === cat.id).map(poi => ({
        id: poi.id,
        name: poi.name,
        description: poi.description,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
        phone: poi.phone,
        website: poi.website,
        zone: poi.zone,
        category: poi.category,
      })),
    }));

    return NextResponse.json({
      pois: pois.map(poi => ({
        id: poi.id,
        name: poi.name,
        description: poi.description,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
        phone: poi.phone,
        website: poi.website,
        zone: poi.zone,
        category: poi.category,
      })),
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        color: cat.color,
        icon: cat.icon,
        count: cat._count.pois,
      })),
      groupedByCategory,
      total: pois.length,
    });
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return NextResponse.json({ error: 'Failed to fetch POIs' }, { status: 500 });
  }
}
