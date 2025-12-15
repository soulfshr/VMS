import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditDelete, toAuditUser } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string; enrollmentId: string }>;
}

// DELETE /api/training-center/modules/[id]/enrollments/[enrollmentId] - Reset a user's progress
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only DEVELOPER role can reset enrollments
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: moduleId, enrollmentId } = await params;
    const { searchParams } = new URL(request.url);
    const revokeQualification = searchParams.get('revokeQualification') === 'true';

    // Get the enrollment with module and user info
    const enrollment = await prisma.moduleEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        module: {
          include: {
            grantsQualifiedRole: true,
            sections: {
              where: { type: 'QUIZ' },
              include: {
                quiz: {
                  select: { id: true },
                },
              },
            },
          },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.moduleId !== moduleId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this module' }, { status: 400 });
    }

    // Get quiz IDs for this module
    const quizIds = enrollment.module.sections
      .filter(s => s.quiz)
      .map(s => s.quiz!.id);

    // Delete quiz attempts for this user on these quizzes
    if (quizIds.length > 0) {
      await prisma.quizAttempt.deleteMany({
        where: {
          userId: enrollment.userId,
          quizId: { in: quizIds },
        },
      });
    }

    // Delete section progress (should cascade from enrollment, but be explicit)
    await prisma.sectionProgress.deleteMany({
      where: { enrollmentId: enrollment.id },
    });

    // Delete the enrollment itself
    await prisma.moduleEnrollment.delete({
      where: { id: enrollmentId },
    });

    // Audit log the enrollment reset
    auditDelete(
      toAuditUser(user),
      'TrainingEnrollment',
      enrollmentId,
      {
        userId: enrollment.userId,
        userName: enrollment.user.name,
        moduleId: enrollment.moduleId,
        moduleTitle: enrollment.module.title,
        status: enrollment.status,
      }
    );

    // Optionally revoke qualified role
    if (revokeQualification && enrollment.module.grantsQualifiedRole) {
      await prisma.userQualification.deleteMany({
        where: {
          userId: enrollment.userId,
          qualifiedRoleId: enrollment.module.grantsQualifiedRole.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Reset progress for ${enrollment.user.name}`,
      revokedQualification: revokeQualification && !!enrollment.module.grantsQualifiedRole,
    });
  } catch (error) {
    console.error('Error resetting enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to reset enrollment' },
      { status: 500 }
    );
  }
}
