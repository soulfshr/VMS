import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/intake-questions/[id] - Get single intake question
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const question = await prisma.intakeQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      return NextResponse.json({ error: 'Intake question not found' }, { status: 404 });
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error fetching intake question:', error);
    return NextResponse.json({ error: 'Failed to fetch intake question' }, { status: 500 });
  }
}

// PUT /api/admin/intake-questions/[id] - Update intake question
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if question exists
    const existing = await prisma.intakeQuestion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Intake question not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      question?: string;
      type?: string;
      options?: string[];
      required?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    } = {};

    if (body.question !== undefined) {
      updateData.question = body.question;
    }

    if (body.type !== undefined) {
      const validTypes = ['text', 'textarea', 'select'];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: 'Invalid question type. Must be: text, textarea, or select' },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }

    if (body.options !== undefined) {
      if (!Array.isArray(body.options)) {
        return NextResponse.json(
          { error: 'Options must be an array' },
          { status: 400 }
        );
      }
      updateData.options = body.options;
    }

    // Validate options for select type
    const finalType = updateData.type || existing.type;
    const finalOptions = updateData.options || existing.options;
    if (finalType === 'select' && (!finalOptions || finalOptions.length === 0)) {
      return NextResponse.json(
        { error: 'Select type questions require at least one option' },
        { status: 400 }
      );
    }

    if (body.required !== undefined) {
      updateData.required = body.required;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    const question = await prisma.intakeQuestion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error updating intake question:', error);
    return NextResponse.json({ error: 'Failed to update intake question' }, { status: 500 });
  }
}

// DELETE /api/admin/intake-questions/[id] - Delete intake question
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if question exists
    const existing = await prisma.intakeQuestion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Intake question not found' }, { status: 404 });
    }

    // Delete the question
    await prisma.intakeQuestion.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Intake question deleted',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting intake question:', error);
    return NextResponse.json({ error: 'Failed to delete intake question' }, { status: 500 });
  }
}
