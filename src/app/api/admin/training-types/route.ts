import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/admin/training-types - List all training types (including archived)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const trainingTypes = await prisma.trainingType.findMany({
      include: {
        grantsQualifiedRole: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
        _count: {
          select: { sessions: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(trainingTypes);
  } catch (error) {
    console.error('Error fetching training types:', error);
    return NextResponse.json({ error: 'Failed to fetch training types' }, { status: 500 });
  }
}

// POST /api/admin/training-types - Create new training type
export async function POST(request: Request) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      description,
      color,
      defaultDuration,
      defaultCapacity,
      expiresAfterDays,
      grantsQualifiedRoleId,
      sortOrder,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check for duplicate name or slug
    const existing = await prisma.trainingType.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Training type with this name or slug already exists' },
        { status: 400 }
      );
    }

    // Create training type
    const trainingType = await prisma.trainingType.create({
      data: {
        name,
        slug: slug.toUpperCase(),
        description: description || null,
        color: color || '#8b5cf6',
        defaultDuration: defaultDuration ?? 120,
        defaultCapacity: defaultCapacity ?? 20,
        expiresAfterDays: expiresAfterDays ?? null,
        grantsQualifiedRoleId: grantsQualifiedRoleId || null,
        sortOrder: sortOrder ?? 0,
      },
      include: {
        grantsQualifiedRole: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json(trainingType, { status: 201 });
  } catch (error) {
    console.error('Error creating training type:', error);
    return NextResponse.json({ error: 'Failed to create training type' }, { status: 500 });
  }
}
