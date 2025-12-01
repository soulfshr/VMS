import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/admin/settings - Get organization settings
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get or create settings singleton
    let settings = await prisma.organizationSettings.findFirst();
    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          autoConfirmRsvp: false,
          timezone: 'America/New_York',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/admin/settings - Update organization settings
export async function PUT(request: Request) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { autoConfirmRsvp, timezone } = body;

    // Get or create settings singleton
    let settings = await prisma.organizationSettings.findFirst();
    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          autoConfirmRsvp: autoConfirmRsvp ?? false,
          timezone: timezone ?? 'America/New_York',
        },
      });
    } else {
      settings = await prisma.organizationSettings.update({
        where: { id: settings.id },
        data: {
          ...(autoConfirmRsvp !== undefined && { autoConfirmRsvp }),
          ...(timezone !== undefined && { timezone }),
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
