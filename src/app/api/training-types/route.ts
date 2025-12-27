import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/training-types - List active training types (for dropdowns/filters)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    const trainingTypes = await prisma.trainingType.findMany({
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
        defaultDuration: true,
        defaultCapacity: true,
        grantsRole: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(trainingTypes);
  } catch (error) {
    console.error('Error fetching training types:', error);
    return NextResponse.json({ error: 'Failed to fetch training types' }, { status: 500 });
  }
}
