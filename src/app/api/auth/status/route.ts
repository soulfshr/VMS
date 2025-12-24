import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/auth/status - Get current user's account status
// Multi-org aware: Returns org-specific membership status when org context is available
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const orgId = await getCurrentOrgId();

    // Multi-org: Check membership status for current org
    if (orgId && session.user.id) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: orgId,
          },
        },
        include: {
          user: {
            select: {
              name: true,
              isVerified: true,
            },
          },
        },
      });

      if (membership) {
        return NextResponse.json({
          accountStatus: membership.accountStatus,
          isVerified: membership.user.isVerified,
          name: membership.user.name,
          applicationDate: membership.applicationDate,
          rejectionReason: membership.rejectionReason,
          // Include org info for context
          organizationId: orgId,
        });
      }
    }

    // Fallback: Get user directly (legacy behavior)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        accountStatus: true,
        isVerified: true,
        applicationDate: true,
        rejectionReason: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      accountStatus: user.accountStatus,
      isVerified: user.isVerified,
      name: user.name,
      applicationDate: user.applicationDate,
      rejectionReason: user.rejectionReason,
    });
  } catch (error) {
    console.error('[Auth Status] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
