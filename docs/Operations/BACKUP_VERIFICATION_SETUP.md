# Automated Backup Verification Setup

**Last Updated:** 2025-12-27
**Status:** Implemented

## Overview

This document describes the automated database backup system that creates daily backups, uploads them to S3, and verifies their integrity.

---

## Components

### 1. Backup Script

**Location:** [scripts/backup-database.ts](../../scripts/backup-database.ts)

**What it does:**
- Creates a full PostgreSQL database dump using `pg_dump`
- Collects database statistics (table counts)
- Verifies backup integrity
- Uploads backup to S3 with metadata
- Sends notification emails to developers
- Manages backup retention

**Usage:**
```bash
# Create backup
npm run db:backup

# Create backup with verification
npm run db:backup:verify
```

---

### 2. Cron Job

**Location:** [src/app/api/cron/database-backup/route.ts](../../src/app/api/cron/database-backup/route.ts)

**Schedule:** Daily at 2:00 AM UTC (configured in `vercel.json`)

**What it does:**
- Runs the backup script automatically
- Verifies the cron request is legitimate
- Returns success/failure status
- Has a 5-minute timeout for large databases

**Manual Trigger (Development):**
```bash
curl http://localhost:3000/api/cron/database-backup
```

---

### 3. Configuration

**Vercel Cron Configuration:**
```json
{
  "path": "/api/cron/database-backup",
  "schedule": "0 2 * * *"  // Daily at 2 AM UTC
}
```

**Environment Variables Required:**
```bash
# Database Connection
DATABASE_URL="postgresql://..."

# AWS S3 Credentials
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="ripple-vms-media"           # Default bucket
AWS_S3_BACKUP_BUCKET="ripple-vms-backups"  # Optional: separate backup bucket

# Cron Security
CRON_SECRET="..."  # Required for production
```

---

## Backup Storage

### S3 Bucket Structure

```
s3://ripple-vms-backups/
└── database-backups/
    ├── backup-2025-12-27T02-00-00-000Z.sql
    ├── backup-2025-12-27T02-00-00-000Z.sql.metadata.json
    ├── backup-2025-12-26T02-00-00-000Z.sql
    ├── backup-2025-12-26T02-00-00-000Z.sql.metadata.json
    └── ...
```

### Backup File Format

**SQL File:** Standard PostgreSQL dump
```sql
--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
...
CREATE TABLE public."User" (...);
...
COPY public."User" (...) FROM stdin;
...
```

**Metadata File:** JSON with backup information
```json
{
  "timestamp": "2025-12-27T02:00:00.000Z",
  "size": 15728640,
  "tables": {
    "User": 150,
    "Organization": 3,
    "Shift": 450,
    "Coverage": 1200
  },
  "database_url_hash": "ep-xxx.us-east-1.aws.neon.tech/neondb",
  "backup_type": "full"
}
```

---

## Backup Retention

**Default Policy:** 30 days

**Current Implementation:**
- Backups older than 30 days are identified but NOT automatically deleted
- Manual cleanup required for safety
- Recommended: Configure S3 lifecycle policy

### Setting up S3 Lifecycle Policy

**AWS Console:**
1. Go to S3 Console
2. Select your backup bucket
3. Navigate to "Management" tab
4. Click "Create lifecycle rule"
5. Configure:
   - Name: "Delete old database backups"
   - Prefix: `database-backups/`
   - Expiration: 30 days after creation
   - Apply to all objects

**AWS CLI:**
```bash
cat > lifecycle-policy.json << 'EOF'
{
  "Rules": [
    {
      "Id": "DeleteOldDatabaseBackups",
      "Status": "Enabled",
      "Prefix": "database-backups/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket ripple-vms-backups \
  --lifecycle-configuration file://lifecycle-policy.json
```

---

## Backup Verification

### Automated Verification (Daily)

The cron job runs with the `--verify` flag, which checks:

1. **File Size:** Minimum 10KB (prevents empty backups)
2. **PostgreSQL Markers:** Validates dump format
3. **Critical Tables:** Ensures all core tables are present
   - User
   - Organization
   - Shift
   - Coverage

### Manual Verification

```bash
# Download a backup
aws s3 cp s3://ripple-vms-backups/database-backups/backup-2025-12-27T02-00-00-000Z.sql backup.sql

# Verify it's a valid dump
head -20 backup.sql
# Should see: "PostgreSQL database dump"

# Check table creation statements
grep "CREATE TABLE" backup.sql

# Count data rows
grep "COPY public" backup.sql | wc -l
```

