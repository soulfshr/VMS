import { prisma } from '@/lib/db';

/**
 * Check a shift's exception status based on role requirements
 * Returns the exception status and notes about what requirements aren't met
 */
export async function checkShiftException(shiftId: string): Promise<{
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
 * Update a shift's exception status in the database
 */
export async function updateShiftExceptionStatus(shiftId: string): Promise<{
  hasRoleException: boolean;
  exceptionNotes: string | null;
  issues: string[];
}> {
  const { hasException, notes } = await checkShiftException(shiftId);

  // Update the shift with exception status
  const updatedShift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      hasRoleException: hasException,
      exceptionNotes: hasException ? notes.join('; ') : null,
      // Clear review status if exception status changed to no exception
      ...(hasException ? {} : {
        exceptionReviewedById: null,
        exceptionReviewedAt: null,
      }),
    },
  });

  return {
    hasRoleException: updatedShift.hasRoleException,
    exceptionNotes: updatedShift.exceptionNotes,
    issues: notes,
  };
}
