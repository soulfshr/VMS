import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getOrgTimezone, parseDisplayDate, createHourExtractor } from '@/lib/timezone';
import { auditCreate, toAuditUser } from '@/lib/audit';
import { sendDispatcherSlotConfirmationEmail } from '@/lib/email';
import { getCurrentOrgId } from '@/lib/org-context';

// POST /api/dispatcher-assignments/claim - Self-assign to an open dispatcher slot
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getCurrentOrgId();

    // Verify user has DISPATCHER qualification (scoped to current org)
    const userQualifications = await prisma.userQualification.findMany({
      where: {
        userId: user.id,
        // Multi-org: Only check qualifications from current org's qualified roles
        qualifiedRole: orgId ? { organizationId: orgId } : {},
      },
      include: { qualifiedRole: { select: { slug: true } } },
    });
    const hasDispatcherQual = userQualifications.some(uq => uq.qualifiedRole.slug === 'DISPATCHER');

    if (!hasDispatcherQual) {
      return NextResponse.json(
        { error: 'You are not qualified as a dispatcher' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { county, date, startTime, endTime } = body;

    // Validate required fields
    if (!county || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: county, date, startTime, endTime' },
        { status: 400 }
      );
    }

    // Parse the display date using timezone-aware utility
    const timezone = await getOrgTimezone();
    const parsedDate = parseDisplayDate(date, timezone);
    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    // Check if slot is already taken (non-backup dispatcher)
    const existingAssignment = await prisma.dispatcherAssignment.findFirst({
      where: {
        county,
        date: parsedDate,
        startTime: parsedStartTime,
        isBackup: false,
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'This dispatcher slot has already been claimed' },
        { status: 409 }
      );
    }

    // Check if user already has an assignment for this time (any county)
    const userExistingAssignment = await prisma.dispatcherAssignment.findFirst({
      where: {
        userId: user.id,
        date: parsedDate,
        startTime: parsedStartTime,
      },
    });

    if (userExistingAssignment) {
      return NextResponse.json(
        { error: 'You already have a dispatcher assignment at this time' },
        { status: 409 }
      );
    }

    // Create the dispatcher assignment
    const assignment = await prisma.dispatcherAssignment.create({
      data: {
        userId: user.id,
        county,
        date: parsedDate,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        isBackup: false,
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

    // Audit log the self-assignment
    await auditCreate(
      toAuditUser(user),
      'DispatcherAssignment',
      assignment.id,
      {
        county,
        date: parsedDate.toISOString(),
        startTime: parsedStartTime.toISOString(),
        endTime: parsedEndTime.toISOString(),
        selfAssigned: true,
      }
    );

    // Get zones covered by this slot for the email
    const getHourInTimezone = createHourExtractor(timezone);
    const startHour = getHourInTimezone(parsedStartTime);
    const endHour = getHourInTimezone(parsedEndTime);

    // In REGIONAL mode, get all shifts for that time slot (not filtered by county)
    // In COUNTY mode, filter by the specific county
    const isRegionalMode = county === 'REGIONAL';
    const shiftsInSlot = await prisma.shift.findMany({
      where: {
        status: 'PUBLISHED',
        date: parsedDate,
        ...(isRegionalMode ? {} : { zone: { county } }),
      },
      include: {
        zone: { select: { name: true } },
      },
    });

    // Filter shifts that overlap with this time slot
    const zonesInSlot = [...new Set(
      shiftsInSlot
        .filter(s => {
          const shiftStartHour = getHourInTimezone(s.startTime);
          const shiftEndHour = getHourInTimezone(s.endTime);
          return shiftStartHour === startHour && shiftEndHour === endHour;
        })
        .map(s => s.zone?.name || 'Unknown')
    )];

    // Send confirmation email with calendar invite
    try {
      await sendDispatcherSlotConfirmationEmail({
        to: assignment.user.email,
        dispatcherName: assignment.user.name || 'Dispatcher',
        county,
        date: parsedDate,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        zones: zonesInSlot,
      });
    } catch (emailErr) {
      console.error('Failed to send dispatcher confirmation email:', emailErr);
      // Don't fail the claim if email fails
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error claiming dispatcher slot:', error);
    return NextResponse.json({ error: 'Failed to claim dispatcher slot' }, { status: 500 });
  }
}
