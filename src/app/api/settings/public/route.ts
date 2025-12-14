import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/settings/public - Get public settings (scheduling mode, etc.)
// Available to any authenticated user
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization settings
    const settings = await prisma.organizationSettings.findFirst();

    return NextResponse.json({
      schedulingMode: settings?.schedulingMode || 'SIMPLE',
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
