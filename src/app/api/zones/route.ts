import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/zones - List all zones (authenticated)
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const zones = await prisma.zone.findMany({
      where: includeInactive ? {} : { isActive: true },
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

// POST /api/zones - Create a new zone (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, county, description, signalGroup, boundaries, color, fillOpacity, strokeWeight } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const zone = await prisma.zone.create({
      data: {
        name,
        county: county || null,
        description: description || null,
        signalGroup: signalGroup || null,
        boundaries: boundaries || null,
        color: color || '#3b82f6',
        fillOpacity: fillOpacity ?? 0.3,
        strokeWeight: strokeWeight ?? 2,
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('Error creating zone:', error);
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
  }
}
