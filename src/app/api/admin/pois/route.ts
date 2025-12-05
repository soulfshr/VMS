import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/admin/pois - List all POIs with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('category');
    const zoneId = searchParams.get('zone');
    const status = searchParams.get('status'); // 'active', 'inactive', or 'all'
    const search = searchParams.get('search');

    // Build where clause
    const where: Record<string, unknown> = {};

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

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
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
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    // Get categories for filter dropdown
    const categories = await prisma.pOICategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
    });

    // Get zones for filter dropdown
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        county: true,
      },
    });

    return NextResponse.json({
      pois,
      categories,
      zones,
      total: pois.length,
    });
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return NextResponse.json({ error: 'Failed to fetch POIs' }, { status: 500 });
  }
}

// POST /api/admin/pois - Create new POI
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      address,
      latitude,
      longitude,
      phone,
      website,
      notes,
      categoryId,
      zoneId,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Location (latitude and longitude) is required' },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await prisma.pOICategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Verify zone exists if provided
    if (zoneId) {
      const zone = await prisma.zone.findUnique({
        where: { id: zoneId },
      });

      if (!zone) {
        return NextResponse.json(
          { error: 'Invalid zone' },
          { status: 400 }
        );
      }
    }

    const poi = await prisma.pointOfInterest.create({
      data: {
        name,
        description: description || null,
        address: address || null,
        latitude,
        longitude,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        categoryId,
        zoneId: zoneId || null,
        createdById: user.id,
      },
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

    return NextResponse.json(poi, { status: 201 });
  } catch (error) {
    console.error('Error creating POI:', error);
    return NextResponse.json({ error: 'Failed to create POI' }, { status: 500 });
  }
}
