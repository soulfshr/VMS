import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shifts/[id]/review-exception
 * Mark an exception as reviewed/dismissed by a coordinator
 * Requires COORDINATOR, ADMINISTRATOR, or DEVELOPER role
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and above can review exceptions
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: shiftId } = await params;
    const body = await request.json();
    const { dismiss } = body;

    // Check if shift exists and has an exception
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        hasRoleException: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    if (!shift.hasRoleException) {
      return NextResponse.json({ error: 'Shift does not have an exception to review' }, { status: 400 });
    }

    if (dismiss) {
      // Mark exception as reviewed/dismissed
      const updatedShift = await prisma.shift.update({
        where: { id: shiftId },
        data: {
          exceptionReviewedById: user.id,
          exceptionReviewedAt: new Date(),
        },
        select: {
          id: true,
          hasRoleException: true,
          exceptionNotes: true,
          exceptionReviewedById: true,
          exceptionReviewedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Exception reviewed and dismissed',
        shift: updatedShift,
      });
    } else {
      // Clear review status (un-dismiss)
      const updatedShift = await prisma.shift.update({
        where: { id: shiftId },
        data: {
          exceptionReviewedById: null,
          exceptionReviewedAt: null,
        },
        select: {
          id: true,
          hasRoleException: true,
          exceptionNotes: true,
          exceptionReviewedById: true,
          exceptionReviewedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Exception review cleared',
        shift: updatedShift,
      });
    }
  } catch (error) {
    console.error('Error reviewing shift exception:', error);
    return NextResponse.json(
      { error: 'Failed to review shift exception' },
      { status: 500 }
    );
  }
}
