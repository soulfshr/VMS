import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { sendShiftInviteEmail } from '@/lib/email';
import { getCurrentOrgId } from '@/lib/org-context';
import { canAddVolunteersToShift, createPermissionContext } from '@/lib/permissions';

// POST /api/shifts/[id]/add-volunteer - Add a volunteer to a shift (Coordinator/Admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can add volunteers
    const ctx = createPermissionContext(user.role);
    if (!canAddVolunteersToShift(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: shiftId } = await params;
    const body = await request.json();
    const { volunteerId, isZoneLead } = body;

    if (!volunteerId) {
      return NextResponse.json(
        { error: 'volunteerId is required' },
        { status: 400 }
      );
    }

    // Get org context
    const orgId = await getCurrentOrgId();

    // Check if shift exists AND belongs to current org
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        // Multi-tenant: shift must belong to current org
        ...(orgId ? { organizationId: orgId } : {}),
      },
      include: {
        zone: true,
        typeConfig: { select: { name: true } },
        volunteers: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Check if volunteer exists and is a member of the shift's organization
    const volunteer = await prisma.user.findFirst({
      where: {
        id: volunteerId,
        // Multi-tenant: volunteer must be a member of the shift's organization
        memberships: shift.organizationId ? {
          some: {
            organizationId: shift.organizationId,
            accountStatus: 'APPROVED',
          },
        } : {},
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    if (!volunteer.isActive) {
      return NextResponse.json(
        { error: 'Volunteer is not active' },
        { status: 400 }
      );
    }

    // Check if volunteer is already on this shift
    const existingRsvp = shift.volunteers.find(v => v.userId === volunteerId);
    if (existingRsvp) {
      // If already on shift and we're trying to make them zone lead, update instead
      if (isZoneLead && !existingRsvp.isZoneLead) {
        const updatedRsvp = await prisma.shiftVolunteer.update({
          where: { id: existingRsvp.id },
          data: { isZoneLead: true },
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
        return NextResponse.json(updatedRsvp, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Volunteer is already signed up for this shift' },
        { status: 400 }
      );
    }

    // Check if shift is full
    const confirmedCount = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
    if (confirmedCount >= shift.maxVolunteers) {
      return NextResponse.json(
        { error: 'This shift is full' },
        { status: 400 }
      );
    }

    // Create RSVP with CONFIRMED status (coordinator is adding them directly)
    const rsvp = await prisma.shiftVolunteer.create({
      data: {
        shiftId,
        userId: volunteerId,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        isZoneLead: isZoneLead || false,
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

    // Send invite email with calendar invite
    const shiftType = shift.typeConfig?.name || shift.type?.replace(/_/g, ' ') || 'Shift';
    sendShiftInviteEmail({
      to: volunteer.email,
      volunteerName: volunteer.name,
      shiftTitle: shift.title,
      shiftType,
      shiftDate: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      zoneName: shift.zone?.name || '',
      description: shift.description || undefined,
      coordinatorName: user.name,
      orgId: shift.organizationId || undefined, // Multi-tenant: Use org-specific branding
    }).catch(err => console.error('Email send error:', err));

    return NextResponse.json(rsvp, { status: 201 });
  } catch (error) {
    console.error('Error adding volunteer to shift:', error);
    return NextResponse.json(
      { error: 'Failed to add volunteer to shift' },
      { status: 500 }
    );
  }
}
