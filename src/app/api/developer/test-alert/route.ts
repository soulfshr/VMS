import { NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { sendAlert } from '@/lib/alerts';

/**
 * POST /api/developer/test-alert
 * Triggers a test alert email to all configured recipients
 * Requires DEVELOPER role
 */
export async function POST() {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await sendAlert(
      'test_alert',
      `This is a test alert triggered by ${user.name || user.email} from the Developer Dashboard.`,
      {
        triggeredBy: user.email,
        timestamp: new Date().toISOString(),
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'unknown',
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Test alert sent to all configured recipients',
    });
  } catch (error) {
    console.error('Error sending test alert:', error);
    return NextResponse.json(
      { error: 'Failed to send test alert', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
