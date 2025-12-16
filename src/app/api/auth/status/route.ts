import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// GET /api/auth/status - Get current user's account status
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

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
