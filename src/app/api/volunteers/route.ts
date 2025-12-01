import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/volunteers - Get all volunteers (Coordinator/Admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can view all volunteers
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const zone = searchParams.get('zone');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'active' or 'inactive'

    // Build where clause
    const where: Record<string, unknown> = {};

    if (zone && zone !== 'all') {
      where.zones = {
        some: {
          zoneId: zone,
        },
      };
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const volunteers = await prisma.user.findMany({
      where,
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
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
            shift: {
              date: { gte: new Date() },
            },
          },
          include: {
            shift: {
              select: {
                id: true,
                title: true,
                date: true,
              },
            },
          },
        },
        _count: {
          select: {
            shiftVolunteers: {
              where: {
                status: 'CONFIRMED',
              },
            },
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });

    // Get all zones for filtering
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        county: true,
      },
    });

    // Transform the response
    const result = volunteers.map(v => ({
      id: v.id,
      name: v.name,
      email: v.email,
      phone: v.phone,
      role: v.role,
      primaryLanguage: v.primaryLanguage,
      otherLanguages: v.otherLanguages,
      isActive: v.isActive,
      isVerified: v.isVerified,
      createdAt: v.createdAt,
      zones: v.zones.map(uz => ({
        id: uz.zone.id,
        name: uz.zone.name,
        county: uz.zone.county,
        isPrimary: uz.isPrimary,
      })),
      completedTrainings: v.trainingAttendances.map(ta => ({
        id: ta.session.trainingType.id,
        name: ta.session.trainingType.name,
        slug: ta.session.trainingType.slug,
        completedAt: ta.confirmedAt,
      })),
      upcomingShifts: v.shiftVolunteers.map(sv => ({
        id: sv.shift.id,
        title: sv.shift.title,
        date: sv.shift.date,
        isZoneLead: sv.isZoneLead,
      })),
      totalConfirmedShifts: v._count.shiftVolunteers,
    }));

    return NextResponse.json({
      volunteers: result,
      zones,
      total: result.length,
    });
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    return NextResponse.json({ error: 'Failed to fetch volunteers' }, { status: 500 });
  }
}
