# Disaster Recovery Runbook

**Last Updated:** 2025-12-27
**Owner:** Development Team
**Review Frequency:** Quarterly

## Overview

This runbook provides step-by-step procedures for recovering the RippleVMS database in the event of data loss, corruption, or complete database failure.

---

## Emergency Contacts

| Role | Contact | When to Contact |
|------|---------|----------------|
| Primary Developer | joshcottrell@gmail.com | All database emergencies |
| Neon Support | support@neon.tech | Database provider issues |
| Vercel Support | vercel.com/support | Deployment/environment issues |
| On-Call Developer | TBD | After-hours emergencies |

---

## Service Level Objectives

| Metric | Target | Definition |
|--------|--------|------------|
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |

**Why these targets?**
- RTO: Emergency volunteer coordination requires same-day restoration
- RPO: Shift RSVPs and updates within the last hour are acceptable to lose in catastrophic scenarios

---

## Disaster Scenarios & Procedures

### Scenario 1: Database Connection Failures

**Symptoms:**
- API routes returning 500 errors
- Health check alerts about database connectivity
- Logs showing connection timeout errors

**Triage Steps:**
1. Check Neon dashboard for database status
2. Verify database is not auto-suspended
3. Check Vercel environment variables are correct

**Recovery Procedure:**

```bash
# 1. Wake up the database (if auto-suspended)
cat > wake-db.ts << 'EOF'
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$connect();
  console.log('Database connected!');
  await prisma.$disconnect();
}
main();
EOF

npx tsx wake-db.ts
rm wake-db.ts

# 2. Verify connection via Prisma Studio
npx prisma studio

# 3. Check recent health checks
# Navigate to: /api/dashboard/health-status
# Or query directly:
# SELECT * FROM "HealthCheck" ORDER BY "timestamp" DESC LIMIT 10;

# 4. Redeploy if needed
vercel --force
```

**Expected Recovery Time:** 15 minutes
**Data Loss:** None

---

### Scenario 2: Accidental Data Deletion

**Symptoms:**
- Reports of missing volunteers, shifts, or other data
- Unusual database query patterns in logs
- User reports of data loss

**Triage Steps:**
1. Identify the scope of deletion (single record, table, or multiple tables)
2. Determine when the deletion occurred
3. Check if deletion was intentional (admin action) or accidental

**Recovery Procedure:**

```bash
# 1. Immediately stop all deployments
# Prevent further damage from bad code

# 2. Access Neon Console
# https://console.neon.tech/

# 3. Use Point-in-Time Recovery (PITR)
# - Navigate to your project
# - Go to "Branches" > "Restore"
# - Select timestamp BEFORE deletion occurred
# - Create a new branch with restored data

# 4. Verify restored data
# Connect to restored branch and verify critical tables:
# - User
# - Shift
# - Coverage
# - Qualification

# 5. Export data from restored branch
pg_dump "RESTORED_BRANCH_CONNECTION_STRING" \
  --data-only \
  --table=User \
  --table=Shift \
  > restored_data.sql

# 6. Restore to production (use with caution)
# Review restored_data.sql before applying
psql "$DATABASE_URL" < restored_data.sql

# 7. Verify restoration
npx prisma studio
```

**Expected Recovery Time:** 1-2 hours
**Data Loss:** Minimal (based on PITR timestamp selection)

---

### Scenario 3: Database Corruption

**Symptoms:**
- Prisma errors about invalid data types
- Foreign key constraint violations
- Index corruption errors
- Unexpected null values in required fields

**Triage Steps:**
1. Identify corrupted tables/records
2. Assess if corruption is localized or widespread
3. Check recent migration history

**Recovery Procedure:**

```bash
# 1. Create a database backup immediately
pg_dump "$DATABASE_URL" > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Analyze corruption scope
npx prisma validate
npx prisma db pull

# 3. For localized corruption - fix specific records
# Access Prisma Studio to manually correct data
npx prisma studio

# 4. For widespread corruption - restore from backup
# Use Neon PITR to restore to before corruption occurred
# See Scenario 2 steps

# 5. If corruption is due to bad migration
# Rollback migration and reapply
npx prisma migrate resolve --rolled-back "MIGRATION_NAME"
npx prisma migrate deploy

# 6. Verify database integrity
npx prisma validate
npm run db:push
```

