import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/developer/default-intake-questions/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const template = await prisma.defaultIntakeQuestionTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching default intake question template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PUT /api/developer/default-intake-questions/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { question, type, options, required } = body;

    // Validate
    if (type && !['text', 'textarea', 'select'].includes(type)) {
      return NextResponse.json({ error: 'Invalid question type' }, { status: 400 });
    }

    if (type === 'select' && (!options || options.length === 0)) {
      return NextResponse.json({ error: 'Select type requires options' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (question !== undefined) updateData.question = question.trim();
    if (type !== undefined) updateData.type = type;
    if (options !== undefined) updateData.options = options;
    if (required !== undefined) updateData.required = required;

    const template = await prisma.defaultIntakeQuestionTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error updating default intake question template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/developer/default-intake-questions/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.defaultIntakeQuestionTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting default intake question template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
