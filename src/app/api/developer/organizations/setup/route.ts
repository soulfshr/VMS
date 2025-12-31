import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import type { SchedulingModel, QualifiedRoleTemplate, ShiftTypeTemplate } from '@/lib/org-templates';

interface SetupRequestBody {
  // Basic org info
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  website?: string;

  // Scheduling configuration
  schedulingModel: SchedulingModel;

  // Qualified roles to create
  qualifiedRoles: QualifiedRoleTemplate[];

  // Shift types to create (for SHIFTS model)
  shiftTypes: ShiftTypeTemplate[];
}

/**
 * POST /api/developer/organizations/setup
 * Create a new organization with full configuration in a single transaction
 * Requires DEVELOPER role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SetupRequestBody = await request.json();
    const { name, slug, email, phone, website, schedulingModel, qualifiedRoles, shiftTypes } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens only' },
        { status: 400 }
      );
    }

    // Validate scheduling model
    if (!['COVERAGE_GRID', 'SHIFTS'].includes(schedulingModel)) {
      return NextResponse.json(
        { error: 'Scheduling model must be COVERAGE_GRID or SHIFTS' },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An organization with this slug already exists' },
        { status: 400 }
      );
    }

    // Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the organization
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          email: email || null,
          phone: phone || null,
          website: website || null,
        },
      });

      // 2. Create organization settings with scheduling model
      const settings = await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
          orgName: name,
          emailFromName: name,
          emailFooter: `${name} Team`,
          primarySchedulingModel: schedulingModel,
          // Default to SIMPLE for SHIFTS orgs, SIMPLE for COVERAGE_GRID
          schedulingMode: 'SIMPLE',
        },
      });

      // 3. Create qualified roles
      const createdRoles: { id: string; slug: string }[] = [];
      for (const role of qualifiedRoles || []) {
        const createdRole = await tx.qualifiedRole.create({
          data: {
            name: role.name,
            slug: role.slug,
            description: role.description || null,
            color: role.color || '#6366f1',
            countsTowardMinimum: role.countsTowardMinimum ?? true,
            sortOrder: role.sortOrder ?? 0,
            organizationId: organization.id,
          },
        });
        createdRoles.push({ id: createdRole.id, slug: createdRole.slug });
      }

      // 4. Add the creating user as an ADMINISTRATOR member
      await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'ADMINISTRATOR',
        },
      });

      // 5. Create shift types with role requirements (for SHIFTS model)
      const createdShiftTypes: { id: string; name: string }[] = [];
      if (schedulingModel === 'SHIFTS') {
        for (const shiftType of shiftTypes || []) {
          const createdShiftType = await tx.shiftTypeConfig.create({
            data: {
              name: shiftType.name,
              slug: shiftType.slug,
              defaultMinVolunteers: shiftType.defaultMinVolunteers ?? 2,
              defaultIdealVolunteers: shiftType.defaultIdealVolunteers ?? 4,
              defaultMaxVolunteers: shiftType.defaultMaxVolunteers ?? 6,
              organizationId: organization.id,
            },
          });

          // Create role requirements for this shift type
          for (const req of shiftType.roleRequirements || []) {
            const role = createdRoles.find(r => r.slug === req.roleSlug);
            if (role) {
              await tx.shiftTypeQualifiedRoleRequirement.create({
                data: {
                  shiftTypeId: createdShiftType.id,
                  qualifiedRoleId: role.id,
                  minRequired: req.minRequired ?? 0,
                  maxAllowed: req.maxAllowed ?? null,
                },
              });
            }
          }

          createdShiftTypes.push({ id: createdShiftType.id, name: createdShiftType.name });
        }
      }

      return {
        organization,
        settings,
        qualifiedRoles: createdRoles,
        shiftTypes: createdShiftTypes,
      };
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        email: result.organization.email,
        phone: result.organization.phone,
        website: result.organization.website,
        isActive: result.organization.isActive,
        createdAt: result.organization.createdAt,
      },
      settings: {
        id: result.settings.id,
        primarySchedulingModel: result.settings.primarySchedulingModel,
        schedulingMode: result.settings.schedulingMode,
      },
      qualifiedRoles: result.qualifiedRoles,
      shiftTypes: result.shiftTypes,
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up organization:', error);
    return NextResponse.json(
      { error: 'Failed to set up organization' },
      { status: 500 }
    );
  }
}
