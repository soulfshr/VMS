import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role, Qualification } from '@/generated/prisma/enums';

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
      qualifications: v.qualifications || [],  // New qualifications field
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

// POST /api/volunteers - Bulk import volunteers (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can bulk import
    if (user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { volunteers } = body;

    if (!Array.isArray(volunteers) || volunteers.length === 0) {
      return NextResponse.json(
        { error: 'volunteers array is required' },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; email: string; error: string }[],
    };

    // Get all zones for mapping
    const zones = await prisma.zone.findMany({
      select: { id: true, name: true },
    });
    const zoneMap = new Map(zones.map(z => [z.name.toLowerCase(), z.id]));

    for (let i = 0; i < volunteers.length; i++) {
      const vol = volunteers[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!vol.email) {
        results.errors.push({ row: rowNum, email: vol.email || 'N/A', error: 'Email is required' });
        continue;
      }

      if (!vol.name) {
        results.errors.push({ row: rowNum, email: vol.email, error: 'Name is required' });
        continue;
      }

      // Validate role if provided
      const validRoles = ['VOLUNTEER', 'COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'];
      if (vol.role && !validRoles.includes(vol.role.toUpperCase())) {
        results.errors.push({ row: rowNum, email: vol.email, error: `Invalid role: ${vol.role}` });
        continue;
      }

      // Validate qualifications if provided
      const validQualifications = ['VERIFIER', 'ZONE_LEAD', 'DISPATCHER'];
      let parsedQualifications: Qualification[] = [];
      if (vol.qualifications) {
        const quals = Array.isArray(vol.qualifications)
          ? vol.qualifications
          : vol.qualifications.split(';').map((q: string) => q.trim().toUpperCase()).filter(Boolean);
        const invalidQuals = quals.filter((q: string) => !validQualifications.includes(q));
        if (invalidQuals.length > 0) {
          results.errors.push({ row: rowNum, email: vol.email, error: `Invalid qualifications: ${invalidQuals.join(', ')}` });
          continue;
        }
        parsedQualifications = quals as Qualification[];
      }

      try {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: vol.email.toLowerCase() },
        });

        const userData = {
          name: vol.name,
          email: vol.email.toLowerCase(),
          phone: vol.phone || null,
          role: (vol.role?.toUpperCase() || 'VOLUNTEER') as Role,
          primaryLanguage: vol.primaryLanguage || 'English',
          otherLanguages: vol.otherLanguages || [],
          qualifications: parsedQualifications,  // New qualifications field
          isActive: vol.isActive !== false,
          isVerified: vol.isVerified !== false,
        };

        if (existingUser) {
          // Update existing user
          await prisma.user.update({
            where: { id: existingUser.id },
            data: userData,
          });

          // Update zones if provided
          if (vol.zones && Array.isArray(vol.zones)) {
            // Remove existing zone assignments
            await prisma.userZone.deleteMany({
              where: { userId: existingUser.id },
            });

            // Add new zone assignments
            for (const zoneName of vol.zones) {
              const zoneId = zoneMap.get(zoneName.toLowerCase());
              if (zoneId) {
                await prisma.userZone.create({
                  data: {
                    userId: existingUser.id,
                    zoneId,
                    isPrimary: vol.zones.indexOf(zoneName) === 0,
                  },
                });
              }
            }
          }

          results.updated++;
        } else {
          // Create new user
          const newUser = await prisma.user.create({
            data: userData,
          });

          // Add zone assignments if provided
          if (vol.zones && Array.isArray(vol.zones)) {
            for (const zoneName of vol.zones) {
              const zoneId = zoneMap.get(zoneName.toLowerCase());
              if (zoneId) {
                await prisma.userZone.create({
                  data: {
                    userId: newUser.id,
                    zoneId,
                    isPrimary: vol.zones.indexOf(zoneName) === 0,
                  },
                });
              }
            }
          }

          results.created++;
        }
      } catch (err) {
        results.errors.push({
          row: rowNum,
          email: vol.email,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: volunteers.length,
    });
  } catch (error) {
    console.error('Error bulk importing volunteers:', error);
    return NextResponse.json({ error: 'Failed to import volunteers' }, { status: 500 });
  }
}
