import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { canManageOrgSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/regional-lead-assignments/[id] - Get single assignment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const assignment = await prisma.regionalLeadAssignment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Error fetching regional lead assignment:', error);
    return NextResponse.json({ error: 'Failed to fetch assignment' }, { status: 500 });
  }
}

// PUT /api/regional-lead-assignments/[id] - Update assignment (Coordinator/Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role - only Coordinators/Admins can update
    const ctx = createPermissionContext(user.role);
    if (!canManageOrgSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isPrimary, notes } = body;

    // Build update data (only allow updating isPrimary and notes)
    const updateData: Record<string, unknown> = {};
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
    if (notes !== undefined) updateData.notes = notes;

    const assignment = await prisma.regionalLeadAssignment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Error updating regional lead assignment:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

// DELETE /api/regional-lead-assignments/[id] - Delete assignment
// Coordinators/Admins can delete any assignment
// Users can delete their own assignment (withdraw from duty)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the assignment to check ownership
    const assignment = await prisma.regionalLeadAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Check if user can delete: either own assignment or Coordinator/Admin
    const isOwnAssignment = assignment.userId === user.id;
    const ctx = createPermissionContext(user.role);
    const isPrivilegedUser = canManageOrgSettings(ctx);

    if (!isOwnAssignment && !isPrivilegedUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.regionalLeadAssignment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('Error deleting regional lead assignment:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
