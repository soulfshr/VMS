import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SESClient, GetSendQuotaCommand } from '@aws-sdk/client-ses';
import { getDbUser } from '@/lib/user';

interface HealthResult {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * GET /api/developer/health
 * Returns health status of all services
 * Requires DEVELOPER or ADMINISTRATOR role
 */
export async function GET() {
  try {
    // Check authentication
    const user = await getDbUser();
    if (!user || !['DEVELOPER', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: HealthResult[] = [];

    // Check Database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.push({
        service: 'database',
        status: 'healthy',
        responseMs: Date.now() - dbStart,
      });
    } catch (err) {
      results.push({
        service: 'database',
        status: 'down',
        responseMs: Date.now() - dbStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Check Email (SES) - get send quota to verify connectivity
    const sesStart = Date.now();
    try {
      const ses = new SESClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });
      const quota = await ses.send(new GetSendQuotaCommand({}));
      results.push({
        service: 'email',
        status: 'healthy',
        responseMs: Date.now() - sesStart,
        details: {
          max24HourSend: quota.Max24HourSend,
          sentLast24Hours: quota.SentLast24Hours,
          maxSendRate: quota.MaxSendRate,
        },
      });
    } catch (err) {
      results.push({
        service: 'email',
        status: 'down',
        responseMs: Date.now() - sesStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Check Redis (Upstash)
    const redisStart = Date.now();
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Redis returned ${res.status}`);
        }

        results.push({
          service: 'redis',
          status: 'healthy',
          responseMs: Date.now() - redisStart,
        });
      } else {
        results.push({
          service: 'redis',
          status: 'degraded',
          responseMs: 0,
          error: 'Not configured (using in-memory fallback)',
        });
      }
    } catch (err) {
      results.push({
        service: 'redis',
        status: 'down',
        responseMs: Date.now() - redisStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Store results in database (fire and forget)
    for (const result of results) {
      prisma.healthCheck
        .create({
          data: {
            service: result.service,
            status: result.status,
            responseMs: result.responseMs,
            error: result.error,
          },
        })
        .catch(() => {
          // Ignore storage failures
        });
    }

    // Determine overall status
    const overallStatus = results.some((r) => r.status === 'down')
      ? 'unhealthy'
      : results.some((r) => r.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return NextResponse.json({
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      services: results,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
