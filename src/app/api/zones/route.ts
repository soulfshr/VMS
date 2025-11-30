import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/zones - List all active zones
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const zones = await prisma.zone.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { county: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}
