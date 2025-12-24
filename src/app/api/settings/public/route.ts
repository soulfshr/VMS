import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/settings/public - Get public settings (scheduling mode, etc.)
// Available to any authenticated user
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getCurrentOrgId();

    // Get organization settings (scoped to org)
    const settings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });

    return NextResponse.json({
      schedulingMode: settings?.schedulingMode || 'SIMPLE',
      primarySchedulingModel: settings?.primarySchedulingModel || 'COVERAGE_GRID',
      autoConfirmRsvp: settings?.autoConfirmRsvp || false,
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
