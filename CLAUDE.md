# Claude Code Instructions for Siembra NC VMS

## Deployment

**IMPORTANT:** All deployments should go to **dev/preview** by default.
- Use `vercel` (without `--prod`) for standard deployments
- Only deploy to production (`vercel --prod`) when explicitly requested by the user

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
