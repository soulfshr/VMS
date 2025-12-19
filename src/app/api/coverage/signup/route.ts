import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { CoverageRoleType, RSVPStatus } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';
import { sendCoverageSignupConfirmationEmail } from '@/lib/email';
import {
  getTodayET,
  parseDateStringToUTC,
  getDayOfWeekFromDateString,
  dateToString,
  isBeforeToday,
} from '@/lib/dates';

/**
 * POST /api/coverage/signup
 *
 * Sign up for a coverage slot.
 * Body: { date: string, zoneId?: string, startHour: number, endHour: number, roleType: string }
 *
 * For zone-based roles (DISPATCHER, ZONE_LEAD, VERIFIER): zoneId is required
 * For regional roles (DISPATCH_COORDINATOR): zoneId should be omitted/null
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, zoneId, startHour, endHour, roleType } = body;

    // Validate required fields (zoneId is optional for DISPATCH_COORDINATOR)
    if (!date || startHour === undefined || endHour === undefined || !roleType) {
      return NextResponse.json(
        { error: 'Missing required fields: date, startHour, endHour, roleType' },
        { status: 400 }
      );
    }

    // Validate roleType
    const validRoles = ['DISPATCHER', 'ZONE_LEAD', 'VERIFIER', 'DISPATCH_COORDINATOR'];
    if (!validRoles.includes(roleType)) {
      return NextResponse.json(
        { error: 'Invalid roleType. Must be DISPATCHER, ZONE_LEAD, VERIFIER, or DISPATCH_COORDINATOR' },
        { status: 400 }
      );
    }

    const isCoordinatorRole = roleType === 'DISPATCH_COORDINATOR';

    // For zone-based roles, zoneId is required
    if (!isCoordinatorRole && !zoneId) {
      return NextResponse.json(
        { error: 'zoneId is required for zone-based roles' },
        { status: 400 }
      );
    }

    // Check user has the required qualification for this role
    const userQualifications = await prisma.userQualification.findMany({
      where: { userId: user.id },
      include: { qualifiedRole: { select: { slug: true } } },
    });

    const hasRequiredQualification = userQualifications.some(
      uq => uq.qualifiedRole.slug === roleType
    );

    if (!hasRequiredQualification) {
      const roleLabels: Record<string, string> = {
        'ZONE_LEAD': 'Zone Lead',
        'DISPATCHER': 'Dispatcher',
        'VERIFIER': 'Verifier',
        'DISPATCH_COORDINATOR': 'Dispatch Coordinator',
      };
      return NextResponse.json(
        { error: `You must have the ${roleLabels[roleType]} qualification to sign up for this role` },
        { status: 403 }
      );
    }

    // Parse date as UTC midnight (database stores dates as @db.Date = UTC midnight)
    // The incoming 'date' should be a YYYY-MM-DD string
    const dateStr = date as string;
    const signupDate = parseDateStringToUTC(dateStr);

    // Don't allow signups for past dates (compare using Eastern Time for "today")
    if (isBeforeToday(dateStr)) {
      return NextResponse.json(
        { error: 'Cannot sign up for past dates' },
        { status: 400 }
      );
    }

    // Handle DISPATCH_COORDINATOR signup (regional, no zone)
    if (isCoordinatorRole) {
      // Check if coordinator slot is already filled
      const existingCoordinator = await prisma.coverageSignup.findFirst({
        where: {
          date: signupDate,
          startHour,
          zoneId: null,
          roleType: 'DISPATCH_COORDINATOR',
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      });

      if (existingCoordinator) {
        return NextResponse.json(
          { error: 'Dispatch Coordinator position is already filled for this time slot' },
          { status: 400 }
        );
      }

      // Check if user already signed up as coordinator for this slot
      const userExistingSignup = await prisma.coverageSignup.findFirst({
        where: {
          date: signupDate,
          startHour,
          userId: user.id,
          zoneId: null,
          roleType: 'DISPATCH_COORDINATOR',
        },
      });

      if (userExistingSignup) {
        return NextResponse.json(
          { error: 'You are already signed up for this coordinator slot' },
          { status: 400 }
        );
      }

      // Create the coordinator signup
      const signup = await prisma.coverageSignup.create({
        data: {
          date: signupDate,
          zoneId: null,
          startHour,
          endHour,
          userId: user.id,
          roleType: 'DISPATCH_COORDINATOR',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      });

      // Send confirmation email
      try {
        await sendCoverageSignupConfirmationEmail({
          to: signup.user.email,
          volunteerName: signup.user.name,
          zoneName: 'Regional Coordinator',
          county: 'Triangle Region',
          date: signup.date,
          startHour: signup.startHour,
          endHour: signup.endHour,
          roleType: 'DISPATCHER', // Use DISPATCHER template for coordinator emails
        });
      } catch (emailErr) {
        console.error('Failed to send coverage confirmation email:', emailErr);
      }

      return NextResponse.json({
        success: true,
        signup: {
          id: signup.id,
          date: dateToString(signup.date),
          zoneId: null,
          zoneName: 'Regional Coordinator',
          startHour: signup.startHour,
          endHour: signup.endHour,
          roleType: signup.roleType,
        },
      });
    }

    // Handle zone-based signup (DISPATCHER, ZONE_LEAD, VERIFIER)
    // Verify zone exists
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
    });

    if (!zone || !zone.isActive) {
      return NextResponse.json(
        { error: 'Zone not found or inactive' },
        { status: 404 }
      );
    }

    // Check if slot config exists for this day (use date string for timezone-safe calculation)
    const dayOfWeek = getDayOfWeekFromDateString(dateStr);
    const config = await prisma.coverageConfig.findUnique({
      where: {
        zoneId_dayOfWeek: {
          zoneId,
          dayOfWeek,
        },
      },
    });

    if (!config || !config.isActive) {
      return NextResponse.json(
        { error: 'No coverage slots configured for this zone/day' },
        { status: 400 }
      );
    }

    // Verify the time slot exists in config
    const configSlots = config.slots as Array<{ start: number; end: number }>;
    const slotExists = configSlots.some(
      s => s.start === startHour && s.end === endHour
    );

    if (!slotExists) {
      return NextResponse.json(
        { error: 'Time slot not configured for this zone/day' },
        { status: 400 }
      );
    }

    // Check if user already signed up for this slot
    const existingSignup = await prisma.coverageSignup.findUnique({
      where: {
        date_zoneId_startHour_userId: {
          date: signupDate,
          zoneId,
          startHour,
          userId: user.id,
        },
      },
    });

    if (existingSignup) {
      return NextResponse.json(
        { error: 'You are already signed up for this slot' },
        { status: 400 }
      );
    }

    // For ZONE_LEAD and DISPATCHER, check if position is already filled
    if (roleType === 'ZONE_LEAD' || roleType === 'DISPATCHER') {
      const existingLead = await prisma.coverageSignup.findFirst({
        where: {
          date: signupDate,
          zoneId,
          startHour,
          roleType: roleType as CoverageRoleType,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      });

      if (existingLead) {
        return NextResponse.json(
          { error: `${roleType === 'ZONE_LEAD' ? 'Zone Lead' : 'Dispatcher'} position is already filled` },
          { status: 400 }
        );
      }
    }

    // Create the signup
    const signup = await prisma.coverageSignup.create({
      data: {
        date: signupDate,
        zoneId,
        startHour,
        endHour,
        userId: user.id,
        roleType: roleType as CoverageRoleType,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        zone: {
          select: { name: true, county: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    // Send confirmation email with calendar invite
    try {
      await sendCoverageSignupConfirmationEmail({
        to: signup.user.email,
        volunteerName: signup.user.name,
        zoneName: signup.zone!.name,
        county: signup.zone!.county || 'Unknown',
        date: signup.date,
        startHour: signup.startHour,
        endHour: signup.endHour,
        roleType: signup.roleType as 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER',
      });
    } catch (emailErr) {
      console.error('Failed to send coverage confirmation email:', emailErr);
      // Don't fail the signup if email fails
    }

    return NextResponse.json({
      success: true,
      signup: {
        id: signup.id,
        date: dateToString(signup.date),
        zoneId: signup.zoneId,
        zoneName: signup.zone!.name,
        startHour: signup.startHour,
        endHour: signup.endHour,
        roleType: signup.roleType,
      },
    });
  } catch (error) {
    console.error('Error creating coverage signup:', error);
    return NextResponse.json({ error: 'Failed to create signup' }, { status: 500 });
  }
}

/**
 * GET /api/coverage/signup
 *
 * Get current user's signups, optionally filtered by date range.
 * Query params: startDate, endDate (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to today and future (upcoming signups only)
    const todayStr = getTodayET();
    const todayDate = parseDateStringToUTC(todayStr);

    const where: Prisma.CoverageSignupWhereInput = {
      userId: user.id,
      status: { in: [RSVPStatus.CONFIRMED, RSVPStatus.PENDING] },
      date: { gte: todayDate }, // Default: only today and future
    };

    // Override date filter if explicit params provided
    if (startDateParam || endDateParam) {
      where.date = {};
      if (startDateParam) {
        // Parse as UTC midnight to match database storage
        (where.date as Prisma.DateTimeFilter).gte = parseDateStringToUTC(startDateParam);
      } else {
        // If only endDate provided, still default to today as start
        (where.date as Prisma.DateTimeFilter).gte = todayDate;
      }
      if (endDateParam) {
        // Parse as UTC end of day for inclusive range
        const endDate = parseDateStringToUTC(endDateParam);
        endDate.setUTCHours(23, 59, 59, 999);
        (where.date as Prisma.DateTimeFilter).lte = endDate;
      }
    }

    const signups = await prisma.coverageSignup.findMany({
      where,
      include: {
        zone: {
          select: { name: true, county: true },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startHour: 'asc' },
      ],
    });

    return NextResponse.json({
      signups: signups.map(s => ({
        id: s.id,
        date: dateToString(s.date),
        zoneId: s.zoneId,
        zoneName: s.zone?.name || (s.roleType === 'DISPATCH_COORDINATOR' ? 'Regional Coordinator' : 'Unknown'),
        county: s.zone?.county || (s.roleType === 'DISPATCH_COORDINATOR' ? 'Triangle Region' : null),
        startHour: s.startHour,
        endHour: s.endHour,
        roleType: s.roleType,
        status: s.status,
      })),
    });
  } catch (error) {
    console.error('Error fetching coverage signups:', error);
    return NextResponse.json({ error: 'Failed to fetch signups' }, { status: 500 });
  }
}
