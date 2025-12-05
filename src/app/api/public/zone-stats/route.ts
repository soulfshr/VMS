import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get all active zones
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      select: { county: true },
    });

    // Count total zones
    const zoneCount = zones.length;

    // Get unique counties (filter out null values)
    const counties = [...new Set(zones.map(z => z.county).filter(Boolean))] as string[];

    return NextResponse.json({
      zoneCount,
      counties,
    });
  } catch (error) {
    console.error('Error fetching zone stats:', error);
    return NextResponse.json({
      zoneCount: 0,
      counties: [],
    });
  }
}
