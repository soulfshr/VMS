import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { canManageQualifiedRoles, createPermissionContext } from '@/lib/permissions';

// GET /api/admin/qualified-roles - List all qualified roles
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canManageQualifiedRoles(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();
    // If no org selected, use impossible filter to prevent data leakage
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: {
        // Multi-tenant: scope to current org
        ...orgFilter,
      },
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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canManageQualifiedRoles(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getOrgIdForCreate();

    const body = await request.json();
    const { name, slug, description, color, isDefaultForNewUsers, countsTowardMinimum } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check for duplicate name or slug within the organization
    // If no org, use impossible filter (shouldn't create records without org context)
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const existing = await prisma.qualifiedRole.findFirst({
      where: {
        OR: [{ name }, { slug: slug.toUpperCase() }],
        ...orgFilter,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A qualified role with this name or slug already exists' },
        { status: 400 }
      );
    }

    // Get max sort order within the organization
    const maxSort = await prisma.qualifiedRole.aggregate({
      where: {
        ...orgFilter,
      },
      _max: { sortOrder: true },
    });

    const qualifiedRole = await prisma.qualifiedRole.create({
      data: {
        organizationId: orgId,
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
