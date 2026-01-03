import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditCreate, toAuditUser } from '@/lib/audit';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { isLeadRole, isDispatcherRole, hasLeadQualification, hasDispatcherQualification, hasVerifierQualification } from '@/lib/role-utils';
import { hasElevatedPrivileges, canCreateShift, createPermissionContext } from '@/lib/permissions';

// GET /api/shifts - List shifts with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const typeConfigId = searchParams.get('typeConfigId');
    const zoneId = searchParams.get('zoneId');
    const qualifiedRoleId = searchParams.get('qualifiedRoleId');
    const status = searchParams.get('status') || 'PUBLISHED';
    const includeMyShifts = searchParams.get('myShifts') === 'true';

    const orgId = await getCurrentOrgId();

    // Check scheduling mode - in SIMPLE mode, only show shifts to qualified users
    const settings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
    const schedulingMode = settings?.schedulingMode || 'SIMPLE';

    // In SIMPLE mode, only DISPATCHER or ZONE_LEAD qualified users (or admins) can see shifts
    const ctx = createPermissionContext(user.role);
    const isAdmin = hasElevatedPrivileges(ctx);

    // Check user's qualified roles from the database (scoped to current org)
    const userQualifications = await prisma.userQualification.findMany({
      where: {
        userId: user.id,
        // Multi-org: Only check qualifications from current org's qualified roles
        qualifiedRole: orgId ? { organizationId: orgId } : {},
      },
      include: { qualifiedRole: { select: { slug: true } } },
    });
    // Check for qualifications that allow browsing all shifts
    // Lead roles (Zone Lead, Shift Lead), Dispatcher roles, and Verifier/Escort roles can all browse
    const qualificationSlugs = userQualifications.map(uq => uq.qualifiedRole.slug);
    const userCanBrowseShifts = hasLeadQualification(qualificationSlugs) ||
                                hasDispatcherQualification(qualificationSlugs) ||
                                hasVerifierQualification(qualificationSlugs);

    // If SIMPLE mode and user is not admin and doesn't have browse-able qualifications,
    // only show shifts they're already signed up for
    const simpleRestricted = schedulingMode === 'SIMPLE' && !isAdmin && !userCanBrowseShifts;

    // Strict org scoping - only show shifts for the current org
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Build filter conditions with org scoping
    const where: Record<string, unknown> = {
      ...orgFilter,
    };

    // Support both old enum filter and new typeConfigId filter
    if (typeConfigId && typeConfigId !== 'all') {
      where.typeConfigId = typeConfigId;
    } else if (type && type !== 'all') {
      where.type = type;
    }

    if (zoneId && zoneId !== 'all') {
      where.zoneId = zoneId;
    }

    // Filter by qualified role - shows shifts that have at least one volunteer with this role
    if (qualifiedRoleId && qualifiedRoleId !== 'all') {
      // Look up the role to check if it's zone-lead (which uses isZoneLead flag)
      const role = await prisma.qualifiedRole.findUnique({
        where: { id: qualifiedRoleId },
        select: { slug: true },
      });

      // Check for lead-type roles (isZoneLead flag) - using pattern-based detection
      const roleIsLead = role?.slug ? isLeadRole(role.slug) : false;
      const roleIsDispatcher = role?.slug ? isDispatcherRole(role.slug) : false;

      if (roleIsLead) {
        // Lead roles are marked with isZoneLead: true
        where.volunteers = {
          some: {
            isZoneLead: true,
          },
        };
      } else if (roleIsDispatcher) {
        // Dispatchers are stored in DispatcherAssignment, not ShiftVolunteer
        // Skip this filter - we'd need a different query approach
        // For now, just skip filtering (leave where.volunteers unset)
      } else {
        // For other roles, check qualifiedRoleId on volunteers
        where.volunteers = {
          some: {
            qualifiedRoleId: qualifiedRoleId,
          },
        };
      }
    }

    if (status !== 'all') {
      where.status = status;
    }

    // Only show today and future shifts by default (unless showing all for calendar)
    if (status !== 'all') {
      // Use start of today (midnight) to include today's shifts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.date = {
        gte: today,
      };
    }

    // In SIMPLE mode with restricted access, only show shifts user is signed up for
    if (simpleRestricted) {
      where.volunteers = {
        some: {
          userId: user.id,
        },
      };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        zone: true,
        typeConfig: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        volunteers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                countsTowardMinimum: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    // Transform to include computed fields
    const shiftsWithMeta = shifts.map(shift => {
      // Only count volunteers whose qualified role counts toward minimum (or have no role assigned)
      const countingVolunteers = shift.volunteers.filter(v =>
        v.status === 'CONFIRMED' && (v.qualifiedRole?.countsTowardMinimum !== false)
      );
      const confirmedCount = countingVolunteers.length;

      // Total confirmed (including non-counting roles like Shadowers)
      const totalConfirmed = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
      const pendingCount = shift.volunteers.filter(v => v.status === 'PENDING').length;
      const userRsvp = shift.volunteers.find(v => v.userId === user.id);

      return {
        ...shift,
        confirmedCount,        // Volunteers that count toward minimum
        totalConfirmed,        // All confirmed volunteers (including shadows)
        pendingCount,
        spotsLeft: shift.maxVolunteers - confirmedCount,
        userRsvpStatus: userRsvp?.status || null,
        userRsvpId: userRsvp?.id || null,
        // Exception fields
        hasRoleException: shift.hasRoleException,
        exceptionNotes: shift.exceptionNotes,
        exceptionReviewedAt: shift.exceptionReviewedAt,
      };
    });

    // If requesting only user's shifts, filter
    if (includeMyShifts) {
      return NextResponse.json(
        shiftsWithMeta.filter(s => s.userRsvpStatus !== null)
      );
    }

    return NextResponse.json(shiftsWithMeta);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

// Helper: Calculate all shift dates based on repeat pattern
// Uses UTC methods consistently to ensure same behavior on local dev and Vercel
function calculateRepeatDates(
  startDate: Date,
  repeat: {
    frequency: 'daily' | 'weekly' | 'custom';
    days?: number[];
    endType: 'count' | 'date';
    count?: number;
    endDate?: string;
  }
): Date[] {
  const dates: Date[] = [new Date(startDate)];
  const endDate = repeat.endType === 'date' && repeat.endDate
    ? new Date(repeat.endDate)
    : null;
  const maxCount = repeat.endType === 'count' ? (repeat.count || 4) : 52; // Max 52 weeks

  let current = new Date(startDate);

  while (dates.length < maxCount) {
    if (repeat.frequency === 'daily') {
      current = new Date(current);
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (repeat.frequency === 'weekly') {
      current = new Date(current);
      current.setUTCDate(current.getUTCDate() + 7);
    } else if (repeat.frequency === 'custom' && repeat.days && repeat.days.length > 0) {
      // Find next matching day of week (using UTC day to match client's day selection)
      current = new Date(current);
      let found = false;
      for (let i = 1; i <= 7 && !found; i++) {
        current.setUTCDate(current.getUTCDate() + 1);
        if (repeat.days.includes(current.getUTCDay())) {
          found = true;
        }
      }
      if (!found) break;
    } else {
      break;
    }

    // Check end date
    if (endDate && current > endDate) break;

    dates.push(new Date(current));
  }

  return dates;
}

// POST /api/shifts - Create a new shift (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role - coordinators, dispatchers, and admins can create shifts
    const ctx = createPermissionContext(user.role);
    if (!canCreateShift(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      type,
      title,
      description,
      date,
      startTime,
      endTime,
      zoneId,
      meetingLocation,
      minVolunteers = 2,
      idealVolunteers = 4,
      maxVolunteers = 6,
      status = 'DRAFT',
      repeat,
    } = body;

    // Validate required fields (zoneId is optional)
    if (!type || !title || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const orgId = await getOrgIdForCreate();

    // Look up the ShiftTypeConfig by slug to get its ID (scoped to current org)
    const typeOrgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const typeConfig = await prisma.shiftTypeConfig.findFirst({
      where: {
        slug: type,
        ...typeOrgFilter,
      },
    });
    const typeConfigId = typeConfig?.id || null;

    const baseDate = new Date(date);
    const baseStartTime = new Date(startTime);
    const baseEndTime = new Date(endTime);

    // Calculate time offsets from base date using UTC methods for consistent behavior
    const startHour = baseStartTime.getUTCHours();
    const startMinute = baseStartTime.getUTCMinutes();
    const endHour = baseEndTime.getUTCHours();
    const endMinute = baseEndTime.getUTCMinutes();

    // If repeat is enabled, create multiple shifts
    if (repeat && repeat.frequency) {
      const shiftDates = calculateRepeatDates(baseDate, repeat);

      const shiftsData = shiftDates.map(shiftDate => {
        const shiftStartTime = new Date(shiftDate);
        shiftStartTime.setUTCHours(startHour, startMinute, 0, 0);

        const shiftEndTime = new Date(shiftDate);
        shiftEndTime.setUTCHours(endHour, endMinute, 0, 0);

        return {
          organizationId: orgId,
          // type field is now optional - we use typeConfigId for dynamic types
          typeConfigId,
          title,
          description,
          date: shiftDate,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          zoneId,
          meetingLocation,
          minVolunteers,
          idealVolunteers,
          maxVolunteers,
          status,
          createdById: user.id,
        };
      });

      // Create all shifts
      const result = await prisma.shift.createMany({
        data: shiftsData,
      });

      // Audit log bulk shift creation
      await auditCreate(
        toAuditUser(user),
        'Shift',
        'bulk',
        { count: result.count, title, type, zoneId }
      );

      return NextResponse.json(
        { message: `Created ${result.count} shifts`, count: result.count },
        { status: 201 }
      );
    }

    // Single shift creation
    const shift = await prisma.shift.create({
      data: {
        organizationId: orgId,
        // type field is now optional - we use typeConfigId for dynamic types
        typeConfigId,
        title,
        description,
        date: baseDate,
        startTime: baseStartTime,
        endTime: baseEndTime,
        zoneId,
        meetingLocation,
        minVolunteers,
        idealVolunteers,
        maxVolunteers,
        status,
        createdById: user.id,
      },
      include: {
        zone: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Audit log shift creation
    await auditCreate(
      toAuditUser(user),
      'Shift',
      shift.id,
      { title: shift.title, type: shift.type, zoneName: shift.zone?.name || null, date: shift.date }
    );

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
  }
}