**Expected Recovery Time:** 2-4 hours
**Data Loss:** Varies based on corruption extent

---

### Scenario 4: Complete Database Loss (Catastrophic)

**Symptoms:**
- Neon project deleted or inaccessible
- Complete data center failure
- Database cannot be accessed by any means

**Triage Steps:**
1. Confirm database is truly inaccessible (not network issue)
2. Contact Neon support immediately
3. Locate most recent backup

**Recovery Procedure:**

```bash
# 1. Contact Neon Support IMMEDIATELY
# Email: support@neon.tech
# Provide: Project ID, timestamp of issue, account details

# 2. While waiting for support, create new Neon database
# Via Neon Console: https://console.neon.tech/

# 3. Restore from most recent backup
# Check for automated backup exports (if configured)
# Location: TBD (see "Automated Backup Verification" section)

# If no external backup exists:
# - Wait for Neon support to restore from their backups
# - Prepare to rebuild from production logs if necessary

# 4. Once new database is available, apply schema
DATABASE_URL="NEW_DATABASE_URL" npx prisma db push

# 5. Restore data from backup
DATABASE_URL="NEW_DATABASE_URL" psql < latest_backup.sql

# 6. Update Vercel environment variables
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
# Paste new connection string

# 7. Redeploy production
vercel --prod

# 8. Verify critical functionality
# - User login
# - Shift loading
# - Coverage grid
# - Health checks
```

**Expected Recovery Time:** 4-8 hours (dependent on Neon support)
**Data Loss:** Up to RPO (1 hour if proper backups configured)

---

### Scenario 5: Failed Schema Migration

**Symptoms:**
- Deployment fails during migration
- Application won't start after migration
- Data type mismatches after migration

**Triage Steps:**
1. Check migration logs in Vercel deployment
2. Identify which migration failed
3. Assess if partial migration was applied

**Recovery Procedure:**

```bash
# 1. Do NOT apply more migrations
# Prevent cascading failures

# 2. Check migration status
npx prisma migrate status

# 3. For failed migration that didn't apply
npx prisma migrate resolve --rolled-back "MIGRATION_NAME"
# Fix migration file
npx prisma migrate deploy

# 4. For partially applied migration
# Create a new database branch in Neon for testing
# Apply migration to test branch first
DATABASE_URL="TEST_BRANCH_URL" npx prisma migrate deploy

# 5. If test succeeds, apply to production
npx prisma migrate deploy

# 6. If migration cannot be fixed, restore previous state
# Use Neon PITR to restore to before migration
# See Scenario 2

# 7. Redeploy with working schema
vercel --prod
```

**Expected Recovery Time:** 1-3 hours
**Data Loss:** None (if caught quickly)

---

## Database Access

### Production Database
- **Provider:** Neon
- **Project:** RippleVMS Production
- **Connection:** Stored in Vercel environment variable `DATABASE_URL`
- **Access:** Via Neon Console or Prisma Studio

### Preview Database
- **Provider:** Neon
- **Project:** RippleVMS Preview
- **Connection:** Stored in Vercel preview environment
- **Access:** Via Neon Console or Prisma Studio

### Getting Connection Strings

```bash
# Production
vercel env pull .env.production
grep DATABASE_URL .env.production

# Preview
vercel env pull .env.preview
grep DATABASE_URL .env.preview
```

---

## Backup Verification

### Manual Backup Creation

```bash
# Create full database backup
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Create schema-only backup
pg_dump "$DATABASE_URL" --schema-only > schema_backup.sql

# Create data-only backup
pg_dump "$DATABASE_URL" --data-only > data_backup.sql
```

### Backup Restoration Testing

**Frequency:** Monthly (first Monday of each month)

```bash
# 1. Create a test branch in Neon
# Via Neon Console or CLI

# 2. Restore backup to test branch
psql "$TEST_BRANCH_URL" < backup_file.sql

# 3. Verify data integrity
DATABASE_URL="$TEST_BRANCH_URL" npx prisma studio

# 4. Run test queries
DATABASE_URL="$TEST_BRANCH_URL" npx tsx << 'EOF'
import { prisma } from './src/lib/db';

async function verify() {
  const userCount = await prisma.user.count();
  const shiftCount = await prisma.shift.count();
  const orgCount = await prisma.organization.count();

  console.log('Verification Results:');
  console.log(`Users: ${userCount}`);
  console.log(`Shifts: ${shiftCount}`);
  console.log(`Organizations: ${orgCount}`);

  // Check data relationships
  const usersWithOrgs = await prisma.user.findMany({
    include: { organizations: true },
    take: 5
  });

  console.log('Sample users:', usersWithOrgs);
}

verify();
EOF

# 5. Document results
# Update this runbook with:
# - Date tested
# - Backup file used
# - Any issues encountered
# - Time to restore
```

