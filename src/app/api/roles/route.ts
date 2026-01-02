import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

/**
 * GET /api/roles - Fetch qualified roles for the current organization
 *
 * This is a lightweight, read-only endpoint accessible to all authenticated users.
 * Used by the useOrgRoles hook to provide dynamic role display names.
 */
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getCurrentOrgId();

    // If no org selected, return empty array
    if (!orgId) {
      return NextResponse.json([]);
    }

    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        description: true,
        countsTowardMinimum: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(qualifiedRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}
