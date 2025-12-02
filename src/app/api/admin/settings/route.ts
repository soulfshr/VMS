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
    const { autoConfirmRsvp, timezone, maxUploadSizeMb, maxUploadsPerReport } = body;

    // Validate upload settings
    if (maxUploadSizeMb !== undefined && (maxUploadSizeMb < 1 || maxUploadSizeMb > 100)) {
      return NextResponse.json({ error: 'Max upload size must be between 1 and 100 MB' }, { status: 400 });
    }
    if (maxUploadsPerReport !== undefined && (maxUploadsPerReport < 1 || maxUploadsPerReport > 20)) {
      return NextResponse.json({ error: 'Max uploads per report must be between 1 and 20' }, { status: 400 });
    }

    // Get or create settings singleton
    let settings = await prisma.organizationSettings.findFirst();
    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          autoConfirmRsvp: autoConfirmRsvp ?? false,
          timezone: timezone ?? 'America/New_York',
          maxUploadSizeMb: maxUploadSizeMb ?? 50,
          maxUploadsPerReport: maxUploadsPerReport ?? 5,
        },
      });
    } else {
      settings = await prisma.organizationSettings.update({
        where: { id: settings.id },
        data: {
          ...(autoConfirmRsvp !== undefined && { autoConfirmRsvp }),
          ...(timezone !== undefined && { timezone }),
          ...(maxUploadSizeMb !== undefined && { maxUploadSizeMb }),
          ...(maxUploadsPerReport !== undefined && { maxUploadsPerReport }),
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
