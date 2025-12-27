import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';
import { generateUnsubscribeToken } from '@/lib/email';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const user = await getDbUserWithZones();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's availability
    const availability = await prisma.availability.findMany({
      where: { userId: user.id },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });

    // Get user's training status
    const trainings = await prisma.userTraining.findMany({
      where: { userId: user.id },
      include: {
        training: true,
      },
    });

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId ? { organizationId: orgId } : { organizationId: null };

    // Get all available zones for preferences (scoped to org)
    const allZones = await prisma.zone.findMany({
      where: {
        isActive: true,
        ...orgFilter,
      },
      orderBy: [{ county: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      user,
      availability,
      trainings,
      allZones,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT /api/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const dbUser = await getDbUserWithZones();
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      phone,
      signalHandle,
      primaryLanguage,
      otherLanguages,
      emergencyContact,
      emergencyPhone,
      emailNotifications,
      shiftReminder24h,
      shiftReminder1h,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (signalHandle !== undefined) updateData.signalHandle = signalHandle;
    if (primaryLanguage) updateData.primaryLanguage = primaryLanguage;
    if (otherLanguages) updateData.otherLanguages = otherLanguages;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (emergencyPhone !== undefined) updateData.emergencyPhone = emergencyPhone;
    if (typeof emailNotifications === 'boolean') {
      updateData.emailNotifications = emailNotifications;
      // Generate unsubscribe token if user is enabling notifications and doesn't have one
      if (emailNotifications && !dbUser.unsubscribeToken) {
        updateData.unsubscribeToken = generateUnsubscribeToken();
      }
    }
    if (typeof shiftReminder24h === 'boolean') {
      updateData.shiftReminder24h = shiftReminder24h;
    }
    if (typeof shiftReminder1h === 'boolean') {
      updateData.shiftReminder1h = shiftReminder1h;
    }

    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: updateData,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
