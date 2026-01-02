import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';

// GET /api/regional-lead-assignments - List regional lead assignments with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
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

    const assignments = await prisma.regionalLeadAssignment.findMany({
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
        { isPrimary: 'desc' }, // Primary leads first
      ],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching regional lead assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch regional lead assignments' }, { status: 500 });
  }
}

// POST /api/regional-lead-assignments - Create a new regional lead assignment
// Coordinators/Admins can assign anyone with REGIONAL_LEAD qualification
// Volunteers with REGIONAL_LEAD qualification can self-signup
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      userId, // Optional - if not provided, use current user (self-signup)
      date,
      isPrimary = false,
      notes,
    } = body;

    // Validate required fields
    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    // Determine target user
    const targetUserId = userId || user.id;
    const isSelfSignup = targetUserId === user.id;

    // If assigning someone else, must be Coordinator or Admin
    if (!isSelfSignup && !['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - cannot assign other users' }, { status: 403 });
    }

    // Get org context for filtering
    const orgId = await getCurrentOrgId();

    // Get the REGIONAL_LEAD qualified role (scoped to current org)
    const regionalLeadRole = await prisma.qualifiedRole.findFirst({
      where: {
        slug: 'REGIONAL_LEAD',
        // Multi-tenant: only match role from current org
        ...(orgId ? { organizationId: orgId } : {}),
      },
    });

    if (!regionalLeadRole) {
      return NextResponse.json({ error: 'Dispatch Coordinator role not configured' }, { status: 500 });
    }

    // Check if target user has REGIONAL_LEAD qualification AND is member of current org
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        // Multi-tenant: user must be a member of the current org
        memberships: orgId ? {
          some: {
            organizationId: orgId,
            isActive: true,
          },
        } : {},
      },
      include: {
        userQualifications: {
          where: { qualifiedRoleId: regionalLeadRole.id },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found in this organization' }, { status: 404 });
    }

    if (targetUser.userQualifications.length === 0) {
      return NextResponse.json(
        { error: isSelfSignup
          ? 'You do not have Dispatch Coordinator qualification'
          : 'User does not have Dispatch Coordinator qualification'
        },
        { status: 403 }
      );
    }

    // Parse date correctly for DATE-only storage
    // Use UTC noon to ensure PostgreSQL DATE stores the correct calendar date
    // regardless of server timezone
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    // Use orgId from earlier check (or get it for create if not set)
    const orgIdForCreate = orgId || await getOrgIdForCreate();

    // Create the assignment
    const assignment = await prisma.regionalLeadAssignment.create({
      data: {
        organizationId: orgIdForCreate,
        userId: targetUserId,
        date: dateObj,
        isPrimary,
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
    console.error('Error creating regional lead assignment:', error);
    // Check for unique constraint violation
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'User already assigned as Dispatch Coordinator for this date' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create regional lead assignment' }, { status: 500 });
  }
}
