import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { canManageTrainingCenter, createPermissionContext } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

// GET /api/training-center/modules/[id]/sections/[sectionId]
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

    const { sectionId } = await params;

    const section = await prisma.moduleSection.findUnique({
      where: { id: sectionId },
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
    });

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Error fetching section:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section' },
      { status: 500 }
    );
  }
}

// PUT /api/training-center/modules/[id]/sections/[sectionId]
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

    const { sectionId } = await params;
    const body = await request.json();

    const {
      title,
      sortOrder,
      videoUrl,
      videoDuration,
      textContent,
      resourceUrl,
      resourceName,
      attestationText,
    } = body;

    // Verify section exists
    const existing = await prisma.moduleSection.findUnique({
      where: { id: sectionId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl || null;
    if (videoDuration !== undefined) updateData.videoDuration = videoDuration;
    if (textContent !== undefined) updateData.textContent = textContent || null;
    if (resourceUrl !== undefined) updateData.resourceUrl = resourceUrl || null;
    if (resourceName !== undefined) updateData.resourceName = resourceName || null;
    if (attestationText !== undefined) updateData.attestationText = attestationText?.trim() || null;

    const section = await prisma.moduleSection.update({
      where: { id: sectionId },
      data: updateData,
      include: {
        quiz: true,
      },
    });

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Error updating section:', error);
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    );
  }
}

// DELETE /api/training-center/modules/[id]/sections/[sectionId]
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

    const { sectionId } = await params;

    // Verify section exists
    const existing = await prisma.moduleSection.findUnique({
      where: { id: sectionId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Delete section (cascade will handle quiz, questions, options)
    await prisma.moduleSection.delete({
      where: { id: sectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting section:', error);
    return NextResponse.json(
      { error: 'Failed to delete section' },
      { status: 500 }
    );
  }
}
