import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

// POST /api/training-center/quiz/[quizId]/attempt - Submit a quiz attempt
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId } = await params;
    const body = await request.json();
    const { answers, startedAt } = body;

    // answers should be array of { questionId, selectedOptionIds: string[] }

    // Fetch quiz with questions and correct answers
    const quiz = await prisma.moduleQuiz.findUnique({
      where: { id: quizId },
      include: {
        section: {
          include: {
            module: true,
          },
        },
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Check if module is published (or user is developer)
    if (!quiz.section.module.isPublished && user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Module not available' }, { status: 403 });
    }

    // Check max attempts
    if (quiz.maxAttempts) {
      const attemptCount = await prisma.quizAttempt.count({
        where: {
          quizId,
          userId: user.id,
        },
      });

      if (attemptCount >= quiz.maxAttempts) {
        return NextResponse.json(
          { error: 'Maximum attempts reached' },
          { status: 403 }
        );
      }
    }

    // Score the quiz
    let totalPoints = 0;
    let earnedPoints = 0;
    // Internal grading data (includes correct answers for storage)
    const gradedAnswersInternal: Array<{
      questionId: string;
      selectedOptionIds: string[];
      correctOptionIds: string[];
      isCorrect: boolean;
      points: number;
      earnedPoints: number;
    }> = [];
    // Safe response data (excludes correct answers to prevent cheating)
    const gradedAnswersResponse: Array<{
      questionId: string;
      selectedOptionIds: string[];
      isCorrect: boolean;
      points: number;
      earnedPoints: number;
    }> = [];

    for (const question of quiz.questions) {
      totalPoints += question.points;

      const answer = answers?.find((a: { questionId: string }) => a.questionId === question.id);
      const selectedOptionIds: string[] = answer?.selectedOptionIds || [];
      const correctOptionIds = question.options
        .filter(opt => opt.isCorrect)
        .map(opt => opt.id);

      // Check if answer is correct
      let isCorrect = false;
      if (question.type === 'TRUE_FALSE' || question.type === 'MULTIPLE_CHOICE') {
        // Single answer: exactly one correct and it matches
        isCorrect = selectedOptionIds.length === 1 &&
                    correctOptionIds.length === 1 &&
                    selectedOptionIds[0] === correctOptionIds[0];
      } else if (question.type === 'MULTI_SELECT') {
        // All correct options selected, no incorrect ones
        const selectedSet = new Set(selectedOptionIds);
        const correctSet = new Set(correctOptionIds);
        isCorrect = selectedSet.size === correctSet.size &&
                    [...selectedSet].every(id => correctSet.has(id));
      }

      if (isCorrect) {
        earnedPoints += question.points;
      }

      // Store full data internally (for database storage)
      gradedAnswersInternal.push({
        questionId: question.id,
        selectedOptionIds,
        correctOptionIds,
        isCorrect,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0,
      });

      // Store safe data for response (no answer key)
      gradedAnswersResponse.push({
        questionId: question.id,
        selectedOptionIds,
        isCorrect,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0,
      });
    }

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = percentage >= quiz.passingScore;

    // Save the attempt (store full grading data including correct answers)
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId: user.id,
        score: earnedPoints,
        maxScore: totalPoints,
        percentage,
        passed,
        answers: gradedAnswersInternal,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        completedAt: new Date(),
      },
    });

    // If passed, update section progress
    if (passed) {
      // Find or create enrollment
      let enrollment = await prisma.moduleEnrollment.findUnique({
        where: {
          userId_moduleId: {
            userId: user.id,
            moduleId: quiz.section.moduleId,
          },
        },
      });

      if (!enrollment) {
        enrollment = await prisma.moduleEnrollment.create({
          data: {
            userId: user.id,
            moduleId: quiz.section.moduleId,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            lastAccessedAt: new Date(),
          },
        });
      }

      // Mark section as completed
      await prisma.sectionProgress.upsert({
        where: {
          enrollmentId_sectionId: {
            enrollmentId: enrollment.id,
            sectionId: quiz.sectionId,
          },
        },
        create: {
          enrollmentId: enrollment.id,
          sectionId: quiz.sectionId,
          isCompleted: true,
          completedAt: new Date(),
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // Check if all sections are completed
      const allSections = await prisma.moduleSection.findMany({
        where: { moduleId: quiz.section.moduleId },
      });

      const allProgress = await prisma.sectionProgress.findMany({
        where: {
          enrollmentId: enrollment.id,
          isCompleted: true,
        },
      });

      if (allProgress.length >= allSections.length) {
        await prisma.moduleEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }
    }

    // Get attempt count for user
    const attemptCount = await prisma.quizAttempt.count({
      where: {
        quizId,
        userId: user.id,
      },
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        score: earnedPoints,
        maxScore: totalPoints,
        percentage,
        passed,
        answers: gradedAnswersResponse, // Safe version without correct answers
        attemptNumber: attemptCount,
        maxAttempts: quiz.maxAttempts,
        passingScore: quiz.passingScore,
      },
      // Include question explanations for review (only if passed or no more attempts)
      explanations: (passed || (quiz.maxAttempts && attemptCount >= quiz.maxAttempts))
        ? quiz.questions.reduce((acc, q) => {
            if (q.explanation) {
              acc[q.id] = q.explanation;
            }
            return acc;
          }, {} as Record<string, string>)
        : {},
    });
  } catch (error) {
    console.error('Error submitting quiz attempt:', error);
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}

// GET /api/training-center/quiz/[quizId]/attempt - Get user's attempt history
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId } = await params;

    const quiz = await prisma.moduleQuiz.findUnique({
      where: { id: quizId },
      select: {
        maxAttempts: true,
        passingScore: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        userId: user.id,
      },
      orderBy: { completedAt: 'desc' },
    });

    const hasPassed = attempts.some(a => a.passed);
    const canRetake = quiz.maxAttempts === null || attempts.length < quiz.maxAttempts;

    return NextResponse.json({
      attempts,
      summary: {
        totalAttempts: attempts.length,
        maxAttempts: quiz.maxAttempts,
        passingScore: quiz.passingScore,
        hasPassed,
        canRetake: canRetake && !hasPassed,
        bestScore: attempts.length > 0 ? Math.max(...attempts.map(a => a.percentage)) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempts' },
      { status: 500 }
    );
  }
}
