import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role } from '@/generated/prisma/enums';
import { getCurrentOrgId, getOrgIdForCreate, orgScope } from '@/lib/org-context';
import { canViewVolunteerList, createPermissionContext } from '@/lib/permissions';

// GET /api/volunteers - Get all volunteers (Coordinator/Admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Coordinators, dispatchers, admins, and developers can view all volunteers
    const ctx = createPermissionContext(user.role);
    if (!canViewVolunteerList(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isDeveloper = user.role === 'DEVELOPER';

    const searchParams = request.nextUrl.searchParams;
    const zone = searchParams.get('zone');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'active', 'inactive', 'pending', 'rejected'
    const qualifiedRoleId = searchParams.get('qualifiedRoleId');
    const qualification = searchParams.get('qualification'); // Filter by slug e.g., REGIONAL_LEAD
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // Get current org ID for multi-tenant filtering
    const orgId = await getCurrentOrgId();

    // Build membership filter based on status
    // In multi-tenant, accountStatus is per-org on OrganizationMember
    let membershipStatusFilter: Record<string, unknown> = {};
    if (status === 'pending') {
      membershipStatusFilter = { accountStatus: 'PENDING' };
    } else if (status === 'rejected') {
      membershipStatusFilter = { accountStatus: 'REJECTED' };
    } else {
      // Default: only show approved members
      membershipStatusFilter = { accountStatus: 'APPROVED' };
    }

    // Build where clause with org scoping via OrganizationMember
    const where: Record<string, unknown> = {
      // Multi-tenant: user must be a member of current org with matching status
      memberships: orgId ? {
        some: {
          organizationId: orgId,
          ...membershipStatusFilter,
        },
      } : { none: {} }, // No org = no results (shouldn't happen)
      // Always hide DEVELOPER accounts from volunteer lists
      role: { not: 'DEVELOPER' },
    };

    // For pending status, also require user to be verified (set password)
    if (status === 'pending') {
      where.isVerified = true;
    }

    if (zone && zone !== 'all') {
      where.zones = {
        some: {
          zoneId: zone,
        },
      };
    }

    if (role && role !== 'all') {
      // Filter by specific role (but never show developers)
      if (role === 'DEVELOPER') {
        // Can't filter to see developers - return no results
        where.role = 'NONE_MATCH';
      } else {
        where.role = role;
      }
    }

    // isActive filter - update membership filter to include isActive condition
    // Note: For multi-tenant, isActive is per-org on OrganizationMember
    if (status === 'active' && orgId) {
      where.memberships = {
        some: {
          organizationId: orgId,
          ...membershipStatusFilter,
          isActive: true,
        },
      };
    } else if (status === 'inactive' && orgId) {
      where.memberships = {
        some: {
          organizationId: orgId,
          ...membershipStatusFilter,
          isActive: false,
        },
      };
    }
    // pending and rejected statuses don't use isActive filter

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

    // Get current org ID for filtering qualifications
    const currentOrgId = await getCurrentOrgId();

    const volunteers = await prisma.user.findMany({
      where,
      include: {
        // Include the membership for current org to get per-org role
        memberships: orgId ? {
          where: {
            organizationId: orgId,
          },
          select: {
            role: true,
            accountStatus: true,
            isActive: true,
            applicationDate: true,
            rejectionReason: true,
          },
        } : false,
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
          // Only include qualifications for roles belonging to current org
          where: currentOrgId ? {
            qualifiedRole: {
              organizationId: currentOrgId,
            },
          } : {},
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

    // Get all zones for filtering (scoped to current org)
    const zones = await prisma.zone.findMany({
      where: {
        isActive: true,
        ...await orgScope(),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        county: true,
      },
    });

    // Transform the response
    const result = volunteers.map(v => {
      // Get the membership for current org (should be exactly one due to where filter)
      const membership = v.memberships && v.memberships[0];
      return {
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        signalHandle: v.signalHandle,
        // Use per-org role from membership, fallback to user role for backwards compatibility
        role: membership?.role ?? v.role,
        primaryLanguage: v.primaryLanguage,
        otherLanguages: v.otherLanguages,
        notes: v.notes,
        // Use per-org isActive from membership
        isActive: membership?.isActive ?? v.isActive,
        isVerified: v.isVerified,
        createdAt: v.createdAt,
        // Account status fields from membership (per-org)
        accountStatus: membership?.accountStatus ?? v.accountStatus,
        applicationDate: membership?.applicationDate ?? v.applicationDate,
        intakeResponses: v.intakeResponses,
        rejectionReason: membership?.rejectionReason ?? v.rejectionReason,
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
    };
    });

    // Get all qualified roles for editing (scoped to current org)
    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: {
        isActive: true,
        ...await orgScope(),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
    });

    // Get count of pending applications (verified users with PENDING membership status, scoped to org)
    const pendingCount = await prisma.user.count({
      where: {
        isVerified: true,
        role: { not: 'DEVELOPER' },
        // Multi-tenant: check pending status on OrganizationMember
        memberships: currentOrgId ? {
          some: {
            organizationId: currentOrgId,
            accountStatus: 'PENDING',
          },
        } : { none: {} },
      },
    });

    return NextResponse.json({
      volunteers: result,
      zones,
      qualifiedRoles,
      total: result.length,
      pendingCount,
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

    const orgId = await getOrgIdForCreate();
    console.log('[volunteers POST] Creating volunteer(s) for orgId:', orgId);

    // Require org context for volunteer creation
    if (!orgId) {
      return NextResponse.json(
        { error: 'No organization selected. Please select an organization first.' },
        { status: 400 }
      );
    }

    // Verify the organization still exists (could be deleted while session is stale)
    const orgExists = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!orgExists) {
      return NextResponse.json(
        { error: 'Organization not found. Please switch to a valid organization.' },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; email: string; error: string }[],
    };

    // Get all zones for mapping (scoped to current org)
    const zones = await prisma.zone.findMany({
      where: await orgScope(),
      select: { id: true, name: true },
    });
    const zoneMap = new Map(zones.map(z => [z.name.toLowerCase(), z.id]));
    console.log('[volunteers POST] Available zones:', zones.length);

    // Get all qualified roles for mapping (scoped to current org)
    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: {
        isActive: true,
        ...await orgScope(),
      },
      select: { id: true, slug: true, isDefaultForNewUsers: true },
    });
    const qualifiedRoleMap = new Map(qualifiedRoles.map(qr => [qr.slug.toUpperCase(), qr.id]));
    console.log('[volunteers POST] Available qualified roles:', qualifiedRoles.length);

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
          // Bulk imported users are pre-approved (skip pending workflow)
          accountStatus: 'APPROVED' as const,
        };

        if (existingUser) {
          // Update existing user - include organizationId to ensure they appear in org's volunteer list
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              ...userData,
              organizationId: orgId, // Sync legacy field with current org context
            },
          });

          // Multi-org: Also sync OrganizationMember record if exists
          if (orgId) {
            await prisma.organizationMember.upsert({
              where: {
                userId_organizationId: {
                  userId: existingUser.id,
                  organizationId: orgId,
                },
              },
              update: {
                role: userData.role,
                isActive: userData.isActive,
              },
              create: {
                userId: existingUser.id,
                organizationId: orgId,
                role: userData.role,
                accountStatus: 'APPROVED',
                isActive: userData.isActive,
              },
            });
          }

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

          console.log('[volunteers POST] Updated existing user:', existingUser.email, 'id:', existingUser.id);
          results.updated++;
        } else {
          // Create new user with organization
          const newUser = await prisma.user.create({
            data: {
              ...userData,
              organizationId: orgId,
            },
          });

          // Multi-org: Also create OrganizationMember record
          if (orgId) {
            await prisma.organizationMember.create({
              data: {
                userId: newUser.id,
                organizationId: orgId,
                role: userData.role,
                accountStatus: 'APPROVED', // Bulk imported users are pre-approved
                isActive: userData.isActive,
              },
            });
          }

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

          console.log('[volunteers POST] Created new user:', newUser.email, 'id:', newUser.id);
          results.created++;
        }
      } catch (err) {
        console.error('[volunteers POST] Error creating user:', err);
        results.errors.push({
          row: rowNum,
          email: vol.email,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    console.log('[volunteers POST] Final results:', results);
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
