import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// GET /api/training-center/modules - List all modules
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // 'published', 'draft', or null for all
    const published = searchParams.get('published'); // 'true' for learner view

    // Non-developers can only see published modules
    const isDeveloper = user.role === 'DEVELOPER';

    let where: { isPublished?: boolean } = {};

    if (published === 'true' || !isDeveloper) {
      // Learner view or non-developer: only published modules
      where = { isPublished: true };
    } else if (status === 'published') {
      where = { isPublished: true };
    } else if (status === 'draft') {
      where = { isPublished: false };
    }
    // else: show all (developer only)

    const modules = await prisma.trainingModule.findMany({
      where,
      include: {
        sections: {
          select: {
            id: true,
            type: true,
          },
        },
        enrollments: {
          select: {
            id: true,
            status: true,
          },
        },
        grantsQualifiedRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Transform to include summary counts
    const modulesWithStats = modules.map(module => ({
      id: module.id,
      title: module.title,
      description: module.description,
      thumbnailUrl: module.thumbnailUrl,
      estimatedMinutes: module.estimatedMinutes,
      isRequired: module.isRequired,
      isPublished: module.isPublished,
      sortOrder: module.sortOrder,
      grantsQualifiedRole: module.grantsQualifiedRole,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
      stats: {
        sectionCount: module.sections.length,
        videoCount: module.sections.filter(s => s.type === 'VIDEO').length,
        quizCount: module.sections.filter(s => s.type === 'QUIZ').length,
        enrollmentCount: module.enrollments.length,
        completedCount: module.enrollments.filter(e => e.status === 'COMPLETED').length,
      },
    }));

    return NextResponse.json({ modules: modulesWithStats });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}

// POST /api/training-center/modules - Create a new module
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only DEVELOPER role can access Training Center
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      thumbnailUrl,
      estimatedMinutes,
      isRequired,
      grantsQualifiedRoleId,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Get the next sort order
    const lastModule = await prisma.trainingModule.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (lastModule?.sortOrder ?? -1) + 1;

    const trainingModule = await prisma.trainingModule.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        thumbnailUrl: thumbnailUrl || null,
        estimatedMinutes: estimatedMinutes || 30,
        isRequired: isRequired || false,
        isPublished: false, // Always start as draft
        sortOrder: nextSortOrder,
        grantsQualifiedRoleId: grantsQualifiedRoleId || null,
      },
      include: {
        grantsQualifiedRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ module: trainingModule }, { status: 201 });
  } catch (error) {
    console.error('Error creating module:', error);
    return NextResponse.json(
      { error: 'Failed to create module' },
      { status: 500 }
    );
  }
}
