import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { sendShiftConfirmationEmail } from '@/lib/email';

// POST /api/shifts/confirm-rsvps - Confirm all pending RSVPs for selected shifts (Coordinator/Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can confirm RSVPs
    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { shiftIds } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'No shifts specified' },
        { status: 400 }
      );
    }

    // Find all pending RSVPs for the selected shifts
    const pendingRsvps = await prisma.shiftVolunteer.findMany({
      where: {
        shiftId: { in: shiftIds },
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        shift: {
          include: {
            zone: true,
            typeConfig: { select: { name: true } },
          },
        },
      },
    });

    if (pendingRsvps.length === 0) {
      return NextResponse.json(
        { error: 'No pending RSVPs found for selected shifts' },
        { status: 400 }
      );
    }

    // Update all pending RSVPs to CONFIRMED
    await prisma.shiftVolunteer.updateMany({
      where: {
        id: { in: pendingRsvps.map(r => r.id) },
      },
      data: {
        status: 'CONFIRMED',
      },
    });

    // Send confirmation emails with calendar invites
    const emailPromises: Promise<void>[] = [];

    for (const rsvp of pendingRsvps) {
      const shiftType = rsvp.shift.typeConfig?.name || rsvp.shift.type?.replace(/_/g, ' ') || 'Shift';
      emailPromises.push(
        sendShiftConfirmationEmail({
          to: rsvp.user.email,
          volunteerName: rsvp.user.name,
          shiftTitle: rsvp.shift.title,
          shiftType,
          shiftDate: rsvp.shift.date,
          startTime: rsvp.shift.startTime,
          endTime: rsvp.shift.endTime,
          zoneName: rsvp.shift.zone?.name || '',
          description: rsvp.shift.description || undefined,
          orgId: rsvp.shift.organizationId || undefined, // Multi-tenant: Use org-specific branding
        })
      );
    }

    // Send all emails - must await to ensure completion before serverless function terminates
    try {
      await Promise.all(emailPromises);
    } catch (err) {
      console.error('[Confirm RSVPs] Error sending confirmation emails:', err);
      // Log but don't fail the request - RSVPs were already confirmed
    }

    // Count unique shifts affected
    const uniqueShifts = new Set(pendingRsvps.map(r => r.shiftId));

    return NextResponse.json({
      message: `Confirmed ${pendingRsvps.length} RSVP(s)`,
      confirmedCount: pendingRsvps.length,
      shiftsAffected: uniqueShifts.size,
    });
  } catch (error) {
    console.error('Error confirming RSVPs:', error);
    return NextResponse.json(
      { error: 'Failed to confirm RSVPs' },
      { status: 500 }
    );
  }
}
