import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { LogSeverity, LogCategory } from '@/generated/prisma/enums';

/**
 * GET /api/developer/logs
 * Fetch system logs with filtering and pagination
 * Requires DEVELOPER or ADMINISTRATOR role
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getDbUser();
    if (!user || !['DEVELOPER', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    // Filters
    const severity = searchParams.get('severity') as LogSeverity | null;
    const category = searchParams.get('category') as LogCategory | null;
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (severity) {
      where.severity = severity;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.message = {
        contains: search,
        mode: 'insensitive',
      };
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
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developer/logs
 * Clear old logs (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const daysOld = parseInt(searchParams.get('daysOld') || '30');

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.systemLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return NextResponse.json({
      deleted: result.count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
