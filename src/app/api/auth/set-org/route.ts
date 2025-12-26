import { NextResponse } from 'next/server';
import { auth, unstable_update } from '@/auth';

/**
 * POST /api/auth/set-org
 *
 * Changes the currently selected organization for the logged-in user.
 * Updates the session with the new currentOrgId.
 *
 * Request body: { orgId: string }
 *
 * Returns: { success: true } on success
 * Returns: { error: string } with 4xx status on failure
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orgId } = body;

    if (typeof orgId !== 'string' || !orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      );
    }

    // Verify user has an APPROVED membership for this org
    const memberships = session.user.memberships || [];
    const membership = memberships.find(
      m => m.organizationId === orgId && m.accountStatus === 'APPROVED'
    );

    if (!membership) {
      return NextResponse.json(
        { error: 'No approved membership for this organization' },
        { status: 403 }
      );
    }

    // Update the session with the new org
    // This triggers the jwt callback with trigger="update"
    // The jwt callback checks session?.currentOrgId
    await unstable_update({
      currentOrgId: orgId,
    } as Parameters<typeof unstable_update>[0]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting org:', error);
    return NextResponse.json(
      { error: 'Failed to set organization' },
      { status: 500 }
    );
  }
}
