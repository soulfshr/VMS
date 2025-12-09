import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// POST /api/shifts/bulk-edit - Bulk edit multiple shifts (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can bulk edit shifts
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { shiftIds, typeConfigId, minVolunteers, maxVolunteers, startHour, endHour } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'No shifts specified' },
        { status: 400 }
      );
    }

    // Build update data object based on provided fields
    const updateData: Record<string, unknown> = {};

    // Handle shift type update
    if (typeConfigId) {
      // Verify the type config exists and get its type enum value
      const typeConfig = await prisma.shiftTypeConfig.findUnique({
        where: { id: typeConfigId },
      });
      if (!typeConfig) {
        return NextResponse.json(
          { error: 'Invalid shift type' },
          { status: 400 }
        );
      }
      updateData.typeConfigId = typeConfigId;
      updateData.type = typeConfig.slug as 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT';
    }

    // Handle volunteer limits update
    if (minVolunteers !== undefined) {
      updateData.minVolunteers = minVolunteers;
    }
    if (maxVolunteers !== undefined) {
      updateData.maxVolunteers = maxVolunteers;
    }

    // Handle time slot update - requires fetching shifts to update their times
    if (startHour !== undefined && endHour !== undefined) {
      // Need to update each shift individually to preserve date
      const shifts = await prisma.shift.findMany({
        where: {
          id: { in: shiftIds },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          date: true,
        },
      });

      for (const shift of shifts) {
        const shiftDate = new Date(shift.date);

        // Create start time (in Eastern Time - UTC-5)
        const startTime = new Date(shiftDate);
        startTime.setUTCHours(startHour + 5, 0, 0, 0); // Add 5 hours to convert ET to UTC

        const endTime = new Date(shiftDate);
        endTime.setUTCHours(endHour + 5, 0, 0, 0);

        await prisma.shift.update({
          where: { id: shift.id },
          data: {
            ...updateData,
            startTime,
            endTime,
          },
        });
      }

      return NextResponse.json({
        message: `Updated ${shifts.length} shift(s)`,
        updatedCount: shifts.length,
      });
    }

    // If no time update, use updateMany for efficiency
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No changes specified' },
        { status: 400 }
      );
    }

    const result = await prisma.shift.updateMany({
      where: {
        id: { in: shiftIds },
        status: { not: 'CANCELLED' },
      },
      data: updateData,
    });

    return NextResponse.json({
      message: `Updated ${result.count} shift(s)`,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Error bulk editing shifts:', error);
    return NextResponse.json(
      { error: 'Failed to update shifts' },
      { status: 500 }
    );
  }
}
