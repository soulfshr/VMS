import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/coordinator/qualified-roles - List all qualified roles (read-only)
// Accessible by COORDINATOR, DISPATCHER, and ADMINISTRATOR
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow coordinator, dispatcher, and admin
    if (!['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: {
        isActive: true,
        ...orgFilter,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
      },
    });

    return NextResponse.json(qualifiedRoles);
  } catch (error) {
    console.error('Error fetching qualified roles:', error);
    return NextResponse.json({ error: 'Failed to fetch qualified roles' }, { status: 500 });
  }
}
