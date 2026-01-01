import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getOrgTimezone, formatDate, parseDisplayDateTime } from '@/lib/timezone';

// POST /api/shifts/bulk-edit - Bulk edit multiple shifts (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can bulk edit shifts
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { shiftIds, typeConfigId, minVolunteers, maxVolunteers, startHour, endHour, status, title } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'No shifts specified' },
        { status: 400 }
      );
    }

    // Build update data object based on provided fields
    const updateData: Record<string, unknown> = {};

    // Handle status update
    if (status) {
      const validStatuses = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Handle title update
    if (title !== undefined && title !== null) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

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

      // Get org timezone for proper DST-aware conversion
      const timezone = await getOrgTimezone();

      for (const shift of shifts) {
        // Get the date string in the org's timezone
        const dateStr = formatDate(new Date(shift.date), timezone);

        // Convert hour to time string (HH:00)
        const startTimeStr = `${String(startHour).padStart(2, '0')}:00`;
        const endTimeStr = `${String(endHour).padStart(2, '0')}:00`;

        // Parse using timezone-aware utility (handles DST automatically)
        const startTime = parseDisplayDateTime(dateStr, startTimeStr, timezone);
        const endTime = parseDisplayDateTime(dateStr, endTimeStr, timezone);

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
