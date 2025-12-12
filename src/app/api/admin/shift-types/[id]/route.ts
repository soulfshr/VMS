import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/shift-types/[id] - Get single shift type
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

    const shiftType = await prisma.shiftTypeConfig.findUnique({
      where: { id },
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
    });

    if (!shiftType) {
      return NextResponse.json({ error: 'Shift type not found' }, { status: 404 });
    }

    return NextResponse.json(shiftType);
  } catch (error) {
    console.error('Error fetching shift type:', error);
    return NextResponse.json({ error: 'Failed to fetch shift type' }, { status: 500 });
  }
}

// PUT /api/admin/shift-types/[id] - Update shift type
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
    const body = await request.json();
    const {
      name,
      description,
      color,
      defaultMinVolunteers,
      defaultIdealVolunteers,
      defaultMaxVolunteers,
      sortOrder,
      isActive,
      qualifiedRoleRequirements,
    } = body;

    // Check if shift type exists
    const existing = await prisma.shiftTypeConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Shift type not found' }, { status: 404 });
    }

    // Check for duplicate name (excluding current)
    if (name && name !== existing.name) {
      const duplicate = await prisma.shiftTypeConfig.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Shift type with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Update shift type
    const shiftType = await prisma.shiftTypeConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(defaultMinVolunteers !== undefined && { defaultMinVolunteers }),
        ...(defaultIdealVolunteers !== undefined && { defaultIdealVolunteers }),
        ...(defaultMaxVolunteers !== undefined && { defaultMaxVolunteers }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
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

    // Update qualified role requirements if provided
    if (qualifiedRoleRequirements !== undefined) {
      // Delete existing requirements
      await prisma.shiftTypeQualifiedRoleRequirement.deleteMany({
        where: { shiftTypeId: id },
      });

      // Create new requirements
      if (qualifiedRoleRequirements.length > 0) {
        await prisma.shiftTypeQualifiedRoleRequirement.createMany({
          data: qualifiedRoleRequirements.map((req: { qualifiedRoleId: string; minRequired: number; maxAllowed?: number }) => ({
            shiftTypeId: id,
            qualifiedRoleId: req.qualifiedRoleId,
            minRequired: req.minRequired || 0,
            maxAllowed: req.maxAllowed ?? null,
          })),
        });
      }

      // Refetch with updated requirements
      const updatedShiftType = await prisma.shiftTypeConfig.findUnique({
        where: { id },
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

      return NextResponse.json(updatedShiftType);
    }

    return NextResponse.json(shiftType);
  } catch (error) {
    console.error('Error updating shift type:', error);
    return NextResponse.json({ error: 'Failed to update shift type' }, { status: 500 });
  }
}

// DELETE /api/admin/shift-types/[id] - Archive (soft delete) shift type
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

    // Check if shift type exists
    const existing = await prisma.shiftTypeConfig.findUnique({
      where: { id },
      include: {
        _count: {
          select: { shifts: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Shift type not found' }, { status: 404 });
    }

    // If no shifts use this type, hard delete; otherwise soft delete (archive)
    if (existing._count.shifts === 0) {
      await prisma.shiftTypeConfig.delete({
        where: { id },
      });
      return NextResponse.json({ message: 'Shift type deleted' });
    } else {
      // Soft delete - just mark as inactive
      await prisma.shiftTypeConfig.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: 'Shift type archived (has existing shifts)' });
    }
  } catch (error) {
    console.error('Error deleting shift type:', error);
    return NextResponse.json({ error: 'Failed to delete shift type' }, { status: 500 });
  }
}
