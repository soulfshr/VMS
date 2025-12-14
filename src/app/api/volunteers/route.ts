import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role } from '@/generated/prisma/enums';

// GET /api/volunteers - Get all volunteers (Coordinator/Admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Coordinators, dispatchers, admins, and developers can view all volunteers
    if (!['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isDeveloper = user.role === 'DEVELOPER';

    const searchParams = request.nextUrl.searchParams;
    const zone = searchParams.get('zone');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'active' or 'inactive'
    const qualifiedRoleId = searchParams.get('qualifiedRoleId');
    const qualification = searchParams.get('qualification'); // Filter by slug e.g., REGIONAL_LEAD
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Hide DEVELOPER users from non-developers
    if (!isDeveloper) {
      where.role = { not: 'DEVELOPER' };
    }

    if (zone && zone !== 'all') {
      where.zones = {
        some: {
          zoneId: zone,
        },
      };
    }

    if (role && role !== 'all') {
      // If a specific role filter is selected, use it (but still respect developer exclusion)
      if (!isDeveloper && role === 'DEVELOPER') {
        // Non-developers can't filter to see developers - return empty
        where.role = 'NONE_MATCH';
      } else {
        where.role = role;
      }
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // Filter by qualified role ID
    if (qualifiedRoleId && qualifiedRoleId !== 'all') {
      where.userQualifications = {
        some: {
          qualifiedRoleId: qualifiedRoleId,
        },
      };
    }

    // Filter by qualification slug (e.g., REGIONAL_LEAD)
    if (qualification) {
      where.userQualifications = {
        some: {
          qualifiedRole: {
            slug: qualification.toUpperCase(),
          },
        },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { signalHandle: { contains: search, mode: 'insensitive' } },
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
        userQualifications: {
          include: {
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
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
      ...(limit && { take: limit }),
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
      signalHandle: v.signalHandle,
      role: v.role,
      primaryLanguage: v.primaryLanguage,
      otherLanguages: v.otherLanguages,
      isActive: v.isActive,
      isVerified: v.isVerified,
      createdAt: v.createdAt,
      // Only include lastLoginAt for developers
      ...(isDeveloper && { lastLoginAt: v.lastLoginAt }),
      qualifiedRoles: v.userQualifications.map(uq => ({
        id: uq.qualifiedRole.id,
        name: uq.qualifiedRole.name,
        slug: uq.qualifiedRole.slug,
        color: uq.qualifiedRole.color,
      })),
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

    // Get all qualified roles for editing
    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
    });

    return NextResponse.json({
      volunteers: result,
      zones,
      qualifiedRoles,
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
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
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

    // Get all qualified roles for mapping
    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, isDefaultForNewUsers: true },
    });
    const qualifiedRoleMap = new Map(qualifiedRoles.map(qr => [qr.slug.toUpperCase(), qr.id]));

    // Get default qualified roles for new users
    const defaultQualifiedRoleIds = qualifiedRoles
      .filter(qr => qr.isDefaultForNewUsers)
      .map(qr => qr.id);

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

      // Parse and validate qualified roles if provided
      let qualifiedRoleIds: string[] = [];
      if (vol.qualifications) {
        // Support both semicolons and colons as separators
        const quals = Array.isArray(vol.qualifications)
          ? vol.qualifications
          : vol.qualifications.split(/[;:]/).map((q: string) => q.trim().toUpperCase()).filter(Boolean);

        // Fix common typos
        const fixedQuals = quals.map((q: string) => {
          if (q === 'DIPSATCHER') return 'DISPATCHER';
          return q;
        });

        const invalidQuals = fixedQuals.filter((q: string) => !qualifiedRoleMap.has(q));
        if (invalidQuals.length > 0) {
          results.errors.push({ row: rowNum, email: vol.email, error: `Invalid qualified roles: ${invalidQuals.join(', ')}. Valid options: ${Array.from(qualifiedRoleMap.keys()).join(', ')}` });
          continue;
        }
        qualifiedRoleIds = fixedQuals.map((q: string) => qualifiedRoleMap.get(q)!);
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
          signalHandle: vol.signalHandle || null,
          role: (vol.role?.toUpperCase() || 'VOLUNTEER') as Role,
          primaryLanguage: vol.primaryLanguage || 'English',
          otherLanguages: vol.otherLanguages || [],
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

          // Update qualified roles if provided
          if (qualifiedRoleIds.length > 0) {
            // Remove existing qualified role assignments
            await prisma.userQualification.deleteMany({
              where: { userId: existingUser.id },
            });

            // Add new qualified role assignments
            for (const qualifiedRoleId of qualifiedRoleIds) {
              await prisma.userQualification.create({
                data: {
                  userId: existingUser.id,
                  qualifiedRoleId,
                },
              });
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

          // Add qualified role assignments
          // If specific qualifications were provided in import, use those
          // Otherwise, assign default qualified roles to new users
          const rolesToAssign = qualifiedRoleIds.length > 0 ? qualifiedRoleIds : defaultQualifiedRoleIds;
          for (const qualifiedRoleId of rolesToAssign) {
            await prisma.userQualification.create({
              data: {
                userId: newUser.id,
                qualifiedRoleId,
              },
            });
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
