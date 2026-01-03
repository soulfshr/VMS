import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { QuestionType } from '@/generated/prisma/enums';
import { canManageTrainingCenter, createPermissionContext } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

// POST /api/training-center/modules/[id]/sections/[sectionId]/quiz/questions - Add a question
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!canManageTrainingCenter(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sectionId } = await params;
    const body = await request.json();
    const { questionText, type, points, explanation, options } = body;

    // Find quiz
    const quiz = await prisma.moduleQuiz.findUnique({
      where: { sectionId },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Validate question type
    if (!type || !['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT'].includes(type)) {
      return NextResponse.json({ error: 'Invalid question type' }, { status: 400 });
    }

    if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    // Get next sort order
    const lastQuestion = await prisma.quizQuestion.findFirst({
      where: { quizId: quiz.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (lastQuestion?.sortOrder ?? -1) + 1;

    // Create question with options
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: questionText.trim(),
        type: type as QuestionType,
        points: points ?? 1,
        sortOrder: nextSortOrder,
        explanation: explanation?.trim() || null,
        options: options && Array.isArray(options) ? {
          create: options.map((opt: { optionText: string; isCorrect: boolean }, index: number) => ({
            optionText: opt.optionText.trim(),
            isCorrect: opt.isCorrect ?? false,
            sortOrder: index,
          })),
        } : undefined,
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}
