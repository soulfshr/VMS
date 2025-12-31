import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditCreate, toAuditUser } from '@/lib/audit';
import { getCurrentOrgId } from '@/lib/org-context';

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

    // Multi-tenant: Show modules that are either global (null) or belong to current org
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { OR: [{ organizationId: orgId }, { organizationId: null }] }
      : { organizationId: null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...orgFilter };

    if (published === 'true' || !isDeveloper) {
      // Learner view or non-developer: only published modules
      where.isPublished = true;
    } else if (status === 'published') {
      where.isPublished = true;
    } else if (status === 'draft') {
      where.isPublished = false;
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
        grantsQualifiedRoles: {
          include: {
            qualifiedRole: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
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
      // Transform junction table to flat array of qualified roles
      grantsQualifiedRoles: module.grantsQualifiedRoles.map(g => g.qualifiedRole),
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
      grantsQualifiedRoleIds, // NEW: Array of role IDs
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Get current org for module scoping
    const orgId = await getCurrentOrgId();

    // Get the next sort order
    const lastModule = await prisma.trainingModule.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (lastModule?.sortOrder ?? -1) + 1;

    // Use transaction to create module and role grants atomically
    const trainingModule = await prisma.$transaction(async (tx) => {
      // Create the module (scoped to current org if set)
      const createdModule = await tx.trainingModule.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          thumbnailUrl: thumbnailUrl || null,
          estimatedMinutes: estimatedMinutes || 30,
          isRequired: isRequired || false,
          isPublished: false, // Always start as draft
          sortOrder: nextSortOrder,
          grantsQualifiedRoleId: grantsQualifiedRoleId || null, // DEPRECATED but keep for compatibility
          organizationId: orgId || null, // Multi-tenant: Associate with current org
        },
      });

      // Create role grants if provided (new many-to-many)
      if (grantsQualifiedRoleIds && Array.isArray(grantsQualifiedRoleIds) && grantsQualifiedRoleIds.length > 0) {
        await tx.moduleQualifiedRoleGrant.createMany({
          data: grantsQualifiedRoleIds.map((roleId: string) => ({
            moduleId: createdModule.id,
            qualifiedRoleId: roleId,
          })),
        });
      }

      // Fetch the complete module with relations
      return tx.trainingModule.findUnique({
        where: { id: createdModule.id },
        include: {
          grantsQualifiedRole: {
            select: {
              id: true,
              name: true,
            },
          },
          grantsQualifiedRoles: {
            include: {
              qualifiedRole: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
      });
    });

    // Transform response
    const responseModule = {
      ...trainingModule,
      grantsQualifiedRoles: trainingModule?.grantsQualifiedRoles.map(g => g.qualifiedRole) || [],
    };

    // Audit log the module creation
    await auditCreate(
      toAuditUser(user),
      'TrainingModule',
      trainingModule!.id,
      { title: trainingModule!.title, isRequired: trainingModule!.isRequired }
    );

    return NextResponse.json({ module: responseModule }, { status: 201 });
  } catch (error) {
    console.error('Error creating module:', error);
    return NextResponse.json(
      { error: 'Failed to create module' },
      { status: 500 }
    );
  }
}
