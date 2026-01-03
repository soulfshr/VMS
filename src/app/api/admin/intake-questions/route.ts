import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { canAccessAdminSettings, createPermissionContext } from '@/lib/permissions';

// GET /api/admin/intake-questions - List all intake questions (admin view)
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const questions = await prisma.intakeQuestion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching intake questions:', error);
    return NextResponse.json({ error: 'Failed to fetch intake questions' }, { status: 500 });
  }
}

// POST /api/admin/intake-questions - Create new intake question
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { question, type, options, required } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Question text is required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['text', 'textarea', 'select'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid question type. Must be: text, textarea, or select' },
        { status: 400 }
      );
    }

    // Validate options for select type
    if (type === 'select' && (!options || !Array.isArray(options) || options.length === 0)) {
      return NextResponse.json(
        { error: 'Select type questions require at least one option' },
        { status: 400 }
      );
    }

    // Get max sort order
    const maxSort = await prisma.intakeQuestion.aggregate({
      _max: { sortOrder: true },
    });

    const intakeQuestion = await prisma.intakeQuestion.create({
      data: {
        question,
        type: type || 'text',
        options: type === 'select' ? options : [],
        required: required || false,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });

    return NextResponse.json(intakeQuestion, { status: 201 });
  } catch (error) {
    console.error('Error creating intake question:', error);
    return NextResponse.json({ error: 'Failed to create intake question' }, { status: 500 });
  }
}

// PUT /api/admin/intake-questions - Bulk update sort order
export async function PUT(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = createPermissionContext(user.role);
    if (!canAccessAdminSettings(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { questions } = body;

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Questions array is required' },
        { status: 400 }
      );
    }

    // Update sort order for each question
    await prisma.$transaction(
      questions.map((q: { id: string; sortOrder: number }) =>
        prisma.intakeQuestion.update({
          where: { id: q.id },
          data: { sortOrder: q.sortOrder },
        })
      )
    );

    // Return updated list
    const updatedQuestions = await prisma.intakeQuestion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(updatedQuestions);
  } catch (error) {
    console.error('Error reordering intake questions:', error);
    return NextResponse.json({ error: 'Failed to reorder intake questions' }, { status: 500 });
  }
}
