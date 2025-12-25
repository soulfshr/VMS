# Claude Code Instructions for RippleVMS

## Deployment

**IMPORTANT:** All deployments should go to **dev/preview** by default.
- Use `vercel` (without `--prod`) for standard deployments
- Only deploy to production (`vercel --prod`) when explicitly requested by the user

### Stable Dev URL

After each **preview** deployment (NOT production), update the stable dev alias:

```bash
vercel alias <deployment-url> test.dev.ripple-vms.com
```

This ensures https://test.dev.ripple-vms.com always points to the latest preview deployment.

**Why `test.dev.ripple-vms.com`?**
- Multi-tenant URL pattern: `[org-slug].dev.ripple-vms.com` for dev, `[org-slug].ripple-vms.com` for production
- Using `test` org slug for development testing
- The `.dev.` in the URL triggers dev environment detection in `org-context.ts`

### ⚠️ CRITICAL: Never Mix Environments

**NEVER alias a production deployment to test.dev.ripple-vms.com!**

- Production deployments (`vercel --prod`) use **production DATABASE_URL** with real user data
- Preview deployments (`vercel`) use **preview DATABASE_URL** with test data
- Aliasing a prod deployment to the dev URL would expose production data in the dev environment

**Correct workflow:**
1. For dev: `vercel` → then `vercel alias <url> test.dev.ripple-vms.com`
2. For prod: `vercel --prod` (no alias needed, uses nc.ripple-vms.com automatically)

**Database hosts:**
- Dev/Preview and Production use separate Neon databases (check Vercel env vars)

### Waking Up Neon Databases

Neon databases auto-suspend after inactivity. If `prisma db push` fails with "Can't reach database server", wake the database first by running a quick query:

```bash
# Create a temp wake script
cat > wake-db.ts << 'EOF'
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './src/generated/prisma/client';

const connectionString = 'DATABASE_URL_HERE';
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$connect();
  console.log('Database connected!');
  await prisma.$disconnect();
}
main();
EOF

# Run it, then immediately push
npx tsx wake-db.ts && DATABASE_URL="..." npx prisma db push

# Clean up
rm wake-db.ts
```

## Tech Stack

- Next.js 16 (App Router)
- Prisma ORM with PostgreSQL (Neon)
- TypeScript
- Tailwind CSS
- Resend for email notifications

## Key Patterns

- API routes use `getDbUser()` from `@/lib/user` for authentication
- Prisma client is at `@/lib/db`
- Enums are exported from `@/generated/prisma/enums`
- Role-based access: VOLUNTEER, COORDINATOR, DISPATCHER, ADMINISTRATOR
- Qualifications (shift positions): VERIFIER, ZONE_LEAD, DISPATCHER