---

## Restoration Testing

### Monthly Restoration Test

**Frequency:** First Monday of each month

**Procedure:**

```bash
# 1. Create a test branch in Neon
# Via Neon Console: https://console.neon.tech/
# - Go to your project
# - Click "Branches"
# - Create new branch: "backup-test-YYYY-MM"

# 2. Download latest backup
BACKUP_DATE=$(date +%Y-%m-%d)
aws s3 cp s3://ripple-vms-backups/database-backups/backup-${BACKUP_DATE}*.sql backup.sql

# 3. Get test branch connection string
# From Neon Console

# 4. Restore to test branch
DATABASE_URL="postgresql://test-branch..." psql < backup.sql

# 5. Verify restoration
DATABASE_URL="postgresql://test-branch..." npx tsx << 'EOF'
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './src/generated/prisma/client';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function verify() {
  const userCount = await prisma.user.count();
  const shiftCount = await prisma.shift.count();
  const orgCount = await prisma.organization.count();

  console.log('Restoration Verification:');
  console.log(`Users: ${userCount}`);
  console.log(`Shifts: ${shiftCount}`);
  console.log(`Organizations: ${orgCount}`);

  if (userCount > 0 && orgCount > 0) {
    console.log('✅ Restoration successful');
  } else {
    console.log('❌ Restoration may have failed - no data found');
  }

  await prisma.$disconnect();
}

verify();
EOF

# 6. Delete test branch
# Via Neon Console

# 7. Document results
# Update docs/Operations/DISASTER_RECOVERY_RUNBOOK.md
# - Last Backup Test date
# - Time to restore
# - Any issues encountered
```

---

## Notifications

### Success Notification

**Recipients:**
- All users with `DEVELOPER` role
- joshcottrell@gmail.com (primary developer)

**Subject:** `✅ Database Backup Successful - 2025-12-27`

**Content:**
```
Database backup completed successfully.

Backup Details:
- Timestamp: 2025-12-27T02:00:00.000Z
- Size: 15.00 MB
- Location: s3://ripple-vms-backups/database-backups/backup-2025-12-27T02-00-00-000Z.sql

Table Counts:
- Users: 150
- Organizations: 3
- Shifts: 450
- Coverage: 1200

Database: ep-xxx.us-east-1.aws.neon.tech/neondb

Retention: 30 days

Next backup: Tomorrow at the same time
```

### Failure Notification

**Subject:** `❌ Database Backup Failed - 2025-12-27`

**Content:**
```
Database backup failed.

Error: Connection timeout

Please investigate immediately and check the logs for details.

You may need to run a manual backup:
  npm run db:backup

See: docs/Operations/DISASTER_RECOVERY_RUNBOOK.md
```

---

## Monitoring

### Checking Backup Status

**Via Vercel Logs:**
```bash
vercel logs --since 24h | grep "\[Backup"
```

**Via S3:**
```bash
# List recent backups
aws s3 ls s3://ripple-vms-backups/database-backups/ --recursive | tail -10

# Check latest backup size
aws s3 ls s3://ripple-vms-backups/database-backups/ --recursive | tail -1

# View metadata for latest backup
LATEST=$(aws s3 ls s3://ripple-vms-backups/database-backups/ | tail -2 | head -1 | awk '{print $4}')
aws s3 cp s3://ripple-vms-backups/database-backups/${LATEST}.metadata.json -
```

### Backup Metrics Dashboard (Future)

Recommended metrics to track:
- Backup success rate (%)
- Backup size over time (MB)
- Backup duration (seconds)
- Time since last successful backup (hours)
- S3 storage costs ($)

---

## Costs

### Estimated AWS Costs

**Assumptions:**
- Database size: 15 MB
- Daily backups
- 30-day retention
- S3 Standard storage

**Monthly Costs:**
- Storage: 15 MB × 30 days = 450 MB = $0.01/month
- PUT requests: 2 per day × 30 days = 60 requests = $0.00/month
- Data transfer: Minimal (backup creation) = $0.00/month

**Total:** ~$0.01-0.05/month

**Cost Optimization:**
- Use S3 Infrequent Access for backups > 7 days old: Save 50%
- Use S3 Glacier for backups > 30 days old (if extending retention): Save 80%

