import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// DEBUG ENDPOINT - Get raw session data
// This helps diagnose issues with session/token data
export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    return NextResponse.json({
      session: {
        user: session.user,
        expires: session.expires,
      },
      userKeys: session.user ? Object.keys(session.user) : [],
      accountStatus: session.user?.accountStatus,
      rawUser: JSON.parse(JSON.stringify(session.user)),
    });
  } catch (error) {
    console.error('[Debug Session] Error:', error);
    return NextResponse.json({ error: 'Error getting session' }, { status: 500 });
  }
}
