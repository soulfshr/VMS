import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import type { Role } from '@/generated/prisma/client';

// GET /api/admin/shift-types - List all shift types (including archived)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const shiftTypes = await prisma.shiftTypeConfig.findMany({
      include: {
        roleRequirements: true,
        _count: {
          select: { shifts: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(shiftTypes);
  } catch (error) {
    console.error('Error fetching shift types:', error);
    return NextResponse.json({ error: 'Failed to fetch shift types' }, { status: 500 });
  }
}

// POST /api/admin/shift-types - Create new shift type
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
      defaultMinVolunteers,
      defaultIdealVolunteers,
      defaultMaxVolunteers,
      sortOrder,
      roleRequirements,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check for duplicate name or slug
    const existing = await prisma.shiftTypeConfig.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Shift type with this name or slug already exists' },
        { status: 400 }
      );
    }

    // Create shift type with role requirements
    const shiftType = await prisma.shiftTypeConfig.create({
      data: {
        name,
        slug: slug.toUpperCase(),
        description: description || null,
        color: color || '#3b82f6',
        defaultMinVolunteers: defaultMinVolunteers ?? 2,
        defaultIdealVolunteers: defaultIdealVolunteers ?? 4,
        defaultMaxVolunteers: defaultMaxVolunteers ?? 6,
        sortOrder: sortOrder ?? 0,
        ...(roleRequirements?.length > 0 && {
          roleRequirements: {
            create: roleRequirements.map((req: { role: Role; minRequired: number; maxAllowed?: number }) => ({
              role: req.role,
              minRequired: req.minRequired || 0,
              maxAllowed: req.maxAllowed ?? null,
            })),
          },
        }),
      },
      include: {
        roleRequirements: true,
      },
    });

    return NextResponse.json(shiftType, { status: 201 });
  } catch (error) {
    console.error('Error creating shift type:', error);
    return NextResponse.json({ error: 'Failed to create shift type' }, { status: 500 });
  }
}
