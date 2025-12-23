import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/training-types/[id] - Get single training type
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();

    const trainingType = await prisma.trainingType.findFirst({
      where: {
        id,
        // Multi-tenant: verify training type belongs to current org
        OR: orgId
          ? [{ organizationId: orgId }, { organizationId: null }]
          : [{ organizationId: null }],
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
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!trainingType) {
      return NextResponse.json({ error: 'Training type not found' }, { status: 404 });
    }

    return NextResponse.json(trainingType);
  } catch (error) {
    console.error('Error fetching training type:', error);
    return NextResponse.json({ error: 'Failed to fetch training type' }, { status: 500 });
  }
}

// PUT /api/admin/training-types/[id] - Update training type
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const {
      name,
      description,
      color,
      defaultDuration,
      defaultCapacity,
      expiresAfterDays,
      grantsQualifiedRoleId,
      sortOrder,
      isActive,
    } = body;

    // Check if training type exists and belongs to current org
    const existing = await prisma.trainingType.findFirst({
      where: {
        id,
        OR: orgId
          ? [{ organizationId: orgId }, { organizationId: null }]
          : [{ organizationId: null }],
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Training type not found' }, { status: 404 });
    }

    // Check for duplicate name within the organization (excluding current)
    if (name && name !== existing.name) {
      const duplicate = await prisma.trainingType.findFirst({
        where: {
          name,
          NOT: { id },
          OR: orgId
            ? [{ organizationId: orgId }, { organizationId: null }]
            : [{ organizationId: null }],
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Training type with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Update training type
    const trainingType = await prisma.trainingType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(defaultDuration !== undefined && { defaultDuration }),
        ...(defaultCapacity !== undefined && { defaultCapacity }),
        ...(expiresAfterDays !== undefined && { expiresAfterDays }),
        ...(grantsQualifiedRoleId !== undefined && { grantsQualifiedRoleId: grantsQualifiedRoleId || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
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

    return NextResponse.json(trainingType);
  } catch (error) {
    console.error('Error updating training type:', error);
    return NextResponse.json({ error: 'Failed to update training type' }, { status: 500 });
  }
}

// DELETE /api/admin/training-types/[id] - Archive (soft delete) training type
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();

    // Check if training type exists and belongs to current org
    const existing = await prisma.trainingType.findFirst({
      where: {
        id,
        OR: orgId
          ? [{ organizationId: orgId }, { organizationId: null }]
          : [{ organizationId: null }],
      },
      include: {
        _count: {
          select: { sessions: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Training type not found' }, { status: 404 });
    }

    // If no sessions use this type, hard delete; otherwise soft delete (archive)
    if (existing._count.sessions === 0) {
      await prisma.trainingType.delete({
        where: { id },
      });
      return NextResponse.json({ message: 'Training type deleted' });
    } else {
      // Soft delete - just mark as inactive
      await prisma.trainingType.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: 'Training type archived (has existing sessions)' });
    }
  } catch (error) {
    console.error('Error deleting training type:', error);
    return NextResponse.json({ error: 'Failed to delete training type' }, { status: 500 });
  }
}
