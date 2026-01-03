import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getOrgTimezone, parseDisplayDate } from '@/lib/timezone';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { canManageDispatcherAssignments, createPermissionContext } from '@/lib/permissions';

// GET /api/dispatcher-assignments - List dispatcher assignments with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const county = searchParams.get('county');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Build filter conditions with org scoping
    const where: Record<string, unknown> = {
      ...orgFilter,
    };

    if (county && county !== 'all') {
      where.county = county;
    }

    // Parse dates for DATE-only column filtering
    // Use UTC noon to ensure correct date comparison regardless of server timezone
    const parseDateString = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    };

    if (startDate) {
      where.date = {
        ...((where.date as object) || {}),
        gte: parseDateString(startDate),
      };
    }

    if (endDate) {
      where.date = {
        ...((where.date as object) || {}),
        lte: parseDateString(endDate),
      };
    }

    const assignments = await prisma.dispatcherAssignment.findMany({
      where,
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
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching dispatcher assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch dispatcher assignments' }, { status: 500 });
  }
}

// POST /api/dispatcher-assignments - Create a new dispatcher assignment (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    const ctx = createPermissionContext(user.role);
    if (!canManageDispatcherAssignments(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      userId,
      county,
      date,
      startTime,
      endTime,
      isBackup = false,
      notes,
    } = body;

    // Validate required fields
    if (!userId || !county || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get org context
    const orgId = await getCurrentOrgId();

    // Check if user exists AND is a member of the current organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        // Multi-tenant: user must be a member of the current org
        memberships: orgId ? {
          some: {
            organizationId: orgId,
            isActive: true,
          },
        } : {},
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found in this organization' }, { status: 404 });
    }

    // Use upsert to handle case where assignment already exists for this user/county/date/time
    // This can happen when re-assigning the same person or when timezone changes cause mismatches

    // Parse the display date using timezone-aware utility
    // This properly converts "2025-12-15" in ET to the correct UTC Date for storage
    const timezone = await getOrgTimezone();
    const parsedDate = parseDisplayDate(date, timezone);

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    // Use orgId from earlier check (or get it for create if not set)
    const orgIdForCreate = orgId || await getOrgIdForCreate();

    const assignment = await prisma.dispatcherAssignment.upsert({
      where: {
        userId_county_date_startTime: {
          userId,
          county,
          date: parsedDate,
          startTime: parsedStartTime,
        },
      },
      update: {
        endTime: parsedEndTime,
        isBackup,
        notes,
        createdById: user.id,
      },
      create: {
        organizationId: orgIdForCreate,
        userId,
        county,
        date: parsedDate,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        isBackup,
        notes,
        createdById: user.id,
      },
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

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error creating dispatcher assignment:', error);
    // Check for unique constraint violation
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Dispatcher already assigned to this time block' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create dispatcher assignment' }, { status: 500 });
  }
}
