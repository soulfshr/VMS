import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditUpdate, auditDelete, toAuditUser } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/training-center/modules/[id] - Get a single module with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isDeveloper = user.role === 'DEVELOPER';

    const trainingModule = await prisma.trainingModule.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            quiz: {
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
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        grantsQualifiedRole: {
          select: {
            id: true,
            name: true,
          },
        },
        enrollments: isDeveloper ? {
          select: {
            id: true,
            status: true,
            userId: true,
            startedAt: true,
            completedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { completedAt: 'desc' },
        } : false,
      },
    });

    if (!trainingModule) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Non-developers can only view published modules
    if (!isDeveloper && !trainingModule.isPublished) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // For non-developers, hide quiz correct answers
    if (!isDeveloper) {
      const sanitizedModule = {
        ...trainingModule,
        sections: trainingModule.sections.map(section => ({
          ...section,
          quiz: section.quiz ? {
            ...section.quiz,
            questions: section.quiz.questions.map(q => ({
              ...q,
              options: q.options.map(o => ({
                id: o.id,
                optionText: o.optionText,
                sortOrder: o.sortOrder,
                questionId: o.questionId,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                // Omit isCorrect for non-developers
              })),
            })),
          } : null,
        })),
      };
      return NextResponse.json({ module: sanitizedModule });
    }

    return NextResponse.json({ module: trainingModule });
  } catch (error) {
    console.error('Error fetching module:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module' },
      { status: 500 }
    );
  }
}

// PUT /api/training-center/modules/[id] - Update a module
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only DEVELOPER role can access Training Center
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      title,
      description,
      thumbnailUrl,
      estimatedMinutes,
      isRequired,
      isPublished,
      sortOrder,
      grantsQualifiedRoleId,
    } = body;

    // Check module exists
    const existing = await prisma.trainingModule.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl || null;
    if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (grantsQualifiedRoleId !== undefined) updateData.grantsQualifiedRoleId = grantsQualifiedRoleId || null;

    const trainingModule = await prisma.trainingModule.update({
      where: { id },
      data: updateData,
      include: {
        sections: {
          select: {
            id: true,
            type: true,
          },
        },
        grantsQualifiedRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Audit log the module update
    auditUpdate(
      toAuditUser(user),
      'TrainingModule',
      trainingModule.id,
      existing as unknown as Record<string, unknown>,
      trainingModule as unknown as Record<string, unknown>
    );

    return NextResponse.json({ module: trainingModule });
  } catch (error) {
    console.error('Error updating module:', error);
    return NextResponse.json(
      { error: 'Failed to update module' },
      { status: 500 }
    );
  }
}

// DELETE /api/training-center/modules/[id] - Delete a module
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only DEVELOPER role can access Training Center
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check module exists
    const existing = await prisma.trainingModule.findUnique({
      where: { id },
      include: {
        enrollments: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Warn if there are enrollments
    if (existing.enrollments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete module with existing enrollments. Unpublish it instead.' },
        { status: 400 }
      );
    }

    // Delete the module (cascade will handle sections, quizzes, etc.)
    await prisma.trainingModule.delete({
      where: { id },
    });

    // Audit log the module deletion
    auditDelete(
      toAuditUser(user),
      'TrainingModule',
      id,
      existing as unknown as Record<string, unknown>
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting module:', error);
    return NextResponse.json(
      { error: 'Failed to delete module' },
      { status: 500 }
    );
  }
}
