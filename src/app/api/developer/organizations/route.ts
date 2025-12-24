import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

/**
 * GET /api/developer/organizations
 * List all organizations with stats
 * Requires DEVELOPER role (platform super admin)
 */
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      include: {
        settings: {
          select: {
            orgName: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            members: true,  // Use OrganizationMember count (new multi-org)
            users: true,    // Keep legacy count for reference
            zones: true,
            shifts: true,
            trainingSessions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        email: org.email,
        phone: org.phone,
        website: org.website,
        isActive: org.isActive,
        createdAt: org.createdAt,
        settings: org.settings,
        stats: {
          members: org._count.members,  // Preferred: OrganizationMember count
          users: org._count.users,      // Legacy: User.organizationId count
          zones: org._count.zones,
          shifts: org._count.shifts,
          trainingSessions: org._count.trainingSessions,
        },
      })),
      total: organizations.length,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/developer/organizations
 * Create a new organization
 * Requires DEVELOPER role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, email, phone, website } = body;

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

    // Create organization with default settings
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        email: email || null,
        phone: phone || null,
        website: website || null,
        settings: {
          create: {
            orgName: name,
            emailFromName: name,
            emailFooter: `${name} Team`,
          },
        },
      },
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
        settings: organization.settings,
        stats: {
          users: organization._count.users,
          zones: organization._count.zones,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
