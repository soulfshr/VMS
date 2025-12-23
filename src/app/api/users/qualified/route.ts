import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Qualification } from '@/generated/prisma/enums';
import { getCurrentOrgId } from '@/lib/org-context';

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

    const orgId = await getCurrentOrgId();

    // Find users who have the qualification (via userQualifications OR old qualifications array OR training)
    const qualifiedUsers = await prisma.user.findMany({
      where: {
        AND: [
          { isActive: true },
          // Org scoping
          orgId
            ? { OR: [{ organizationId: orgId }, { organizationId: null }] }
            : { organizationId: null },
          // Qualification criteria
          { OR: [
          // Method 1: Has qualification via NEW userQualifications table (preferred)
          {
            userQualifications: {
              some: {
                qualifiedRole: {
                  slug: role,
                  isActive: true,
                },
              },
            },
          },
          // Method 2: Has qualification in OLD qualifications array (legacy/deprecated)
          {
            qualifications: {
              has: qualification,
            },
          },
          // Method 3: Has completed the required training (legacy support)
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
        ] },
        ],
        // Zone preferences no longer restrict assignment eligibility
        // Any qualified zone lead can be assigned to any zone from the schedule page
        // Zone preferences are only used for dashboard recommendations and email notifications
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
