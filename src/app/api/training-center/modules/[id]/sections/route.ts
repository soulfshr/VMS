import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { SectionType } from '@/generated/prisma/enums';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/training-center/modules/[id]/sections - List sections for a module
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: moduleId } = await params;

    const sections = await prisma.moduleSection.findMany({
      where: { moduleId },
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
    });

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    );
  }
}

// POST /api/training-center/modules/[id]/sections - Create a new section
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: moduleId } = await params;
    const body = await request.json();
    const { title, type } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!type || !['VIDEO', 'TEXT', 'QUIZ', 'RESOURCE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid section type' }, { status: 400 });
    }

    // Verify module exists
    const trainingModule = await prisma.trainingModule.findUnique({
      where: { id: moduleId },
    });

    if (!trainingModule) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Get next sort order
    const lastSection = await prisma.moduleSection.findFirst({
      where: { moduleId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (lastSection?.sortOrder ?? -1) + 1;

    // Create section
    const section = await prisma.moduleSection.create({
      data: {
        moduleId,
        title: title.trim(),
        type: type as SectionType,
        sortOrder: nextSortOrder,
      },
    });

    // If it's a quiz section, create an empty quiz
    if (type === 'QUIZ') {
      await prisma.moduleQuiz.create({
        data: {
          sectionId: section.id,
          passingScore: 80,
        },
      });
    }

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error('Error creating section:', error);
    return NextResponse.json(
      { error: 'Failed to create section' },
      { status: 500 }
    );
  }
}
