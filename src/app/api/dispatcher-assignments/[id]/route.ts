import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/dispatcher-assignments/[id] - Get single assignment
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

    const assignment = await prisma.dispatcherAssignment.findUnique({
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
    console.error('Error fetching dispatcher assignment:', error);
    return NextResponse.json({ error: 'Failed to fetch assignment' }, { status: 500 });
  }
}

// PUT /api/dispatcher-assignments/[id] - Update assignment (Coordinator/Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      userId,
      county,
      date,
      startTime,
      endTime,
      isBackup,
      notes,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (userId !== undefined) updateData.userId = userId;
    if (county !== undefined) updateData.county = county;
    if (date !== undefined) {
      // Parse date for DATE-only column storage
      // Use UTC noon to ensure PostgreSQL DATE stores the correct calendar date
      const [year, month, day] = date.split('-').map(Number);
      updateData.date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    }
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (isBackup !== undefined) updateData.isBackup = isBackup;
    if (notes !== undefined) updateData.notes = notes;

    const assignment = await prisma.dispatcherAssignment.update({
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
    console.error('Error updating dispatcher assignment:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Dispatcher already assigned to this time block' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

// DELETE /api/dispatcher-assignments/[id] - Delete assignment (Owner or Coordinator/Admin)
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
    const assignment = await prisma.dispatcherAssignment.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Allow if user owns the assignment OR is coordinator/admin
    const isOwner = assignment.userId === user.id;
    const isAdmin = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.dispatcherAssignment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('Error deleting dispatcher assignment:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
