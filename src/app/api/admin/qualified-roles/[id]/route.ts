import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/qualified-roles/[id] - Get single qualified role with stats
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const qualifiedRole = await prisma.qualifiedRole.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userQualifications: true,
            shiftTypeRequirements: true,
            trainingTypeGrants: true,
            shiftVolunteers: true,
          },
        },
        trainingTypeGrants: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!qualifiedRole) {
      return NextResponse.json({ error: 'Qualified role not found' }, { status: 404 });
    }

    return NextResponse.json(qualifiedRole);
  } catch (error) {
    console.error('Error fetching qualified role:', error);
    return NextResponse.json({ error: 'Failed to fetch qualified role' }, { status: 500 });
  }
}

// PUT /api/admin/qualified-roles/[id] - Update qualified role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if qualified role exists
    const existing = await prisma.qualifiedRole.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Qualified role not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      color?: string;
      isActive?: boolean;
      isDefaultForNewUsers?: boolean;
      countsTowardMinimum?: boolean;
      sortOrder?: number;
    } = {};

    if (body.name !== undefined) {
      // Check for duplicate name
      const duplicate = await prisma.qualifiedRole.findFirst({
        where: {
          name: body.name,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A qualified role with this name already exists' },
          { status: 400 }
        );
      }
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (body.color !== undefined) {
      updateData.color = body.color;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.isDefaultForNewUsers !== undefined) {
      updateData.isDefaultForNewUsers = body.isDefaultForNewUsers;
    }

    if (body.countsTowardMinimum !== undefined) {
      updateData.countsTowardMinimum = body.countsTowardMinimum;
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    const qualifiedRole = await prisma.qualifiedRole.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(qualifiedRole);
  } catch (error) {
    console.error('Error updating qualified role:', error);
    return NextResponse.json({ error: 'Failed to update qualified role' }, { status: 500 });
  }
}

// DELETE /api/admin/qualified-roles/[id] - Delete/archive qualified role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check usage
    const qualifiedRole = await prisma.qualifiedRole.findUnique({
      where: { id },
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

    if (!qualifiedRole) {
      return NextResponse.json({ error: 'Qualified role not found' }, { status: 404 });
    }

    const totalUsage =
      qualifiedRole._count.userQualifications +
      qualifiedRole._count.shiftTypeRequirements +
      qualifiedRole._count.trainingTypeGrants +
      qualifiedRole._count.shiftVolunteers;

    if (totalUsage > 0) {
      // Archive instead of delete
      await prisma.qualifiedRole.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: 'Qualified role archived (in use by users/shifts)',
        archived: true,
        usage: qualifiedRole._count,
      });
    }

    // Safe to delete
    await prisma.qualifiedRole.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Qualified role deleted',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting qualified role:', error);
    return NextResponse.json({ error: 'Failed to delete qualified role' }, { status: 500 });
  }
}
