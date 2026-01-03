import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/admin/shift-types - List all shift types (including archived)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const shiftTypes = await prisma.shiftTypeConfig.findMany({
      where: {
        // Multi-tenant: scope to current org
        ...orgFilter,
      },
      include: {
        qualificationRequirements: true,  // Keep for backwards compatibility
        qualifiedRoleRequirements: {
          include: {
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
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
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orgId = await getOrgIdForCreate();

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
      qualifiedRoleRequirements,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check for duplicate name or slug within the organization
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const existing = await prisma.shiftTypeConfig.findFirst({
      where: {
        OR: [{ name }, { slug }],
        ...orgFilter,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Shift type with this name or slug already exists' },
        { status: 400 }
      );
    }

    // Create shift type with qualified role requirements
    const shiftType = await prisma.shiftTypeConfig.create({
      data: {
        organizationId: orgId,
        name,
        slug: slug.toUpperCase(),
        description: description || null,
        color: color || '#3b82f6',
        defaultMinVolunteers: defaultMinVolunteers ?? 2,
        defaultIdealVolunteers: defaultIdealVolunteers ?? 4,
        defaultMaxVolunteers: defaultMaxVolunteers ?? 6,
        sortOrder: sortOrder ?? 0,
        ...(qualifiedRoleRequirements?.length > 0 && {
          qualifiedRoleRequirements: {
            create: qualifiedRoleRequirements.map((req: { qualifiedRoleId: string; minRequired: number; maxAllowed?: number }) => ({
              qualifiedRoleId: req.qualifiedRoleId,
              minRequired: req.minRequired || 0,
              maxAllowed: req.maxAllowed ?? null,
            })),
          },
        }),
      },
      include: {
        qualifiedRoleRequirements: {
          include: {
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(shiftType, { status: 201 });
  } catch (error) {
    console.error('Error creating shift type:', error);
    return NextResponse.json({ error: 'Failed to create shift type' }, { status: 500 });
  }
}
