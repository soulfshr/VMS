import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

// GET /api/training-center/modules/[id]/sections/[sectionId]/quiz
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId } = await params;

    const quiz = await prisma.moduleQuiz.findUnique({
      where: { sectionId },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // For non-developers, hide correct answers
    if (user.role !== 'DEVELOPER') {
      const sanitizedQuiz = {
        ...quiz,
        questions: quiz.questions.map(q => ({
          ...q,
          options: q.options.map(o => ({
            id: o.id,
            optionText: o.optionText,
            sortOrder: o.sortOrder,
            // Don't include isCorrect for learners
          })),
        })),
      };
      return NextResponse.json({ quiz: sanitizedQuiz });
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}

// PUT /api/training-center/modules/[id]/sections/[sectionId]/quiz - Update quiz settings
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sectionId } = await params;
    const body = await request.json();
    const { passingScore, maxAttempts, shuffleQuestions } = body;

    // Find quiz
    const quiz = await prisma.moduleQuiz.findUnique({
      where: { sectionId },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (typeof passingScore === 'number') {
      updateData.passingScore = Math.min(100, Math.max(0, passingScore));
    }
    if (maxAttempts !== undefined) {
      updateData.maxAttempts = maxAttempts === null ? null : Math.max(1, maxAttempts);
    }
    if (typeof shuffleQuestions === 'boolean') {
      updateData.shuffleQuestions = shuffleQuestions;
    }

    const updatedQuiz = await prisma.moduleQuiz.update({
      where: { id: quiz.id },
      data: updateData,
      include: {
        questions: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ quiz: updatedQuiz });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to update quiz' },
      { status: 500 }
    );
  }
}
