import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { canManageOrgSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/coordinator/settings - Get scheduling settings
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canManageOrgSettings(ctx)) {
      return NextResponse.json({ error: 'Coordinator access required' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();

    // Get or create settings (scoped to org)
    let settings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
    if (!settings) {
      const createOrgId = await getOrgIdForCreate();
      settings = await prisma.organizationSettings.create({
        data: {
          organizationId: createOrgId,
          autoConfirmRsvp: false,
          timezone: 'America/New_York',
        },
      });
    }

    // Return only scheduling-related settings
    return NextResponse.json({
      id: settings.id,
      dispatcherSchedulingMode: settings.dispatcherSchedulingMode,
      schedulingMode: settings.schedulingMode,
    });
  } catch (error) {
    console.error('Error fetching coordinator settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/coordinator/settings - Update scheduling settings
export async function PUT(request: Request) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canManageOrgSettings(ctx)) {
      return NextResponse.json({ error: 'Coordinator access required' }, { status: 403 });
    }

    const body = await request.json();
    const { dispatcherSchedulingMode, schedulingMode } = body;

    // Validate dispatcher scheduling mode
    if (dispatcherSchedulingMode !== undefined) {
      if (!['REGIONAL', 'COUNTY', 'ZONE'].includes(dispatcherSchedulingMode)) {
        return NextResponse.json({ error: 'Dispatcher scheduling mode must be REGIONAL, COUNTY, or ZONE' }, { status: 400 });
      }
    }

    // Validate volunteer scheduling mode
    if (schedulingMode !== undefined) {
      if (!['SIMPLE', 'FULL'].includes(schedulingMode)) {
        return NextResponse.json({ error: 'Scheduling mode must be SIMPLE or FULL' }, { status: 400 });
      }
    }

    const orgId = await getCurrentOrgId();

    // Get or create settings (scoped to org)
    let settings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });
    if (!settings) {
      const createOrgId = await getOrgIdForCreate();
      settings = await prisma.organizationSettings.create({
        data: {
          organizationId: createOrgId,
          autoConfirmRsvp: false,
          timezone: 'America/New_York',
          dispatcherSchedulingMode: dispatcherSchedulingMode ?? 'ZONE',
          schedulingMode: schedulingMode ?? 'SIMPLE',
        },
      });
    } else {
      settings = await prisma.organizationSettings.update({
        where: { id: settings.id },
        data: {
          ...(dispatcherSchedulingMode !== undefined && { dispatcherSchedulingMode }),
          ...(schedulingMode !== undefined && { schedulingMode }),
        },
      });
    }

    // Return only scheduling-related settings
    return NextResponse.json({
      id: settings.id,
      dispatcherSchedulingMode: settings.dispatcherSchedulingMode,
      schedulingMode: settings.schedulingMode,
    });
  } catch (error) {
    console.error('Error updating coordinator settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
