import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

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
          },
          orderBy: {
            createdAt: 'asc',
          },
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
    const confirmedCount = shift.volunteers.filter(v => v.status === 'CONFIRMED').length;
    const pendingCount = shift.volunteers.filter(v => v.status === 'PENDING').length;
    const userRsvp = shift.volunteers.find(v => v.userId === user.id);

    return NextResponse.json({
      ...shift,
      confirmedCount,
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
