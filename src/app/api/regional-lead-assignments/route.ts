import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

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

    // Build filter conditions
    const where: Record<string, unknown> = {};

    if (startDate) {
      where.date = {
        ...((where.date as object) || {}),
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.date = {
        ...((where.date as object) || {}),
        lte: new Date(endDate),
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
    if (!isSelfSignup && !['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - cannot assign other users' }, { status: 403 });
    }

    // Get the REGIONAL_LEAD qualified role
    const regionalLeadRole = await prisma.qualifiedRole.findUnique({
      where: { slug: 'REGIONAL_LEAD' },
    });

    if (!regionalLeadRole) {
      return NextResponse.json({ error: 'Regional Lead role not configured' }, { status: 500 });
    }

    // Check if target user has REGIONAL_LEAD qualification
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userQualifications: {
          where: { qualifiedRoleId: regionalLeadRole.id },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.userQualifications.length === 0) {
      return NextResponse.json(
        { error: isSelfSignup
          ? 'You do not have Regional Lead qualification'
          : 'User does not have Regional Lead qualification'
        },
        { status: 403 }
      );
    }

    // Create the assignment
    const assignment = await prisma.regionalLeadAssignment.create({
      data: {
        userId: targetUserId,
        date: new Date(date),
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
        { error: 'User already assigned as Regional Lead for this date' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create regional lead assignment' }, { status: 500 });
  }
}