### Last Backup Test
- **Date:** [NOT YET TESTED]
- **Backup File:** [TBD]
- **Time to Restore:** [TBD]
- **Issues:** [TBD]
- **Verified By:** [TBD]

---

## Automated Backup System

### Current Status
⬜ **NOT YET IMPLEMENTED**

See [docs/Operations/BACKUP_VERIFICATION_SETUP.md](./BACKUP_VERIFICATION_SETUP.md) for implementation details.

---

## Post-Recovery Checklist

After any recovery procedure, verify:

- [ ] Database is accessible from production application
- [ ] Health checks are passing
- [ ] User authentication works
- [ ] Shift creation and RSVP functionality works
- [ ] Coverage grid displays correctly
- [ ] Email notifications are sending
- [ ] All organizations are accessible
- [ ] Recent data (last 24 hours) is present
- [ ] No foreign key constraint violations
- [ ] Prisma schema matches database schema
- [ ] Connection pool is healthy
- [ ] No error alerts firing

**Test Script:**

```bash
# Run automated verification
npm run test:db-health

# Manual checks via UI
# 1. Login as admin
# 2. View dashboard
# 3. Create a test shift
# 4. RSVP to shift
# 5. Check coverage grid
# 6. Send test email
# 7. View health status
```

---

## Incident Documentation

After any disaster recovery event, document:

1. **Incident Report Template:**
   - Date/time of incident
   - Discovery method (alert, user report, etc.)
   - Root cause
   - Recovery procedure used
   - Actual RTO achieved
   - Actual RPO (data loss)
   - Lessons learned
   - Action items to prevent recurrence

2. **File Location:** `/docs/Operations/incidents/YYYY-MM-DD-incident-name.md`

3. **Update This Runbook:** Incorporate lessons learned

---

## Preventive Measures

To reduce likelihood of disasters:

- ✅ Separate dev/preview and production databases
- ✅ Health check monitoring every 5 minutes
- ✅ Alert system for database failures
- ⬜ Automated daily backup exports (TO BE IMPLEMENTED)
- ⬜ External monitoring system (TO BE IMPLEMENTED)
- ⬜ Database connection retry logic (TO BE IMPLEMENTED)
- ⬜ Row-level security policies (PLANNED)
- ⬜ Query audit logging (PLANNED)

---

## Testing & Drills

### Quarterly DR Drill Schedule

**Q1 (January):** Test Scenario 2 - Accidental Data Deletion
**Q2 (April):** Test Scenario 4 - Complete Database Loss
**Q3 (July):** Test Scenario 5 - Failed Schema Migration
**Q4 (October):** Test Scenario 1 - Connection Failures

### Drill Procedure
1. Schedule 2-hour maintenance window
2. Announce drill to team
3. Execute scenario recovery on preview environment
4. Document time to recover
5. Update runbook with findings
6. Review with team

### Last Drill
- **Date:** [NOT YET CONDUCTED]
- **Scenario:** [TBD]
- **Result:** [TBD]
- **Duration:** [TBD]

---

## Related Documentation

- [Backup Verification Setup](./BACKUP_VERIFICATION_SETUP.md)
- [Database Connection Improvements](./DATABASE_CONNECTION_IMPROVEMENTS.md)
- [Pre-Launch Checklist](../Testing/PRE_LAUNCH_CHECKLIST.md)
- [Technical Architecture](../Technical Architecture.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-27 | Claude Code | Initial runbook creation |

---

## Next Steps

1. ✅ Create this runbook
2. ⬜ Implement automated backup verification
3. ⬜ Conduct first backup restoration test
4. ⬜ Schedule first DR drill
5. ⬜ Set up external monitoring
6. ⬜ Implement connection retry logic
7. ⬜ Review and approve with stakeholders
