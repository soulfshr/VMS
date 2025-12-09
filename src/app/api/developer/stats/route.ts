import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

/**
 * GET /api/developer/stats
 * Get system statistics for developer dashboard
 * Requires DEVELOPER or ADMINISTRATOR role
 */
export async function GET() {
  try {
    // Check authentication
    const user = await getDbUser();
    if (!user || !['DEVELOPER', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch various stats in parallel
    const [
      // Log stats (last 24h)
      totalLogs24h,
      errorLogs24h,
      criticalLogs24h,
      warnLogs24h,

      // Recent errors
      recentErrors,

      // Health check history
      recentHealthChecks,

      // Email stats (from EmailBlast)
      emailBlastStats,

      // Business metrics
      activeShiftsToday,
      rsvpsToday,
      activeVolunteers,

      // Alert states
      alertStates,
    ] = await Promise.all([
      // Total logs in last 24h
      prisma.systemLog.count({
        where: { createdAt: { gte: last24h } },
      }),

      // Error logs in last 24h
      prisma.systemLog.count({
        where: {
          createdAt: { gte: last24h },
          severity: 'ERROR',
        },
      }),

      // Critical logs in last 24h
      prisma.systemLog.count({
        where: {
          createdAt: { gte: last24h },
          severity: 'CRITICAL',
        },
      }),

      // Warning logs in last 24h
      prisma.systemLog.count({
        where: {
          createdAt: { gte: last24h },
          severity: 'WARN',
        },
      }),

      // Recent errors (last 10)
      prisma.systemLog.findMany({
        where: {
          severity: { in: ['ERROR', 'CRITICAL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Recent health checks (last per service)
      prisma.healthCheck.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 20,
      }),

      // Email blast stats (last 7 days)
      prisma.emailBlast.aggregate({
        where: { createdAt: { gte: last7d } },
        _sum: {
          sentCount: true,
          failedCount: true,
          recipientCount: true,
        },
        _count: true,
      }),

      // Active shifts today
      prisma.shift.count({
        where: {
          date: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
            lt: new Date(now.setHours(23, 59, 59, 999)),
          },
          status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
        },
      }),

      // RSVPs created today
      prisma.shiftVolunteer.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),

      // Active volunteers (logged in last 30 days)
      prisma.user.count({
        where: {
          role: { in: ['VOLUNTEER', 'COORDINATOR', 'DISPATCHER'] },
          isActive: true,
          lastLoginAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Alert states
      prisma.alertState.findMany({
        orderBy: { lastTriggeredAt: 'desc' },
      }),
    ]);

    // Calculate error rate
    const errorRate = totalLogs24h > 0 ? (errorLogs24h + criticalLogs24h) / totalLogs24h : 0;

    // Get latest health status per service
    const healthByService: Record<string, { status: string; responseMs: number; checkedAt: Date }> = {};
    for (const check of recentHealthChecks) {
      if (!healthByService[check.service]) {
        healthByService[check.service] = {
          status: check.status,
          responseMs: check.responseMs,
          checkedAt: check.checkedAt,
        };
      }
    }

    // Calculate email success rate
    const emailTotal = emailBlastStats._sum.recipientCount || 0;
    const emailFailed = emailBlastStats._sum.failedCount || 0;
    const emailSuccessRate = emailTotal > 0 ? 1 - emailFailed / emailTotal : 1;

    return NextResponse.json({
      // Log metrics
      logs: {
        total24h: totalLogs24h,
        errors24h: errorLogs24h,
        critical24h: criticalLogs24h,
        warnings24h: warnLogs24h,
        errorRate: Math.round(errorRate * 10000) / 100, // percentage with 2 decimals
      },

      // Recent errors
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        severity: e.severity,
        category: e.category,
        message: e.message,
        createdAt: e.createdAt,
      })),

      // Health status
      health: {
        services: healthByService,
        overall: Object.values(healthByService).some((s) => s.status === 'down')
          ? 'unhealthy'
          : Object.values(healthByService).some((s) => s.status === 'degraded')
            ? 'degraded'
            : 'healthy',
      },

      // Email metrics
      email: {
        blasts7d: emailBlastStats._count,
        sent7d: emailBlastStats._sum.sentCount || 0,
        failed7d: emailBlastStats._sum.failedCount || 0,
        successRate: Math.round(emailSuccessRate * 10000) / 100,
      },

      // Business metrics
      business: {
        activeShiftsToday,
        rsvpsToday,
        activeVolunteers30d: activeVolunteers,
      },

      // Alerts
      alerts: alertStates.map((a) => ({
        type: a.alertType,
        lastTriggered: a.lastTriggeredAt,
        triggerCount: a.triggerCount,
        inCooldown: a.cooldownUntil ? a.cooldownUntil > new Date() : false,
      })),

      // Metadata
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching developer stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
