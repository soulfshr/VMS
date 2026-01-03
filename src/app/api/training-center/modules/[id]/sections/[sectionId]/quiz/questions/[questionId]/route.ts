import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { QuestionType } from '@/generated/prisma/enums';
import { canManageTrainingCenter, createPermissionContext } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string; questionId: string }>;
}

// GET /api/training-center/modules/[id]/sections/[sectionId]/quiz/questions/[questionId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!canManageTrainingCenter(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { questionId } = await params;

    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    );
  }
}

// PUT /api/training-center/modules/[id]/sections/[sectionId]/quiz/questions/[questionId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!canManageTrainingCenter(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { questionId } = await params;
    const body = await request.json();
    const { questionText, type, points, explanation, sortOrder, options } = body;

    // Verify question exists
    const existing = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (questionText !== undefined) updateData.questionText = questionText.trim();
    if (type !== undefined && ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT'].includes(type)) {
      updateData.type = type as QuestionType;
    }
    if (typeof points === 'number') updateData.points = Math.max(1, points);
    if (explanation !== undefined) updateData.explanation = explanation?.trim() || null;
    if (typeof sortOrder === 'number') updateData.sortOrder = sortOrder;

    // Update question
    const question = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: updateData,
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // If options are provided, replace them
    if (options && Array.isArray(options)) {
      // Delete existing options
      await prisma.quizOption.deleteMany({
        where: { questionId },
      });

      // Create new options
      await prisma.quizOption.createMany({
        data: options.map((opt: { optionText: string; isCorrect: boolean }, index: number) => ({
          questionId,
          optionText: opt.optionText.trim(),
          isCorrect: opt.isCorrect ?? false,
          sortOrder: index,
        })),
      });

      // Re-fetch with updated options
      const updatedQuestion = await prisma.quizQuestion.findUnique({
        where: { id: questionId },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      return NextResponse.json({ question: updatedQuestion });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

// DELETE /api/training-center/modules/[id]/sections/[sectionId]/quiz/questions/[questionId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!canManageTrainingCenter(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { questionId } = await params;

    // Verify question exists
    const existing = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Delete question (cascade will handle options)
    await prisma.quizQuestion.delete({
      where: { id: questionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}
