import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { CoverageOverrideType, Prisma } from '@/generated/prisma/client';

/**
 * GET /api/coverage/overrides/[id]
 *
 * Get a single coverage override by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can view coverage overrides' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const override = await prisma.coverageOverride.findUnique({
      where: { id },
      include: {
        zone: {
          select: { id: true, name: true, county: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!override) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      override: {
        id: override.id,
        date: override.date.toISOString().split('T')[0],
        zoneId: override.zoneId,
        zoneName: override.zone?.name || null,
        county: override.zone?.county || null,
        overrideType: override.overrideType,
        slotOverrides: override.slotOverrides,
        reason: override.reason,
        createdBy: {
          id: override.createdBy.id,
          name: override.createdBy.name,
        },
        createdAt: override.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching coverage override:', error);
    return NextResponse.json(
      { error: 'Failed to fetch override' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/coverage/overrides/[id]
 *
 * Update a coverage override. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 * Body: {
 *   overrideType?: 'CLOSURE' | 'ADJUST_REQUIREMENTS' | 'SPECIAL_EVENT',
 *   slotOverrides?: array | null,
 *   reason?: string | null
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can update coverage overrides' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check override exists
    const existing = await prisma.coverageOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { overrideType, slotOverrides, reason } = body;

    // Validate overrideType if provided
    if (overrideType !== undefined) {
      const validTypes: CoverageOverrideType[] = ['CLOSURE', 'ADJUST_REQUIREMENTS', 'SPECIAL_EVENT'];
      if (!validTypes.includes(overrideType)) {
        return NextResponse.json(
          { error: `Invalid overrideType. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate slotOverrides if provided
    if (slotOverrides !== undefined && slotOverrides !== null) {
      if (!Array.isArray(slotOverrides)) {
        return NextResponse.json(
          { error: 'slotOverrides must be an array or null' },
          { status: 400 }
        );
      }
      for (const slot of slotOverrides) {
        if (
          typeof slot.startHour !== 'number' ||
          typeof slot.endHour !== 'number' ||
          slot.startHour < 0 ||
          slot.startHour > 23 ||
          slot.endHour < 1 ||
          slot.endHour > 24 ||
          slot.startHour >= slot.endHour
        ) {
          return NextResponse.json(
            { error: 'Invalid slot override. Each needs valid startHour and endHour.' },
            { status: 400 }
          );
        }
      }
    }

    // Build update data
    const updateData: Prisma.CoverageOverrideUpdateInput = {};

    if (overrideType !== undefined) {
      updateData.overrideType = overrideType;
    }
    if (slotOverrides !== undefined) {
      // Use Prisma's DbNull for null JSON values
      updateData.slotOverrides = slotOverrides === null
        ? Prisma.DbNull
        : (slotOverrides as Prisma.InputJsonValue);
    }
    if (reason !== undefined) {
      updateData.reason = reason;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No update data provided' },
        { status: 400 }
      );
    }

    const override = await prisma.coverageOverride.update({
      where: { id },
      data: updateData,
      include: {
        zone: {
          select: { id: true, name: true, county: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      override: {
        id: override.id,
        date: override.date.toISOString().split('T')[0],
        zoneId: override.zoneId,
        zoneName: override.zone?.name || null,
        county: override.zone?.county || null,
        overrideType: override.overrideType,
        slotOverrides: override.slotOverrides,
        reason: override.reason,
        createdBy: {
          id: override.createdBy.id,
          name: override.createdBy.name,
        },
        createdAt: override.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating coverage override:', error);
    return NextResponse.json(
      { error: 'Failed to update override' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coverage/overrides/[id]
 *
 * Delete a coverage override. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can delete coverage overrides' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check override exists
    const existing = await prisma.coverageOverride.findUnique({
      where: { id },
      include: {
        zone: {
          select: { name: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    await prisma.coverageOverride.delete({
      where: { id },
    });

    const zoneName = existing.zone?.name || 'all zones';
    const dateStr = existing.date.toISOString().split('T')[0];

    return NextResponse.json({
      success: true,
      message: `Deleted override for ${zoneName} on ${dateStr}`,
    });
  } catch (error) {
    console.error('Error deleting coverage override:', error);
    return NextResponse.json(
      { error: 'Failed to delete override' },
      { status: 500 }
    );
  }
}
