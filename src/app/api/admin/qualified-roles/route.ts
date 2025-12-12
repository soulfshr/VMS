import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/admin/qualified-roles - List all qualified roles
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            userQualifications: true,
            shiftTypeRequirements: true,
            trainingTypeGrants: true,
            shiftVolunteers: true,
          },
        },
      },
    });

    return NextResponse.json(qualifiedRoles);
  } catch (error) {
    console.error('Error fetching qualified roles:', error);
    return NextResponse.json({ error: 'Failed to fetch qualified roles' }, { status: 500 });
  }
}

// POST /api/admin/qualified-roles - Create new qualified role
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, color, isDefaultForNewUsers, countsTowardMinimum } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check for duplicate name or slug
    const existing = await prisma.qualifiedRole.findFirst({
      where: {
        OR: [{ name }, { slug: slug.toUpperCase() }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A qualified role with this name or slug already exists' },
        { status: 400 }
      );
    }

    // Get max sort order
    const maxSort = await prisma.qualifiedRole.aggregate({
      _max: { sortOrder: true },
    });

    const qualifiedRole = await prisma.qualifiedRole.create({
      data: {
        name,
        slug: slug.toUpperCase(),
        description: description || null,
        color: color || '#6366f1',
        isDefaultForNewUsers: isDefaultForNewUsers || false,
        countsTowardMinimum: countsTowardMinimum !== false,  // Default to true
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
      include: {
        _count: {
          select: {
            userQualifications: true,
            shiftTypeRequirements: true,
            trainingTypeGrants: true,
            shiftVolunteers: true,
          },
        },
      },
    });

    return NextResponse.json(qualifiedRole, { status: 201 });
  } catch (error) {
    console.error('Error creating qualified role:', error);
    return NextResponse.json({ error: 'Failed to create qualified role' }, { status: 500 });
  }
}
