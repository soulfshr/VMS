import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Qualification } from '@/generated/prisma/enums';

// GET /api/users/qualified - Get users qualified for a specific role
// Based on qualifications array OR completed training sessions
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role'); // 'DISPATCHER' or 'ZONE_LEAD'
    const county = searchParams.get('county'); // Optional: filter by county for dispatchers

    if (!role) {
      return NextResponse.json({ error: 'role parameter is required' }, { status: 400 });
    }

    // Map role to qualification and training type slug
    const qualification = role as Qualification; // DISPATCHER or ZONE_LEAD
    const trainingTypeSlug = role === 'DISPATCHER' ? 'DISPATCHER' : 'ZONE_LEAD';

    // Find users who have the qualification (either in qualifications array OR via training)
    const qualifiedUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          // Method 1: Has qualification in qualifications array (manually assigned or earned)
          {
            qualifications: {
              has: qualification,
            },
          },
          // Method 2: Has completed the required training (legacy support)
          {
            trainingAttendances: {
              some: {
                status: 'CONFIRMED',
                session: {
                  trainingType: {
                    slug: trainingTypeSlug,
                  },
                },
              },
            },
          },
        ],
        // Optionally filter by county (users who have zones in this county)
        ...(county
          ? {
              zones: {
                some: {
                  zone: {
                    county,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        qualifications: true,
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
            session: {
              trainingType: {
                slug: trainingTypeSlug,
              },
            },
          },
          include: {
            session: {
              include: {
                trainingType: true,
              },
            },
          },
          orderBy: {
            confirmedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the response
    const result = qualifiedUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      qualifications: u.qualifications,
      zones: u.zones.map(uz => ({
        id: uz.zone.id,
        name: uz.zone.name,
        county: uz.zone.county,
        isPrimary: uz.isPrimary,
      })),
      qualifiedSince: u.trainingAttendances[0]?.confirmedAt || null,
      trainingSession: u.trainingAttendances[0]?.session
        ? {
            id: u.trainingAttendances[0].session.id,
            title: u.trainingAttendances[0].session.title,
            date: u.trainingAttendances[0].session.date,
          }
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching qualified users:', error);
    return NextResponse.json({ error: 'Failed to fetch qualified users' }, { status: 500 });
  }
}
