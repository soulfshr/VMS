import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import type { Prisma } from '@/generated/prisma/client';
import { getCurrentOrgId } from '@/lib/org-context';

/**
 * GET /api/coverage/config
 *
 * Get coverage configurations. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 * Query params: zoneId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // COORDINATOR, ADMINISTRATOR, and DEVELOPER can view configs
    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can view coverage configurations' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const zoneId = searchParams.get('zoneId');

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Build where clause with org scoping via zone relation
    const where: Record<string, unknown> = {
      zone: {
        ...orgFilter,
      },
    };

    if (zoneId) {
      where.zoneId = zoneId;
    }

    const configs = await prisma.coverageConfig.findMany({
      where,
      include: {
        zone: {
          select: { name: true, county: true },
        },
      },
      orderBy: [
        { zone: { name: 'asc' } },
        { dayOfWeek: 'asc' },
      ],
    });

    return NextResponse.json({
      configs: configs.map(c => ({
        id: c.id,
        zoneId: c.zoneId,
        zoneName: c.zone.name,
        county: c.zone.county,
        dayOfWeek: c.dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][c.dayOfWeek],
        slots: c.slots,
        isActive: c.isActive,
      })),
    });
  } catch (error) {
    console.error('Error fetching coverage configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/coverage/config
 *
 * Update a coverage configuration. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 * Body: { id: string, slots?: array, isActive?: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // COORDINATOR, ADMINISTRATOR, and DEVELOPER can edit configs
    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can manage coverage configurations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, slots, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      );
    }

    // Validate slots if provided
    if (slots !== undefined) {
      if (!Array.isArray(slots)) {
        return NextResponse.json(
          { error: 'Slots must be an array' },
          { status: 400 }
        );
      }

      for (const slot of slots) {
        if (
          typeof slot.start !== 'number' ||
          typeof slot.end !== 'number' ||
          slot.start < 0 ||
          slot.start > 23 ||
          slot.end < 1 ||
          slot.end > 24 ||
          slot.start >= slot.end
        ) {
          return NextResponse.json(
            { error: 'Invalid slot configuration. Each slot needs start and end hours.' },
            { status: 400 }
          );
        }
      }
    }

    // Build update data
    const updateData: Prisma.CoverageConfigUpdateInput = {};

    if (slots !== undefined) {
      updateData.slots = slots as Prisma.InputJsonValue;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No update data provided' },
        { status: 400 }
      );
    }

    const config = await prisma.coverageConfig.update({
      where: { id },
      data: updateData,
    });

    // Fetch zone separately for response
    const zone = await prisma.zone.findUnique({
      where: { id: config.zoneId },
      select: { name: true, county: true },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        zoneId: config.zoneId,
        zoneName: zone?.name,
        county: zone?.county,
        dayOfWeek: config.dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.dayOfWeek],
        slots: config.slots,
        isActive: config.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating coverage config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coverage/config
 *
 * Create a new coverage configuration. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 * Body: { zoneId: string, dayOfWeek: number, slots: array, isActive?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // COORDINATOR, ADMINISTRATOR, and DEVELOPER can create configs
    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can manage coverage configurations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { zoneId, dayOfWeek, slots, isActive = true } = body;

    // Validate required fields
    if (!zoneId || dayOfWeek === undefined || !slots) {
      return NextResponse.json(
        { error: 'Missing required fields: zoneId, dayOfWeek, slots' },
        { status: 400 }
      );
    }

    // Validate dayOfWeek
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json(
        { error: 'dayOfWeek must be 0-6 (Sunday-Saturday)' },
        { status: 400 }
      );
    }

    // Validate slots
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: 'Slots must be a non-empty array' },
        { status: 400 }
      );
    }

    for (const slot of slots) {
      if (
        typeof slot.start !== 'number' ||
        typeof slot.end !== 'number' ||
        slot.start < 0 ||
        slot.start > 23 ||
        slot.end < 1 ||
        slot.end > 24 ||
        slot.start >= slot.end
      ) {
        return NextResponse.json(
          { error: 'Invalid slot configuration' },
          { status: 400 }
        );
      }
    }

    // Check zone exists
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      return NextResponse.json(
        { error: 'Zone not found' },
        { status: 404 }
      );
    }

    // Check if config already exists for this zone/day
    const existing = await prisma.coverageConfig.findUnique({
      where: {
        zoneId_dayOfWeek: {
          zoneId,
          dayOfWeek,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Configuration already exists for this zone/day. Use PATCH to update.' },
        { status: 409 }
      );
    }

    const config = await prisma.coverageConfig.create({
      data: {
        zoneId,
        dayOfWeek,
        slots,
        isActive,
      },
      include: {
        zone: {
          select: { name: true, county: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        zoneId: config.zoneId,
        zoneName: config.zone.name,
        county: config.zone.county,
        dayOfWeek: config.dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.dayOfWeek],
        slots: config.slots,
        isActive: config.isActive,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating coverage config:', error);
    return NextResponse.json(
      { error: 'Failed to create configuration' },
      { status: 500 }
    );
  }
}
