import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';
import { hasElevatedPrivileges, createPermissionContext } from '@/lib/permissions';

/**
 * GET /api/coordinator/activity
 * Fetch recent activity log for coordinators (read-only)
 * Accessible to COORDINATOR, ADMINISTRATOR, DISPATCHER, and DEVELOPER roles
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow coordinators and above
    const ctx = createPermissionContext(user.role);
    if (!hasElevatedPrivileges(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50);
    const skip = (page - 1) * limit;

    // Filters
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');

    // Multi-tenant: Get users who belong to the current organization
    const orgId = await getCurrentOrgId();
    let orgUserIds: string[] = [];

    if (orgId) {
      // Get all user IDs who are members of this org
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        select: { userId: true },
      });
      orgUserIds = orgMembers.map(m => m.userId);
    }

    // Build where clause - exclude sensitive entity types for non-developers
    const where: Record<string, unknown> = {};

    // Multi-tenant: Only show activity from users in the current org
    if (orgId && orgUserIds.length > 0) {
      where.userId = { in: orgUserIds };
    } else if (orgId && orgUserIds.length === 0) {
      // Org exists but has no members - return empty
      return NextResponse.json({
        activities: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Coordinator-relevant entity types (exclude Auth logs for privacy)
    const allowedEntityTypes = [
      'User',
      'Shift',
      'ShiftVolunteer',
      'Zone',
      'CoverageSignup',
      'TrainingModule',
      'TrainingEnrollment',
      'IceSighting',
      'POI',
      'EmailBlast',
    ];

    if (entityType && allowedEntityTypes.includes(entityType)) {
      where.entityType = entityType;
    } else {
      where.entityType = { in: allowedEntityTypes };
    }

    if (action) {
      where.action = action;
    }

    // Fetch logs and count
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          userEmail: true,
          userName: true,
          entityType: true,
          entityId: true,
          action: true,
          createdAt: true,
          // Include newValue for context but redact sensitive fields
          newValue: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Transform logs into human-readable activity feed
    const activities = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      actor: log.userName || log.userEmail,
      actorEmail: log.userEmail,
      description: formatActivityDescription(log),
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
    }));

    return NextResponse.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 }
    );
  }
}

/**
 * Format an audit log entry into a human-readable description
 */
function formatActivityDescription(log: {
  action: string;
  entityType: string;
  entityId: string | null;
  userName: string | null;
  newValue: unknown;
}): string {
  const actionVerbs: Record<string, string> = {
    CREATE: 'created',
    UPDATE: 'updated',
    DELETE: 'deleted',
    LOGIN: 'logged in',
    LOGOUT: 'logged out',
  };

  const entityLabels: Record<string, string> = {
    User: 'volunteer profile',
    Shift: 'shift',
    ShiftVolunteer: 'shift signup',
    Zone: 'zone',
    CoverageSignup: 'coverage signup',
    TrainingModule: 'training module',
    TrainingEnrollment: 'training enrollment',
    IceSighting: 'ICE sighting report',
    POI: 'point of interest',
    EmailBlast: 'email blast',
    OrganizationSettings: 'organization settings',
  };

  const verb = actionVerbs[log.action] || log.action.toLowerCase();
  const entity = entityLabels[log.entityType] || log.entityType.toLowerCase();

  // Try to extract a name from newValue for context
  let context = '';
  if (log.newValue && typeof log.newValue === 'object') {
    const value = log.newValue as Record<string, unknown>;
    if (value.name && typeof value.name === 'string') {
      context = ` "${value.name}"`;
    } else if (value.title && typeof value.title === 'string') {
      context = ` "${value.title}"`;
    } else if (value.zoneName && typeof value.zoneName === 'string') {
      context = ` in ${value.zoneName}`;
    }
  }

  return `${verb} ${entity}${context}`;
}
