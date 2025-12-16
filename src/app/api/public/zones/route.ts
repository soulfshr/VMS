import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/public/zones - Get all active zones (public, no auth required)
export async function GET() {
  try {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
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
