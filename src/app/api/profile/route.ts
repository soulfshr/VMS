import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUserWithZones } from '@/lib/user';

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

    // Get all available zones for preferences
    const allZones = await prisma.zone.findMany({
      where: { isActive: true },
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
      primaryLanguage,
      otherLanguages,
      emergencyContact,
      emergencyPhone,
    } = body;

    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(primaryLanguage && { primaryLanguage }),
        ...(otherLanguages && { otherLanguages }),
        ...(emergencyContact !== undefined && { emergencyContact }),
        ...(emergencyPhone !== undefined && { emergencyPhone }),
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
