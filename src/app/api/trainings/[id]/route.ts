import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/trainings/[id] - Get training session details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const session = await prisma.trainingSession.findFirst({
      where: {
        id,
        ...orgFilter,
      },
      include: {
        trainingType: {
          include: {
            grantsQualifiedRole: true,
          },
        },
        zone: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    // Add computed fields
    const isCoordinator = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);
    const sessionWithCounts = {
      ...session,
      confirmedCount: session.attendees.filter(a => a.status === 'CONFIRMED').length,
      pendingCount: session.attendees.filter(a => a.status === 'PENDING').length,
      spotsLeft: session.maxAttendees - session.attendees.filter(a => a.status === 'CONFIRMED').length,
      userRsvp: session.attendees.find(a => a.userId === user.id) || null,
      isCoordinator,
    };

    return NextResponse.json(sessionWithCounts);
  } catch (error) {
    console.error('Error fetching training session:', error);
    return NextResponse.json({ error: 'Failed to fetch training session' }, { status: 500 });
  }
}

// PUT /api/trainings/[id] - Update training session (Coordinator/Admin)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const body = await request.json();

    // Check if session exists and belongs to current org
    const existing = await prisma.trainingSession.findFirst({
      where: {
        id,
        ...orgFilter,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    const {
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      meetingLink,
      zoneId,
      minAttendees,
      maxAttendees,
      status,
    } = body;

    const session = await prisma.trainingSession.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        ...(location !== undefined && { location }),
        ...(meetingLink !== undefined && { meetingLink }),
        ...(zoneId !== undefined && { zoneId: zoneId || null }),
        ...(minAttendees !== undefined && { minAttendees }),
        ...(maxAttendees !== undefined && { maxAttendees }),
        ...(status !== undefined && { status }),
      },
      include: {
        trainingType: true,
        zone: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error updating training session:', error);
    return NextResponse.json({ error: 'Failed to update training session' }, { status: 500 });
  }
}

// DELETE /api/trainings/[id] - Cancel training session (Coordinator/Admin)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    // Check if session exists and belongs to current org
    const existing = await prisma.trainingSession.findFirst({
      where: {
        id,
        ...orgFilter,
      },
      include: {
        attendees: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    // If no attendees, hard delete; otherwise mark as cancelled
    if (existing.attendees.length === 0) {
      await prisma.trainingSession.delete({
        where: { id },
      });
      return NextResponse.json({ message: 'Training session deleted' });
    } else {
      await prisma.trainingSession.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return NextResponse.json({ message: 'Training session cancelled' });
    }
  } catch (error) {
    console.error('Error deleting training session:', error);
    return NextResponse.json({ error: 'Failed to delete training session' }, { status: 500 });
  }
}
