import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { CoverageOverrideType } from '@/generated/prisma/client';

/**
 * GET /api/coverage/overrides
 *
 * Get coverage overrides for a date range. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 * Query params:
 *   - startDate: YYYY-MM-DD (required)
 *   - endDate: YYYY-MM-DD (required)
 *   - zoneId: optional filter
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // COORDINATOR, ADMINISTRATOR, and DEVELOPER can view overrides
    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can view coverage overrides' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const zoneId = searchParams.get('zoneId');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Build where clause
    const where: {
      date: { gte: Date; lte: Date };
      zoneId?: string | null;
    } = {
      date: {
        gte: start,
        lte: end,
      },
    };

    if (zoneId) {
      where.zoneId = zoneId;
    }

    const overrides = await prisma.coverageOverride.findMany({
      where,
      include: {
        zone: {
          select: { id: true, name: true, county: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [
        { date: 'asc' },
        { zone: { name: 'asc' } },
      ],
    });

    return NextResponse.json({
      overrides: overrides.map(o => ({
        id: o.id,
        date: o.date.toISOString().split('T')[0],
        zoneId: o.zoneId,
        zoneName: o.zone?.name || null,
        county: o.zone?.county || null,
        overrideType: o.overrideType,
        slotOverrides: o.slotOverrides,
        reason: o.reason,
        createdBy: {
          id: o.createdBy.id,
          name: o.createdBy.name,
        },
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching coverage overrides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overrides' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coverage/overrides
 *
 * Create a coverage override. COORDINATOR/ADMINISTRATOR/DEVELOPER only.
 * Body: {
 *   date: YYYY-MM-DD,
 *   zoneId?: string (null = all zones),
 *   overrideType: 'CLOSURE' | 'ADJUST_REQUIREMENTS' | 'SPECIAL_EVENT',
 *   slotOverrides?: array (for ADJUST_REQUIREMENTS),
 *   reason?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // COORDINATOR, ADMINISTRATOR, and DEVELOPER can create overrides
    const allowedRoles = ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Only coordinators and administrators can create coverage overrides' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { date, zoneId, overrideType, slotOverrides, reason } = body;

    // Validate required fields
    if (!date || !overrideType) {
      return NextResponse.json(
        { error: 'date and overrideType are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Validate overrideType
    const validTypes: CoverageOverrideType[] = ['CLOSURE', 'ADJUST_REQUIREMENTS', 'SPECIAL_EVENT'];
    if (!validTypes.includes(overrideType)) {
      return NextResponse.json(
        { error: `Invalid overrideType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // If zoneId provided, validate it exists
    if (zoneId) {
      const zone = await prisma.zone.findUnique({
        where: { id: zoneId },
      });
      if (!zone) {
        return NextResponse.json(
          { error: 'Zone not found' },
          { status: 404 }
        );
      }
    }

    // Check for existing override on this date/zone
    const existing = await prisma.coverageOverride.findUnique({
      where: {
        date_zoneId: {
          date: dateObj,
          zoneId: zoneId || null,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An override already exists for this date/zone. Use PATCH to update.' },
        { status: 409 }
      );
    }

    // Validate slotOverrides for ADJUST_REQUIREMENTS
    if (overrideType === 'ADJUST_REQUIREMENTS' && slotOverrides) {
      if (!Array.isArray(slotOverrides)) {
        return NextResponse.json(
          { error: 'slotOverrides must be an array' },
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

    const override = await prisma.coverageOverride.create({
      data: {
        date: dateObj,
        zoneId: zoneId || null,
        overrideType,
        slotOverrides: slotOverrides || null,
        reason: reason || null,
        createdById: user.id,
      },
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
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating coverage override:', error);
    return NextResponse.json(
      { error: 'Failed to create override' },
      { status: 500 }
    );
  }
}
