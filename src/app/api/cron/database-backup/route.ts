/**
 * Database Backup Cron Job
 *
 * Runs daily at 2 AM UTC to create and upload database backups to S3.
 *
 * Configured in vercel.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max (backup can take time)

/**
 * Verify request is from Vercel Cron
 */
function verifycronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In production, require CRON_SECRET
  if (!cronSecret) {
    console.error('[Backup Cron] CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Run database backup script
 */
async function runBackup(): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    console.log('[Backup Cron] Starting database backup...');

    // Run the backup script
    const output = execSync('npx tsx scripts/backup-database.ts --verify', {
      encoding: 'utf-8',
      timeout: 240000, // 4 minute timeout
      env: {
        ...process.env,
        // Ensure all required env vars are present
      },
    });

    console.log('[Backup Cron] Backup completed successfully');
    return { success: true, output };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Backup Cron] Backup failed:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      output: 'stdout' in (error as { stdout?: string }) ? (error as { stdout: string }).stdout : undefined,
    };
  }
}

/**
 * POST /api/cron/database-backup
 *
 * Triggered by Vercel Cron daily at 2 AM UTC
 */
export async function POST(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!verifycronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Backup Cron] Database backup cron job triggered');

  try {
    const result = await runBackup();

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Database backup completed successfully',
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Database backup failed',
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Backup Cron] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Database backup failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/database-backup
 *
 * Test endpoint for manual backup trigger (development only)
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  console.log('[Backup Cron] Manual backup trigger (development)');

  const result = await runBackup();

  return NextResponse.json({
    success: result.success,
    message: result.success ? 'Backup completed' : 'Backup failed',
    output: result.output,
    error: result.error,
    timestamp: new Date().toISOString(),
  });
}
