import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// POST /api/training-center/progress/batch - Get progress for multiple modules at once
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { moduleIds } = body;

    if (!moduleIds || !Array.isArray(moduleIds)) {
      return NextResponse.json({ error: 'moduleIds required' }, { status: 400 });
    }

    // Get all enrollments for this user in one query
    const enrollments = await prisma.moduleEnrollment.findMany({
      where: {
        userId: user.id,
        moduleId: { in: moduleIds },
      },
      include: {
        sectionProgress: true,
        module: {
          select: {
            sections: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Build progress map
    const progress: Record<string, {
      moduleId: string;
      progress: number;
      status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    }> = {};

    for (const enrollment of enrollments) {
      const totalSections = enrollment.module.sections.length;
      const completedSections = enrollment.sectionProgress.filter(sp => sp.isCompleted).length;
      const progressPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

      progress[enrollment.moduleId] = {
        moduleId: enrollment.moduleId,
        progress: progressPercent,
        status: enrollment.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
      };
    }

    // Add NOT_STARTED for modules without enrollment
    for (const moduleId of moduleIds) {
      if (!progress[moduleId]) {
        progress[moduleId] = {
          moduleId,
          progress: 0,
          status: 'NOT_STARTED',
        };
      }
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error fetching batch progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