---

## Security

### Access Control

**S3 Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBackupUploads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:user/ripple-vms-backup-user"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ripple-vms-backups/*",
        "arn:aws:s3:::ripple-vms-backups"
      ]
    }
  ]
}
```

### Encryption

**In Transit:**
- ✅ TLS for S3 uploads (AWS SDK default)
- ✅ TLS for database connections (Neon default)

**At Rest:**
- ⬜ **TODO:** Enable S3 bucket encryption (AES-256 or KMS)

**Enable S3 Encryption:**
```bash
aws s3api put-bucket-encryption \
  --bucket ripple-vms-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### Backup Integrity

- Backups are verified before upload
- Metadata includes checksums (future enhancement)
- Monthly restoration tests ensure backups are usable

---

## Troubleshooting

### Backup Fails with "pg_dump: command not found"

**Cause:** PostgreSQL client tools not installed in Vercel environment

**Solution:** Use Neon's built-in pg_dump or dockerize the backup script

**Workaround:**
```bash
# Add pg_dump to package.json dependencies (if available as npm package)
# OR use Neon API for backups
# OR create a separate backup service with Docker
```

### Backup Fails with "Connection timeout"

**Cause:** Database is auto-suspended and not waking up in time

**Solution:** Wake database before backup

**Fix:**
```typescript
// Add to backup script before pg_dump
await prisma.$connect();
await sleep(5000); // Wait 5 seconds for database to fully wake
```

### S3 Upload Fails with "Access Denied"

**Cause:** AWS credentials don't have S3 permissions

**Solution:** Verify IAM permissions

**Required Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ripple-vms-backups/*",
        "arn:aws:s3:::ripple-vms-backups"
      ]
    }
  ]
}
```

### No Notification Emails Received

**Cause:** SES credentials or email service issue

**Check:**
```bash
# Verify SES is configured
vercel env pull .env.local
grep SES .env.local

# Test email service
curl -X POST http://localhost:3000/api/developer/test-email
```

---

## Post-Deployment Checklist

After deploying the backup system:

- [ ] Verify `DATABASE_URL` is set in Vercel
- [ ] Verify AWS credentials are set in Vercel
- [ ] Verify `AWS_S3_BACKUP_BUCKET` is set (or using default)
- [ ] Verify `CRON_SECRET` is set in Vercel production
- [ ] Create S3 bucket if using separate backup bucket
- [ ] Configure S3 lifecycle policy for 30-day retention
- [ ] Enable S3 bucket encryption
- [ ] Run manual test backup: `npm run db:backup:verify`
- [ ] Verify backup appears in S3
- [ ] Verify notification email is received
- [ ] Test cron endpoint: `curl http://localhost:3000/api/cron/database-backup`
- [ ] Update PRE_LAUNCH_CHECKLIST.md backup checkbox
- [ ] Schedule first monthly restoration test

---

## Future Enhancements

### Planned Improvements

1. **Incremental Backups**
   - Currently: Full backup daily (~15 MB)
   - Future: Incremental backups hourly (only changes)
   - Benefit: Better RPO (15 minutes vs 24 hours)

2. **Multi-Region Replication**
   - Currently: Single S3 region
   - Future: Cross-region replication to S3 in different region
   - Benefit: Protection against regional AWS outages

3. **Backup Encryption**
   - Currently: No encryption at rest
   - Future: Client-side encryption before upload
   - Benefit: Enhanced security for sensitive data

4. **Automated Restoration Testing**
   - Currently: Manual monthly testing
   - Future: Automated restoration to test branch
   - Benefit: Continuous verification of backups

5. **Backup Metrics Dashboard**
   - Currently: Email notifications only
   - Future: Web dashboard showing backup history and metrics
   - Benefit: Better visibility and monitoring

6. **Compressed Backups**
   - Currently: Uncompressed SQL files
   - Future: gzip compression
   - Benefit: 70-80% storage reduction

---

## Related Documentation

- [Disaster Recovery Runbook](./DISASTER_RECOVERY_RUNBOOK.md)
- [Database Connection Improvements](./DATABASE_CONNECTION_IMPROVEMENTS.md)
- [Pre-Launch Checklist](../Testing/PRE_LAUNCH_CHECKLIST.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-27 | Claude Code | Initial backup system implementation |
