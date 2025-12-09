# Claude Code Instructions for RippleVMS

## Deployment

**IMPORTANT:** All deployments should go to **dev/preview** by default.
- Use `vercel` (without `--prod`) for standard deployments
- Only deploy to production (`vercel --prod`) when explicitly requested by the user

### Stable Dev URL

After each **preview** deployment (NOT production), update the stable dev alias:

```bash
vercel alias <deployment-url> dev-nc.ripple-vms.com
```

This ensures https://dev-nc.ripple-vms.com always points to the latest preview deployment.

### ⚠️ CRITICAL: Never Mix Environments

**NEVER alias a production deployment to dev-nc.ripple-vms.com!**

- Production deployments (`vercel --prod`) use **production DATABASE_URL** with real user data
- Preview deployments (`vercel`) use **preview DATABASE_URL** with test data
- Aliasing a prod deployment to the dev URL would expose production data in the dev environment

**Correct workflow:**
1. For dev: `vercel` → then `vercel alias <url> dev-nc.ripple-vms.com`
2. For prod: `vercel --prod` (no alias needed, uses nc.ripple-vms.com automatically)

**Database hosts:**
- Dev/Preview: `ep-steep-hall-a4jn07l3-pooler`
- Production: `ep-frosty-wave-a4l37b2r-pooler`

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
