import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/public/zones - Get all active zones for current org (public, no auth required)
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();

    const zones = await prisma.zone.findMany({
      where: {
        isActive: true,
        // Multi-tenant: scope to current org (or null for legacy data)
        OR: orgId
          ? [{ organizationId: orgId }, { organizationId: null }]
          : [{ organizationId: null }],
      },
      select: {
        id: true,
        name: true,
        county: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ zones });
  } catch (error) {
    console.error('Error fetching public zones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zones' },
      { status: 500 }
    );
  }
}
