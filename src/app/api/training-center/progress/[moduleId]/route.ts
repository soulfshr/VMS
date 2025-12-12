import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/training-center/progress/[moduleId] - Get user's progress for a module
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { moduleId } = await params;

    // Get or create enrollment
    const enrollment = await prisma.moduleEnrollment.findUnique({
      where: {
        userId_moduleId: {
          userId: user.id,
          moduleId,
        },
      },
      include: {
        sectionProgress: true,
        module: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!enrollment) {
      // Return empty progress if not enrolled
      return NextResponse.json({
        enrollment: null,
        progress: 0,
        sectionProgress: {},
      });
    }

    // Calculate overall progress
    const totalSections = enrollment.module.sections.length;
    const completedSections = enrollment.sectionProgress.filter(sp => sp.isCompleted).length;
    const overallProgress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

    // Build section progress map
    const sectionProgressMap: Record<string, {
      isCompleted: boolean;
      videoProgress?: number;
      lastPosition?: number;
    }> = {};

    for (const sp of enrollment.sectionProgress) {
      sectionProgressMap[sp.sectionId] = {
        isCompleted: sp.isCompleted,
        videoProgress: sp.videoProgress ?? undefined,
        lastPosition: sp.lastPosition ?? undefined,
      };
    }

    return NextResponse.json({
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        startedAt: enrollment.startedAt,
        completedAt: enrollment.completedAt,
        lastAccessedAt: enrollment.lastAccessedAt,
      },
      progress: overallProgress,
      sectionProgress: sectionProgressMap,
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// POST /api/training-center/progress/[moduleId] - Enroll in a module (or get existing enrollment)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { moduleId } = await params;

    // Check if module exists and is published
    const trainingModule = await prisma.trainingModule.findUnique({
      where: { id: moduleId },
    });

    if (!trainingModule) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    if (!trainingModule.isPublished && user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Module not available' }, { status: 403 });
    }

    // Get or create enrollment
    const enrollment = await prisma.moduleEnrollment.upsert({
      where: {
        userId_moduleId: {
          userId: user.id,
          moduleId,
        },
      },
      create: {
        userId: user.id,
        moduleId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        lastAccessedAt: new Date(),
      },
      update: {
        lastAccessedAt: new Date(),
      },
      include: {
        sectionProgress: true,
      },
    });

    return NextResponse.json({
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        startedAt: enrollment.startedAt,
        completedAt: enrollment.completedAt,
        lastAccessedAt: enrollment.lastAccessedAt,
      },
    });
  } catch (error) {
    console.error('Error enrolling in module:', error);
    return NextResponse.json(
      { error: 'Failed to enroll in module' },
      { status: 500 }
    );
  }
}
