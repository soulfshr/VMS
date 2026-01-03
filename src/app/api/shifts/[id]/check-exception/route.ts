import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { updateShiftExceptionStatus } from '@/lib/shift-exception';
import { hasElevatedPrivileges, createPermissionContext } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shifts/[id]/check-exception
 * Recalculate and update the shift's exception status
 * Requires COORDINATOR, ADMINISTRATOR, or DEVELOPER role
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and above can check/update exceptions
    const ctx = createPermissionContext(user.role);
    if (!hasElevatedPrivileges(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: shiftId } = await params;

    // Check if shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Check and update exception status
    const result = await updateShiftExceptionStatus(shiftId);

    return NextResponse.json({
      shiftId,
      ...result,
    });
  } catch (error) {
    console.error('Error checking shift exception:', error);
    return NextResponse.json(
      { error: 'Failed to check shift exception' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shifts/[id]/check-exception
 * Get the current exception status without updating
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: shiftId } = await params;

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        hasRoleException: true,
        exceptionNotes: true,
        exceptionReviewedById: true,
        exceptionReviewedAt: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json(shift);
  } catch (error) {
    console.error('Error getting shift exception:', error);
    return NextResponse.json(
      { error: 'Failed to get shift exception' },
      { status: 500 }
    );
  }
}
