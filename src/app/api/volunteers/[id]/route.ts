import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role } from '@/generated/prisma/enums';

// PATCH /api/volunteers/[id] - Update a volunteer (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can update volunteer roles
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Find the volunteer
    const volunteer = await prisma.user.findUnique({
      where: { id },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    // Prevent admin from demoting themselves
    if (id === user.id && body.role && body.role !== 'ADMINISTRATOR') {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      role?: Role;
      isActive?: boolean;
      isVerified?: boolean;
      name?: string;
      phone?: string | null;
      primaryLanguage?: string;
      otherLanguages?: string[];
    } = {};

    if (body.role !== undefined) {
      const validRoles = ['VOLUNTEER', 'COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData.role = body.role as Role;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.isVerified !== undefined) {
      updateData.isVerified = body.isVerified;
    }

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone || null;
    }

    if (body.primaryLanguage !== undefined) {
      updateData.primaryLanguage = body.primaryLanguage;
    }

    if (body.otherLanguages !== undefined) {
      updateData.otherLanguages = body.otherLanguages;
    }

    // Update the volunteer
    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        primaryLanguage: true,
        otherLanguages: true,
        isActive: true,
        isVerified: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating volunteer:', error);
    return NextResponse.json({ error: 'Failed to update volunteer' }, { status: 500 });
  }
}

// GET /api/volunteers/[id] - Get a single volunteer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can view volunteer details
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const volunteer = await prisma.user.findUnique({
      where: { id },
      include: {
        zones: {
          include: {
            zone: {
              select: {
                id: true,
                name: true,
                county: true,
              },
            },
          },
        },
        trainingAttendances: {
          where: {
            status: 'CONFIRMED',
          },
          include: {
            session: {
              include: {
                trainingType: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        shiftVolunteers: {
          include: {
            shift: {
              select: {
                id: true,
                title: true,
                date: true,
                type: true,
                zone: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            shift: {
              date: 'desc',
            },
          },
        },
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: volunteer.id,
      name: volunteer.name,
      email: volunteer.email,
      phone: volunteer.phone,
      role: volunteer.role,
      primaryLanguage: volunteer.primaryLanguage,
      otherLanguages: volunteer.otherLanguages,
      isActive: volunteer.isActive,
      isVerified: volunteer.isVerified,
      createdAt: volunteer.createdAt,
      zones: volunteer.zones.map(uz => ({
        id: uz.zone.id,
        name: uz.zone.name,
        county: uz.zone.county,
        isPrimary: uz.isPrimary,
      })),
      completedTrainings: volunteer.trainingAttendances.map(ta => ({
        id: ta.session.trainingType.id,
        name: ta.session.trainingType.name,
        slug: ta.session.trainingType.slug,
        completedAt: ta.confirmedAt,
      })),
      shifts: volunteer.shiftVolunteers.map(sv => ({
        id: sv.shift.id,
        title: sv.shift.title,
        date: sv.shift.date,
        type: sv.shift.type,
        zone: sv.shift.zone.name,
        status: sv.status,
        isZoneLead: sv.isZoneLead,
      })),
    });
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    return NextResponse.json({ error: 'Failed to fetch volunteer' }, { status: 500 });
  }
}
