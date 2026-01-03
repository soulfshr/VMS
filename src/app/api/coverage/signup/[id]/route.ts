import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { sendCoverageCancellationEmail } from '@/lib/email';
import { dateToString, isBeforeToday } from '@/lib/dates';
import { canManageOrgSettings, createPermissionContext } from '@/lib/permissions';

/**
 * DELETE /api/coverage/signup/[id]
 *
 * Cancel a coverage signup. Users can only cancel their own signups.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the signup
    const signup = await prisma.coverageSignup.findUnique({
      where: { id },
      include: {
        zone: { select: { name: true, county: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!signup) {
      return NextResponse.json(
        { error: 'Signup not found' },
        { status: 404 }
      );
    }

    // Check ownership (users can only cancel their own signups)
    // Admins, coordinators, and developers can cancel any signup
    const ctx = createPermissionContext(user.role);
    const canCancel = signup.userId === user.id || canManageOrgSettings(ctx);

    if (!canCancel) {
      return NextResponse.json(
        { error: 'You can only cancel your own signups' },
        { status: 403 }
      );
    }

    // Don't allow canceling past signups (use Eastern Time for "today")
    const signupDateStr = dateToString(signup.date);
    if (isBeforeToday(signupDateStr)) {
      return NextResponse.json(
        { error: 'Cannot cancel past signups' },
        { status: 400 }
      );
    }

    // Delete the signup
    await prisma.coverageSignup.delete({
      where: { id },
    });

    // Send cancellation email
    const isCoordinator = signup.roleType === 'DISPATCH_COORDINATOR';
    const zoneName = isCoordinator ? 'Regional Coordinator' : (signup.zone?.name || 'Unknown');
    const county = isCoordinator ? 'Triangle Region' : (signup.zone?.county || 'Unknown');

    try {
      await sendCoverageCancellationEmail({
        to: signup.user.email,
        volunteerName: signup.user.name,
        zoneName,
        county,
        date: signup.date,
        startHour: signup.startHour,
        endHour: signup.endHour,
        roleType: isCoordinator ? 'DISPATCHER' : (signup.roleType as 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER'),
        orgId: signup.organizationId || undefined, // Multi-tenant: Use org-specific branding
      });
    } catch (emailErr) {
      console.error('Failed to send coverage cancellation email:', emailErr);
      // Don't fail the cancellation if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Cancelled signup for ${zoneName} on ${signup.date.toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error('Error cancelling coverage signup:', error);
    return NextResponse.json(
      { error: 'Failed to cancel signup' },
      { status: 500 }
    );
  }
}
