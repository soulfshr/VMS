import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';
import { canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/admin/email-templates - List all email templates for current org
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow coordinators to read templates (for email blast page)
    const ctx = createPermissionContext(user.role);
    const isCoordinator = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);
    if (!isCoordinator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const templates = await prisma.emailTemplateConfig.findMany({
      where: orgFilter,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json({ error: 'Failed to fetch email templates' }, { status: 500 });
  }
}

// POST /api/admin/email-templates - Create new email template (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orgId = await getOrgIdForCreate();

    const body = await request.json();
    const {
      name,
      slug,
      description,
      icon,
      defaultSubject,
      defaultContent,
      templateType,
      sortOrder,
    } = body;

    // Validate required fields
    if (!name || !slug || !defaultSubject) {
      return NextResponse.json(
        { error: 'Name, slug, and default subject are required' },
        { status: 400 }
      );
    }

    // Check for duplicate slug within the organization
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };
    const existing = await prisma.emailTemplateConfig.findFirst({
      where: {
        slug: slug.toUpperCase(),
        ...orgFilter,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Template with this slug already exists' },
        { status: 400 }
      );
    }

    // Get max sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxSort = await prisma.emailTemplateConfig.aggregate({
        where: orgFilter,
        _max: { sortOrder: true },
      });
      finalSortOrder = (maxSort._max.sortOrder || 0) + 1;
    }

    const template = await prisma.emailTemplateConfig.create({
      data: {
        organizationId: orgId,
        name,
        slug: slug.toUpperCase(),
        description: description || null,
        icon: icon || '📧',
        defaultSubject,
        defaultContent: defaultContent || '',
        templateType: templateType || 'CUSTOM',
        sortOrder: finalSortOrder,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating email template:', error);
    return NextResponse.json({ error: 'Failed to create email template' }, { status: 500 });
  }
}

// PUT /api/admin/email-templates - Bulk update sort order
export async function PUT(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { templates } = body;

    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'Templates array is required' },
        { status: 400 }
      );
    }

    // Update sort order for each template
    await prisma.$transaction(
      templates.map((t: { id: string; sortOrder: number }) =>
        prisma.emailTemplateConfig.update({
          where: { id: t.id },
          data: { sortOrder: t.sortOrder },
        })
      )
    );

    // Return updated list
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const updatedTemplates = await prisma.emailTemplateConfig.findMany({
      where: orgFilter,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(updatedTemplates);
  } catch (error) {
    console.error('Error reordering email templates:', error);
    return NextResponse.json({ error: 'Failed to reorder email templates' }, { status: 500 });
  }
}
