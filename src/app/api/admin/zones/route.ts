import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/admin/zones - List all zones (including archived)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Allow coordinators to read zones (for email blast filtering)
    if (!['ADMINISTRATOR', 'COORDINATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const zones = await prisma.zone.findMany({
      include: {
        _count: {
          select: {
            users: true,
            shifts: true,
          },
        },
      },
      orderBy: [{ county: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}

// POST /api/admin/zones - Create new zone
export async function POST(request: Request) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, county, description, signalGroup, color, fillOpacity, strokeWeight, boundaries } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await prisma.zone.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json({ error: 'Zone with this name already exists' }, { status: 400 });
    }

    const zone = await prisma.zone.create({
      data: {
        name,
        county: county || null,
        description: description || null,
        signalGroup: signalGroup || null,
        color: color || '#3b82f6',
        fillOpacity: fillOpacity ?? 0.3,
        strokeWeight: strokeWeight ?? 2,
        boundaries: boundaries || null,
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('Error creating zone:', error);
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
  }
}
