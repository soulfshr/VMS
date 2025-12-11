import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only DEVELOPER role can access Training Center
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get module counts
    const [totalModules, publishedModules, totalSections, totalQuizzes] = await Promise.all([
      prisma.trainingModule.count(),
      prisma.trainingModule.count({ where: { isPublished: true } }),
      prisma.moduleSection.count(),
      prisma.moduleQuiz.count(),
    ]);

    // Get enrollment stats
    const [totalEnrollments, completedEnrollments] = await Promise.all([
      prisma.moduleEnrollment.count(),
      prisma.moduleEnrollment.count({ where: { status: 'COMPLETED' } }),
    ]);

    // Calculate completion rate
    const averageCompletionRate = totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0;

    return NextResponse.json({
      totalModules,
      publishedModules,
      draftModules: totalModules - publishedModules,
      totalSections,
      totalQuizzes,
      totalEnrollments,
      completedEnrollments,
      averageCompletionRate,
    });
  } catch (error) {
    console.error('Error fetching training center stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
