#!/usr/bin/env tsx
/**
 * Database Backup Script
 *
 * Creates a full database backup and uploads to S3 for disaster recovery.
 * Runs daily via cron job.
 *
 * Usage:
 *   npm run db:backup           # Create backup
 *   npm run db:backup --verify  # Create backup and verify
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '../src/lib/db';

const BACKUP_BUCKET = process.env.AWS_S3_BACKUP_BUCKET || process.env.AWS_S3_BUCKET || 'ripple-vms-media';
const BACKUP_PREFIX = 'database-backups/';
const RETENTION_DAYS = 30; // Keep backups for 30 days

interface BackupMetadata {
  timestamp: string;
  size: number;
  tables: {
    User: number;
    Organization: number;
    Shift: number;
    Coverage: number;
    [key: string]: number;
  };
  database_url_hash: string; // Hash to verify we're backing up correct DB
  backup_type: 'full' | 'schema-only' | 'data-only';
}

/**
 * Get S3 client
 */
function getS3Client(): S3Client {
  return new S3Client({
    region: (process.env.AWS_REGION || 'us-east-1').trim(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

/**
 * Create a hash of the database URL (for verification, not security)
 */
function getDatabaseHash(url: string): string {
  // Simple hash - just take host and database name
  const match = url.match(/@([^/]+)\/([^?]+)/);
  if (!match) return 'unknown';
  return `${match[1]}/${match[2]}`;
}

/**
 * Collect database statistics before backup
 */
async function collectDatabaseStats(): Promise<BackupMetadata['tables']> {
  console.log('[Backup] Collecting database statistics...');

  const stats: BackupMetadata['tables'] = {
    User: 0,
    Organization: 0,
    Shift: 0,
    Coverage: 0,
  };

  try {
    stats.User = await prisma.user.count();
    stats.Organization = await prisma.organization.count();
    stats.Shift = await prisma.shift.count();
    stats.Coverage = await prisma.coverage.count();

    console.log('[Backup] Statistics collected:', stats);
  } catch (error) {
    console.error('[Backup] Failed to collect statistics:', error);
    // Don't fail backup if stats collection fails
  }

  return stats;
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(): Promise<{ filename: string; metadata: BackupMetadata }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql`;
  const tempPath = `/tmp/${filename}`;

  console.log('[Backup] Creating database backup...');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Collect stats before backup
  const stats = await collectDatabaseStats();

  try {
    // Run pg_dump to create backup
    const command = `pg_dump "${databaseUrl}" > ${tempPath}`;
    execSync(command, { stdio: 'inherit' });

    // Verify backup file was created and has content
    const backupContent = readFileSync(tempPath, 'utf-8');
    const backupSize = Buffer.byteLength(backupContent, 'utf-8');

    if (backupSize < 1000) {
      throw new Error(`Backup file is suspiciously small (${backupSize} bytes)`);
    }

    // Verify backup contains expected content
    if (!backupContent.includes('PostgreSQL database dump')) {
      throw new Error('Backup file does not appear to be a valid pg_dump output');
    }

    console.log(`[Backup] Backup created successfully (${(backupSize / 1024 / 1024).toFixed(2)} MB)`);

    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      size: backupSize,
      tables: stats,
      database_url_hash: getDatabaseHash(databaseUrl),
      backup_type: 'full',
    };

    return { filename: tempPath, metadata };
  } catch (error) {
    // Clean up temp file on error
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Upload backup to S3
 */
async function uploadBackupToS3(
  localPath: string,
  metadata: BackupMetadata
): Promise<string> {
  console.log('[Backup] Uploading to S3...');

  const s3Client = getS3Client();
  const filename = localPath.split('/').pop()!;
  const s3Key = `${BACKUP_PREFIX}${filename}`;

  // Read backup file
  const backupContent = readFileSync(localPath);

  // Upload backup file
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: s3Key,
      Body: backupContent,
      ContentType: 'application/sql',
      Metadata: {
        timestamp: metadata.timestamp,
        size: metadata.size.toString(),
        userCount: metadata.tables.User.toString(),
        orgCount: metadata.tables.Organization.toString(),
        shiftCount: metadata.tables.Shift.toString(),
        coverageCount: metadata.tables.Coverage.toString(),
        databaseHash: metadata.database_url_hash,
        backupType: metadata.backup_type,
      },
      // Add lifecycle tags
      Tagging: `Environment=production&Type=database-backup&RetentionDays=${RETENTION_DAYS}`,
    })
  );

  // Upload metadata file
  const metadataKey = `${BACKUP_PREFIX}${filename}.metadata.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: metadataKey,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json',
    })
  );

  console.log(`[Backup] Uploaded to s3://${BACKUP_BUCKET}/${s3Key}`);

  return s3Key;
}

/**
 * Clean up old backups beyond retention period
 */
async function cleanupOldBackups(): Promise<void> {
  console.log('[Backup] Cleaning up old backups...');

  const s3Client = getS3Client();
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - RETENTION_DAYS);

  try {
    // List all backups
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BACKUP_BUCKET,
        Prefix: BACKUP_PREFIX,
      })
    );

    if (!response.Contents) {
      console.log('[Backup] No backups found');
      return;
    }

    let deletedCount = 0;
    for (const object of response.Contents) {
      if (object.LastModified && object.LastModified < retentionDate) {
        // Note: Would use DeleteObjectCommand here in production
        // Skipped for safety - implement with care
        console.log(`[Backup] Would delete old backup: ${object.Key} (${object.LastModified.toISOString()})`);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[Backup] Found ${deletedCount} old backups beyond ${RETENTION_DAYS} days retention`);
      console.log('[Backup] Automatic deletion is disabled for safety - implement S3 lifecycle policy instead');
    } else {
      console.log('[Backup] No old backups to clean up');
    }
  } catch (error) {
    console.error('[Backup] Failed to clean up old backups:', error);
    // Don't fail the backup process if cleanup fails
  }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(localPath: string): Promise<boolean> {
  console.log('[Backup] Verifying backup integrity...');

  try {
    const backupContent = readFileSync(localPath, 'utf-8');

    // Check for required PostgreSQL dump markers
    const requiredMarkers = [
      'PostgreSQL database dump',
      'SET statement_timeout',
      'CREATE TABLE',
    ];

    for (const marker of requiredMarkers) {
      if (!backupContent.includes(marker)) {
        console.error(`[Backup] Verification failed: Missing expected marker "${marker}"`);
        return false;
      }
    }

    // Check for critical tables
    const criticalTables = ['User', 'Organization', 'Shift', 'Coverage'];
    for (const table of criticalTables) {
      if (!backupContent.includes(`CREATE TABLE public."${table}"`)) {
        console.error(`[Backup] Verification failed: Missing table "${table}"`);
        return false;
      }
    }

    // Verify file size is reasonable (should be at least 10KB for empty schema)
    const size = Buffer.byteLength(backupContent, 'utf-8');
    if (size < 10000) {
      console.error(`[Backup] Verification failed: Backup file too small (${size} bytes)`);
      return false;
    }

    console.log('[Backup] Verification passed');
    return true;
  } catch (error) {
    console.error('[Backup] Verification failed:', error);
    return false;
  }
}

/**
 * Send backup notification
 */
async function sendBackupNotification(
  success: boolean,
  metadata: BackupMetadata | null,
  s3Key?: string,
  error?: Error
): Promise<void> {
  // Import email module
  const { sendEmail } = await import('../src/lib/email');

  const subject = success
    ? `✅ Database Backup Successful - ${new Date().toLocaleDateString()}`
    : `❌ Database Backup Failed - ${new Date().toLocaleDateString()}`;

  const body = success && metadata
    ? `
Database backup completed successfully.

Backup Details:
- Timestamp: ${metadata.timestamp}
- Size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB
- Location: s3://${BACKUP_BUCKET}/${s3Key}

Table Counts:
- Users: ${metadata.tables.User}
- Organizations: ${metadata.tables.Organization}
- Shifts: ${metadata.tables.Shift}
- Coverage: ${metadata.tables.Coverage}

Database: ${metadata.database_url_hash}

Retention: ${RETENTION_DAYS} days

Next backup: Tomorrow at the same time
    `.trim()
    : `
Database backup failed.

Error: ${error?.message || 'Unknown error'}

Please investigate immediately and check the logs for details.

You may need to run a manual backup:
  npm run db:backup

See: docs/Operations/DISASTER_RECOVERY_RUNBOOK.md
    `.trim();

  // Get developer users to notify
  const developers = await prisma.user.findMany({
    where: { role: 'DEVELOPER' },
    select: { email: true },
  });

  const recipients = [
    ...developers.map(d => d.email),
    'joshcottrell@gmail.com', // Always notify primary developer
  ];

  for (const email of recipients) {
    try {
      await sendEmail({
        to: email,
        subject,
        text: body,
        html: `<pre>${body}</pre>`,
      });
    } catch (emailError) {
      console.error(`[Backup] Failed to send notification to ${email}:`, emailError);
      // Don't fail backup if notification fails
    }
  }
}

/**
 * Main backup process
 */
async function main() {
  const startTime = Date.now();
  let tempBackupPath: string | undefined;
  let backupMetadata: BackupMetadata | null = null;
  let s3Key: string | undefined;

  try {
    console.log('='.repeat(60));
    console.log('DATABASE BACKUP STARTED');
    console.log('='.repeat(60));

    // Step 1: Create backup
    const { filename, metadata } = await createBackup();
    tempBackupPath = filename;
    backupMetadata = metadata;

    // Step 2: Verify backup (if --verify flag provided)
    if (process.argv.includes('--verify')) {
      const isValid = await verifyBackup(filename);
      if (!isValid) {
        throw new Error('Backup verification failed');
      }
    }

    // Step 3: Upload to S3
    s3Key = await uploadBackupToS3(filename, metadata);

    // Step 4: Clean up old backups
    await cleanupOldBackups();

    // Step 5: Clean up temp file
    unlinkSync(filename);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('='.repeat(60));
    console.log(`DATABASE BACKUP COMPLETED (${duration}s)`);
    console.log('='.repeat(60));

    // Send success notification
    await sendBackupNotification(true, metadata, s3Key);

    process.exit(0);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('='.repeat(60));
    console.error(`DATABASE BACKUP FAILED (${duration}s)`);
    console.error('='.repeat(60));
    console.error(error);

    // Clean up temp file if it exists
    if (tempBackupPath) {
      try {
        unlinkSync(tempBackupPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Send failure notification
    await sendBackupNotification(false, backupMetadata, s3Key, error as Error);

    process.exit(1);
  }
}

// Run backup
main();
