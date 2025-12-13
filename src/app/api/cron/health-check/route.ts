import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { alerts } from '@/lib/alerts';
import { SESClient, GetSendQuotaCommand } from '@aws-sdk/client-ses';
import { Redis } from '@upstash/redis';

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

async function checkDatabase(): Promise<{ status: 'healthy' | 'degraded' | 'down'; responseMs: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', responseMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      responseMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkEmail(): Promise<{ status: 'healthy' | 'degraded' | 'down'; responseMs: number; error?: string; details?: Record<string, unknown> }> {
  const start = Date.now();

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return { status: 'degraded', responseMs: Date.now() - start, error: 'AWS credentials not configured' };
  }

  try {
    const ses = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const result = await ses.send(new GetSendQuotaCommand({}));
    const usedPercent = ((result.SentLast24Hours || 0) / (result.Max24HourSend || 1)) * 100;

    return {
      status: usedPercent > 90 ? 'degraded' : 'healthy',
      responseMs: Date.now() - start,
      details: {
        sentLast24Hours: result.SentLast24Hours,
        max24HourSend: result.Max24HourSend,
        maxSendRate: result.MaxSendRate,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      responseMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'SES check failed',
    };
  }
}

async function checkRedis(): Promise<{ status: 'healthy' | 'degraded' | 'down'; responseMs: number; error?: string }> {
  const start = Date.now();

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { status: 'degraded', responseMs: Date.now() - start, error: 'Redis not configured' };
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    await redis.ping();
    return { status: 'healthy', responseMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      responseMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Redis ping failed',
    };
  }
}

export async function GET(request: NextRequest) {
  // Verify cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run all health checks in parallel
    const [dbResult, emailResult, redisResult] = await Promise.all([
      checkDatabase(),
      checkEmail(),
      checkRedis(),
    ]);

    const results = [
      { service: 'database', ...dbResult },
      { service: 'email', ...emailResult },
      { service: 'redis', ...redisResult },
    ];

    // Store results in database
    await prisma.healthCheck.createMany({
      data: results.map(r => ({
        service: r.service,
        status: r.status,
        responseMs: r.responseMs,
        error: r.error || null,
      })),
    });

    // Check for failures and send alerts
    for (const result of results) {
      if (result.status === 'down' && result.error) {
        switch (result.service) {
          case 'database':
            await alerts.databaseError(result.error);
            break;
          case 'email':
            await alerts.emailServiceDown(result.error);
            break;
          case 'redis':
            await alerts.redisDown(result.error);
            break;
        }
      }
    }

    // Determine overall status
    const hasDown = results.some(r => r.status === 'down');
    const hasDegraded = results.some(r => r.status === 'degraded');
    const overall = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';

    return NextResponse.json({
      overall,
      services: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check cron error:', error);
    return NextResponse.json(
      { error: 'Health check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
