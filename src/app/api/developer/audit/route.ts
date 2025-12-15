import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import type { AuditEntityType, AuditAction } from '@/lib/audit';

/**
 * GET /api/developer/audit
 * Fetch audit logs with filtering and pagination
 * Requires DEVELOPER role only
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication - DEVELOPER only
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    // Filters
    const entityType = searchParams.get('entityType') as AuditEntityType | null;
    const action = searchParams.get('action') as AuditAction | null;
    const userId = searchParams.get('userId');
    const entityId = searchParams.get('entityId');
    const search = searchParams.get('search'); // Search by email or entity ID
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Fetch logs and count
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Get unique entity types and actions for filter dropdowns
    const [entityTypes, actions] = await Promise.all([
      prisma.auditLog.findMany({
        select: { entityType: true },
        distinct: ['entityType'],
      }),
      prisma.auditLog.findMany({
        select: { action: true },
        distinct: ['action'],
      }),
    ]);

    return NextResponse.json({
      logs,
      filters: {
        entityTypes: entityTypes.map(e => e.entityType),
        actions: actions.map(a => a.action),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developer/audit
 * Clear old audit logs (developer only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication - DEVELOPER only
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const daysOld = parseInt(searchParams.get('daysOld') || '30');

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return NextResponse.json({
      deleted: result.count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error('Error clearing audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear audit logs' },
      { status: 500 }
    );
  }
}
