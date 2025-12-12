import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// PUT /api/training-center/progress/[moduleId]/section/[sectionId] - Update section progress
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; sectionId: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { moduleId, sectionId } = await params;
    const body = await request.json();
    const { isCompleted, videoProgress, lastPosition } = body;

    // Verify section belongs to module
    const section = await prisma.moduleSection.findFirst({
      where: {
        id: sectionId,
        moduleId,
      },
    });

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Get or create enrollment first
    let enrollment = await prisma.moduleEnrollment.findUnique({
      where: {
        userId_moduleId: {
          userId: user.id,
          moduleId,
        },
      },
    });

    if (!enrollment) {
      // Auto-enroll the user
      enrollment = await prisma.moduleEnrollment.create({
        data: {
          userId: user.id,
          moduleId,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          lastAccessedAt: new Date(),
        },
      });
    }

    // Update section progress
    const updateData: {
      isCompleted?: boolean;
      completedAt?: Date | null;
      videoProgress?: number;
      lastPosition?: number;
    } = {};

    if (typeof isCompleted === 'boolean') {
      updateData.isCompleted = isCompleted;
      updateData.completedAt = isCompleted ? new Date() : null;
    }

    if (typeof videoProgress === 'number') {
      updateData.videoProgress = Math.min(100, Math.max(0, videoProgress));
    }

    if (typeof lastPosition === 'number') {
      updateData.lastPosition = Math.max(0, lastPosition);
    }

    const sectionProgress = await prisma.sectionProgress.upsert({
      where: {
        enrollmentId_sectionId: {
          enrollmentId: enrollment.id,
          sectionId,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        sectionId,
        ...updateData,
      },
      update: updateData,
    });

    // Update enrollment last accessed time
    await prisma.moduleEnrollment.update({
      where: { id: enrollment.id },
      data: { lastAccessedAt: new Date() },
    });

    // Check if all sections are completed
    const allSections = await prisma.moduleSection.findMany({
      where: { moduleId },
    });

    const allProgress = await prisma.sectionProgress.findMany({
      where: {
        enrollmentId: enrollment.id,
        isCompleted: true,
      },
    });

    const allCompleted = allProgress.length >= allSections.length;

    if (allCompleted && enrollment.status !== 'COMPLETED') {
      await prisma.moduleEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }

    // Calculate overall progress
    const completedCount = allProgress.length;
    const totalCount = allSections.length;
    const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return NextResponse.json({
      sectionProgress: {
        isCompleted: sectionProgress.isCompleted,
        videoProgress: sectionProgress.videoProgress,
        lastPosition: sectionProgress.lastPosition,
      },
      overallProgress,
      moduleCompleted: allCompleted,
    });
  } catch (error) {
    console.error('Error updating section progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}
