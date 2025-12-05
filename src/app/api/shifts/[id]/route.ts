import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { ShiftType, ShiftStatus } from '@/generated/prisma/enums';

// GET /api/shifts/[id] - Get single shift with volunteers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        zone: true,
        volunteers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                primaryLanguage: true,
              },
            },
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                color: true,
                countsTowardMinimum: true,
              },
            },
          },
          orderBy: [
            { isZoneLead: 'desc' }, // Zone leads first
            { createdAt: 'asc' },
          ],
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Add computed fields
    // Only count volunteers whose qualified role counts toward minimum (or have no role assigned)
    const countingVolunteers = shift.volunteers.filter(v =>
      v.status === 'CONFIRMED' && (v.qualifiedRole?.countsTowardMinimum !== false)
    );
    const confirmedCount = countingVolunteers.length;

    // Total confirmed (including non-counting roles like Shadowers)
    const totalConfirmed = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
    const pendingCount = shift.volunteers.filter(v => v.status === 'PENDING').length;
    const userRsvp = shift.volunteers.find(v => v.userId === user.id);

    return NextResponse.json({
      ...shift,
      confirmedCount,        // Volunteers that count toward minimum
      totalConfirmed,        // All confirmed volunteers (including shadows)
      pendingCount,
      spotsLeft: shift.maxVolunteers - confirmedCount,
      userRsvpStatus: userRsvp?.status || null,
      userRsvpId: userRsvp?.id || null,
      isCoordinator: ['COORDINATOR', 'ADMINISTRATOR'].includes(user.role),
    });
  } catch (error) {
    console.error('Error fetching shift:', error);
    return NextResponse.json({ error: 'Failed to fetch shift' }, { status: 500 });
  }
}

// PUT /api/shifts/[id] - Update shift (Coordinator/Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can update shifts
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if shift exists
    const existing = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Don't allow editing cancelled shifts
    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot edit cancelled shifts' }, { status: 400 });
    }

    // Build update data
    const updateData: {
      type?: ShiftType;
      title?: string;
      description?: string | null;
      date?: Date;
      startTime?: Date;
      endTime?: Date;
      zoneId?: string;
      meetingLocation?: string | null;
      minVolunteers?: number;
      idealVolunteers?: number;
      maxVolunteers?: number;
      status?: ShiftStatus;
    } = {};

    if (body.type !== undefined) {
      updateData.type = body.type as ShiftType;
    }

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (body.date !== undefined) {
      updateData.date = new Date(body.date);
    }

    if (body.startTime !== undefined) {
      updateData.startTime = new Date(body.startTime);
    }

    if (body.endTime !== undefined) {
      updateData.endTime = new Date(body.endTime);
    }

    if (body.zoneId !== undefined) {
      // Verify zone exists
      const zone = await prisma.zone.findUnique({ where: { id: body.zoneId } });
      if (!zone) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 400 });
      }
      updateData.zoneId = body.zoneId;
    }

    if (body.meetingLocation !== undefined) {
      updateData.meetingLocation = body.meetingLocation || null;
    }

    if (body.minVolunteers !== undefined) {
      updateData.minVolunteers = body.minVolunteers;
    }

    if (body.idealVolunteers !== undefined) {
      updateData.idealVolunteers = body.idealVolunteers;
    }

    if (body.maxVolunteers !== undefined) {
      updateData.maxVolunteers = body.maxVolunteers;
    }

    if (body.status !== undefined && body.status !== 'CANCELLED') {
      // Don't allow setting to CANCELLED via PUT (use cancel endpoint)
      updateData.status = body.status as ShiftStatus;
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        zone: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 });
  }
}
