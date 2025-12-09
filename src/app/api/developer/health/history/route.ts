import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

export async function GET() {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get health checks from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const history = await prisma.healthCheck.findMany({
      where: {
        checkedAt: { gte: since },
      },
      orderBy: { checkedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching health history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health history' },
      { status: 500 }
    );
  }
}
