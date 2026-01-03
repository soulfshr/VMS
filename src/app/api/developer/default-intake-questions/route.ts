import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/developer/default-intake-questions - List all default intake question templates
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const templates = await prisma.defaultIntakeQuestionTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching default intake question templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/developer/default-intake-questions - Create a new template
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { question, type, options, required } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    if (!['text', 'textarea', 'select'].includes(type)) {
      return NextResponse.json({ error: 'Invalid question type' }, { status: 400 });
    }

    if (type === 'select' && (!options || options.length === 0)) {
      return NextResponse.json({ error: 'Select type requires options' }, { status: 400 });
    }

    // Get next sort order
    const maxOrder = await prisma.defaultIntakeQuestionTemplate.aggregate({
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder || 0) + 1;

    const template = await prisma.defaultIntakeQuestionTemplate.create({
      data: {
        question: question.trim(),
        type,
        options: type === 'select' ? options : [],
        required: required ?? false,
        sortOrder: nextOrder,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating default intake question template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

// PUT /api/developer/default-intake-questions - Bulk reorder templates
export async function PUT(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { updates } = body; // Array of { id, sortOrder }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
    }

    // Update all sort orders in a transaction
    await prisma.$transaction(
      updates.map((update: { id: string; sortOrder: number }) =>
        prisma.defaultIntakeQuestionTemplate.update({
          where: { id: update.id },
          data: { sortOrder: update.sortOrder },
        })
      )
    );

    const templates = await prisma.defaultIntakeQuestionTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error reordering default intake question templates:', error);
    return NextResponse.json({ error: 'Failed to reorder templates' }, { status: 500 });
  }
}
