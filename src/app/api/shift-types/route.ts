import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/shift-types - List active shift types (for dropdowns/filters)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const shiftTypes = await prisma.shiftTypeConfig.findMany({
      where: {
        isActive: true,
        ...orgFilter,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        defaultMinVolunteers: true,
        defaultIdealVolunteers: true,
        defaultMaxVolunteers: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(shiftTypes);
  } catch (error) {
    console.error('Error fetching shift types:', error);
    return NextResponse.json({ error: 'Failed to fetch shift types' }, { status: 500 });
  }
}
