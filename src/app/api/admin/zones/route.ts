import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditCreate, toAuditUser } from '@/lib/audit';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { hasElevatedPrivileges, canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/admin/zones - List all zones (including archived)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Allow coordinators, dispatchers, and developers to read zones
    const ctx = createPermissionContext(user.role);
    if (!hasElevatedPrivileges(ctx)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();

    // Strict org scoping - only show zones for the current org
    // If no org selected, use impossible filter to prevent data leakage
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const zones = await prisma.zone.findMany({
      where: orgFilter,
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
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orgId = await getOrgIdForCreate();

    const body = await request.json();
    const { name, county, description, signalGroup, color, fillOpacity, strokeWeight, boundaries } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check for duplicate name within the organization
    // If no org, use impossible filter (shouldn't create records without org context)
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const existing = await prisma.zone.findFirst({
      where: {
        name,
        ...orgFilter,
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Zone with this name already exists' }, { status: 400 });
    }

    const zone = await prisma.zone.create({
      data: {
        organizationId: orgId,
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

    // Audit log the zone creation
    await auditCreate(
      toAuditUser(user),
      'Zone',
      zone.id,
      { name: zone.name, county: zone.county }
    );

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('Error creating zone:', error);
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
  }
}
