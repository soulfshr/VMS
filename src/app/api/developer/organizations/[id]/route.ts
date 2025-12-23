import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developer/organizations/[id]
 * Get single organization with detailed stats
 * Requires DEVELOPER role
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            zones: true,
            shifts: true,
            trainingSessions: true,
            sightings: true,
            coverageSignups: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get additional stats
    const [activeUsers, recentSignups] = await Promise.all([
      prisma.user.count({
        where: {
          organizationId: id,
          isActive: true,
        },
      }),
      prisma.coverageSignup.count({
        where: {
          zone: { organizationId: id },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        email: organization.email,
        phone: organization.phone,
        website: organization.website,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        settings: organization.settings,
        stats: {
          totalUsers: organization._count.users,
          activeUsers,
          zones: organization._count.zones,
          shifts: organization._count.shifts,
          trainingSessions: organization._count.trainingSessions,
          sightings: organization._count.sightings,
          coverageSignups: organization._count.coverageSignups,
          signupsLast7Days: recentSignups,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/developer/organizations/[id]
 * Update organization details
 * Requires DEVELOPER role
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check org exists
    const existing = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      name?: string;
      slug?: string;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.slug !== undefined) {
      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(body.slug)) {
        return NextResponse.json(
          { error: 'Slug must be lowercase alphanumeric with hyphens only' },
          { status: 400 }
        );
      }

      // Check for duplicate slug (excluding current org)
      const duplicate = await prisma.organization.findFirst({
        where: {
          slug: body.slug,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'An organization with this slug already exists' },
          { status: 400 }
        );
      }

      updateData.slug = body.slug;
    }

    if (body.email !== undefined) {
      updateData.email = body.email || null;
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone || null;
    }

    if (body.website !== undefined) {
      updateData.website = body.website || null;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            zones: true,
          },
        },
      },
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        email: organization.email,
        phone: organization.phone,
        website: organization.website,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        settings: organization.settings,
        stats: {
          users: organization._count.users,
          zones: organization._count.zones,
        },
      },
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developer/organizations/[id]
 * Deactivate an organization (soft delete)
 * Requires DEVELOPER role
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check org exists
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Soft delete - just deactivate
    await prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: `Organization "${organization.name}" has been deactivated`,
      deactivated: true,
      userCount: organization._count.users,
    });
  } catch (error) {
    console.error('Error deactivating organization:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate organization' },
      { status: 500 }
    );
  }
}
