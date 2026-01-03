import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';
import { canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/email-templates/[id] - Get single email template
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();

    const template = await prisma.emailTemplateConfig.findFirst({
      where: {
        id,
        organizationId: orgId || undefined,
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching email template:', error);
    return NextResponse.json({ error: 'Failed to fetch email template' }, { status: 500 });
  }
}

// PUT /api/admin/email-templates/[id] - Update email template
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();
    const body = await request.json();

    // Check if template exists and belongs to this org
    const existing = await prisma.emailTemplateConfig.findFirst({
      where: {
        id,
        organizationId: orgId || undefined,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      icon?: string;
      defaultSubject?: string;
      defaultContent?: string;
      isActive?: boolean;
      sortOrder?: number;
    } = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.icon !== undefined) {
      updateData.icon = body.icon;
    }

    if (body.defaultSubject !== undefined) {
      updateData.defaultSubject = body.defaultSubject;
    }

    if (body.defaultContent !== undefined) {
      updateData.defaultContent = body.defaultContent;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    const template = await prisma.emailTemplateConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error updating email template:', error);
    return NextResponse.json({ error: 'Failed to update email template' }, { status: 500 });
  }
}

// DELETE /api/admin/email-templates/[id] - Delete email template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const orgId = await getCurrentOrgId();

    // Check if template exists and belongs to this org
    const existing = await prisma.emailTemplateConfig.findFirst({
      where: {
        id,
        organizationId: orgId || undefined,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
    }

    // Prevent deletion of SYSTEM templates
    if (existing.templateType === 'SYSTEM') {
      return NextResponse.json(
        { error: 'Cannot delete system templates. You can deactivate them instead.' },
        { status: 400 }
      );
    }

    // Delete the template
    await prisma.emailTemplateConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Email template deleted',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting email template:', error);
    return NextResponse.json({ error: 'Failed to delete email template' }, { status: 500 });
  }
}
