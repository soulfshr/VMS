import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Verify cron request is from Vercel
function verifyCronRequest(request: NextRequest): boolean {
  // In development, allow requests without auth
  if (process.env.NODE_ENV === 'development') return true;

  // In production, CRON_SECRET is required
  if (!process.env.CRON_SECRET) {
    console.error('[Cron] CRON_SECRET not configured - rejecting request');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  // Verify cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Delete SystemLogs older than 30 days
    const logsRetentionDays = 30;
    const logsCutoff = new Date(now.getTime() - logsRetentionDays * 24 * 60 * 60 * 1000);
    const deletedLogs = await prisma.systemLog.deleteMany({
      where: { createdAt: { lt: logsCutoff } },
    });

    // Delete HealthChecks older than 7 days
    const healthRetentionDays = 7;
    const healthCutoff = new Date(now.getTime() - healthRetentionDays * 24 * 60 * 60 * 1000);
    const deletedHealthChecks = await prisma.healthCheck.deleteMany({
      where: { checkedAt: { lt: healthCutoff } },
    });

    // Delete AuditLogs older than 30 days
    const auditRetentionDays = 30;
    const auditCutoff = new Date(now.getTime() - auditRetentionDays * 24 * 60 * 60 * 1000);
    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });

    // Log the cleanup
    await logger.info(
      'SYSTEM',
      `Cleanup completed: deleted ${deletedLogs.count} logs, ${deletedHealthChecks.count} health checks, ${deletedAuditLogs.count} audit logs`,
      {
        logsDeleted: deletedLogs.count,
        healthChecksDeleted: deletedHealthChecks.count,
        auditLogsDeleted: deletedAuditLogs.count,
        logsCutoff: logsCutoff.toISOString(),
        healthCutoff: healthCutoff.toISOString(),
        auditCutoff: auditCutoff.toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      deleted: {
        systemLogs: deletedLogs.count,
        healthChecks: deletedHealthChecks.count,
        auditLogs: deletedAuditLogs.count,
      },
      cutoffs: {
        systemLogs: logsCutoff.toISOString(),
        healthChecks: healthCutoff.toISOString(),
        auditLogs: auditCutoff.toISOString(),
      },
    });
  } catch (error) {
    console.error('Cleanup cron error:', error);

    await logger.error(
      'SYSTEM',
      'Cleanup cron job failed',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
