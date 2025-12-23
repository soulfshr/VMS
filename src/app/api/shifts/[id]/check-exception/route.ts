import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Check and update a shift's exception status based on role requirements
 * Called after RSVP changes or manually by coordinators
 */
async function checkShiftException(shiftId: string): Promise<{
  hasException: boolean;
  notes: string[];
}> {
  // Get the shift with its type config, requirements, and volunteers
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      typeConfig: {
        include: {
          qualifiedRoleRequirements: {
            include: {
              qualifiedRole: true,
            },
          },
        },
      },
      volunteers: {
        where: {
          status: 'CONFIRMED',
        },
        include: {
          qualifiedRole: true,
        },
      },
    },
  });

  if (!shift) {
    return { hasException: false, notes: [] };
  }

  const notes: string[] = [];
  const requirements = shift.typeConfig?.qualifiedRoleRequirements || [];
  const confirmedVolunteers = shift.volunteers;

  // Check each role requirement
  for (const req of requirements) {
    const roleCount = confirmedVolunteers.filter(
      v => v.qualifiedRoleId === req.qualifiedRoleId
    ).length;

    if (roleCount < req.minRequired) {
      const needed = req.minRequired - roleCount;
      notes.push(`Need ${needed} more ${req.qualifiedRole.name}${needed > 1 ? 's' : ''}`);
    }

    if (req.maxAllowed !== null && roleCount > req.maxAllowed) {
      notes.push(`Exceeded max ${req.qualifiedRole.name}s (${roleCount}/${req.maxAllowed})`);
    }
  }

  // Also check overall minimum volunteers
  const totalConfirmed = confirmedVolunteers.length;
  if (totalConfirmed < shift.minVolunteers) {
    const needed = shift.minVolunteers - totalConfirmed;
    notes.push(`Need ${needed} more volunteer${needed > 1 ? 's' : ''} (${totalConfirmed}/${shift.minVolunteers} minimum)`);
  }

  return {
    hasException: notes.length > 0,
    notes,
  };
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
    if (!['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
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

    // Check exception status
    const { hasException, notes } = await checkShiftException(shiftId);

    // Update the shift with exception status
    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        hasRoleException: hasException,
        exceptionNotes: hasException ? notes.join('; ') : null,
        // Clear review status if exception status changed
        ...(hasException ? {} : {
          exceptionReviewedById: null,
          exceptionReviewedAt: null,
        }),
      },
    });

    return NextResponse.json({
      shiftId,
      hasRoleException: updatedShift.hasRoleException,
      exceptionNotes: updatedShift.exceptionNotes,
      issues: notes,
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

// Export the helper function for use in other routes (e.g., RSVP handler)
export { checkShiftException };
