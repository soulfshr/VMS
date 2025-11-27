# Technical Architecture

**Document Version:** 1.0
**Date:** November 27, 2025
**Status:** Approved for Implementation
**Purpose:** Define the technical stack and architecture for Siembra NC VMS

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Design](#4-database-design)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Design](#6-api-design)
7. [Deployment & Infrastructure](#7-deployment--infrastructure)
8. [Security Considerations](#8-security-considerations)
9. [Cost Analysis](#9-cost-analysis)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Executive Summary

### 1.1 Selected Technology Stack

Siembra NC VMS will be built using a modern, serverless architecture optimized for developer productivity, cost-effectiveness, and scalability.

**Core Stack:**
- **Frontend:** Next.js 14+ (App Router) with React and TypeScript
- **Backend:** Next.js API Routes (serverless functions)
- **Database:** Neon DB (Serverless Postgres)
- **ORM:** Prisma
- **Hosting:** Vercel
- **Authentication:** Auth.js (Next-Auth) with Email/Password + Google OAuth
- **Email:** Resend
- **SMS:** Postponed to Phase 2

### 1.2 Key Decisions

**✅ Approved:**
- Neon DB for serverless Postgres (scalable, cost-effective)
- Vercel for hosting (already in use, excellent Next.js integration)
- Auth.js for authentication (free, flexible, well-supported)
- Resend for email delivery (free tier sufficient, better deliverability)
- Email/Password + Google OAuth for user authentication

**❌ Postponed:**
- SMS notifications (Twilio) - will add in Phase 2 if needed
- Reduces initial complexity and cost
- Email + Signal combination sufficient for MVP

### 1.3 Design Principles

1. **Simplicity First** - Start with proven, simple solutions
2. **Cost-Effective** - Optimize for low initial costs with room to scale
3. **Developer Experience** - Modern tools with excellent DX
4. **Security & Privacy** - Protect sensitive volunteer and incident data
5. **Scalability** - Support growth from 100 to 1000+ volunteers
6. **Open Standards** - Avoid vendor lock-in where possible

---

## 2. Technology Stack

### 2.1 Frontend Stack

#### Next.js 14+ (App Router)
**Purpose:** React framework for server-side rendering and routing

**Why Next.js:**
- ✅ Server-side rendering (SSR) for better performance
- ✅ App Router for modern routing patterns
- ✅ Built-in API routes (no separate backend needed)
- ✅ Excellent TypeScript support
- ✅ Image optimization, code splitting (automatic)
- ✅ Vercel optimized (same team builds both)

**Alternatives Considered:**
- Create React App (❌ outdated, no SSR)
- Remix (✅ good, but smaller ecosystem)
- SvelteKit (✅ good, but team unfamiliar)

**Version:** Next.js 14.2+ (stable App Router)

#### React 18+
**Purpose:** UI component library

**Why React:**
- ✅ Most popular, largest ecosystem
- ✅ Easy to hire developers
- ✅ Rich component libraries available
- ✅ Server components (new React 18 feature)

#### TypeScript
**Purpose:** Type safety and better DX

**Why TypeScript:**
- ✅ Catch errors at compile time
- ✅ Better IDE autocomplete
- ✅ Self-documenting code
- ✅ Industry standard for new projects
- ✅ Prisma generates types automatically

#### Tailwind CSS
**Purpose:** Utility-first CSS framework

**Why Tailwind:**
- ✅ Rapid prototyping
- ✅ Consistent design system
- ✅ Small bundle size (purges unused CSS)
- ✅ No CSS naming conflicts
- ✅ Works great with React components

**Alternatives:**
- CSS Modules (✅ good, more verbose)
- Styled Components (✅ good, runtime cost)
- Plain CSS (❌ harder to maintain)

### 2.2 Backend Stack

#### Next.js API Routes
**Purpose:** Serverless API endpoints

**Why API Routes:**
- ✅ No separate backend needed
- ✅ Same TypeScript codebase
- ✅ Automatic deployment with Vercel
- ✅ Serverless (auto-scaling)
- ✅ Edge functions available

**Architecture:**
```
app/
  api/
    auth/          # Auth.js routes
    volunteers/    # Volunteer CRUD
    shifts/        # Shift management
    incidents/     # Incident tracking
    zones/         # Zone management
```

#### Prisma ORM
**Purpose:** Database access and migrations

**Why Prisma:**
- ✅ Best TypeScript ORM
- ✅ Type-safe database queries
- ✅ Automatic type generation
- ✅ Migration system built-in
- ✅ Prisma Studio (database GUI)
- ✅ Excellent documentation

**Alternatives:**
- Drizzle (✅ newer, lighter, less mature)
- TypeORM (❌ less type-safe)
- Kysely (✅ SQL-first, steeper learning curve)

**Example Schema Preview:**
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  role          Role
  zones         UserZone[]
  createdAt     DateTime @default(now())
}

model Zone {
  id            String   @id
  name          String
  signalLink    String?
  volunteers    UserZone[]
}
```

### 2.3 Database

#### Neon DB (Serverless Postgres)
**Purpose:** Production database

**Why Neon:**
- ✅ Serverless Postgres (scales automatically)
- ✅ Generous free tier (0.5 GB, sufficient for MVP)
- ✅ Native Vercel integration
- ✅ Database branching (test environments)
- ✅ Built-in connection pooling (PgBouncer)
- ✅ Automatic backups
- ✅ Standard Postgres (easy to migrate if needed)

**Alternatives Considered:**
- Supabase (✅ good, more opinionated, includes auth)
- PlanetScale (✅ good, MySQL not Postgres)
- Railway (✅ good, less mature)
- Self-hosted Postgres (❌ maintenance burden)

**Connection:**
```typescript
DATABASE_URL="postgresql://user:pass@neon.tech/dbname"
DIRECT_URL="postgresql://user:pass@neon.tech/dbname" // For migrations
```

**Scale Projection:**
- 100 volunteers: ~50 MB database
- 1,000 volunteers: ~500 MB database
- 10,000 incidents/year: ~200 MB additional

### 2.4 Authentication

#### Auth.js (Next-Auth)
**Purpose:** Authentication and session management

**Why Auth.js:**
- ✅ Free and open-source
- ✅ Built specifically for Next.js
- ✅ Email provider + OAuth built-in
- ✅ JWT or database sessions
- ✅ Role-based access control (via callbacks)
- ✅ Active development, strong community

**Alternatives:**
- Clerk (✅ beautiful UI, expensive after 10k users)
- Supabase Auth (✅ good if using Supabase)
- Custom (❌ security risks, time-consuming)

**Providers:**
1. **Email/Password** (with verification)
   - Email verification required before activation
   - Password requirements: min 12 chars, complexity rules
   - Secure password reset flow
   - Rate limiting on login attempts

2. **Google OAuth**
   - One-click sign-in
   - Trusted, secure
   - Reduces support burden (no forgotten passwords)

**Future Providers (Phase 2):**
- Magic links (passwordless email)
- Apple Sign-In (if mobile app)
- Microsoft OAuth (if corporate volunteers)

**Session Management:**
- JWT tokens (stateless, fast)
- 30-day expiration
- Refresh token rotation
- Secure httpOnly cookies

### 2.5 Email Service

#### Resend
**Purpose:** Transactional email delivery

**Why Resend:**
- ✅ Free tier: 3,000 emails/month (sufficient for 100 volunteers)
- ✅ Modern, developer-friendly API
- ✅ React Email template support
- ✅ Next.js/Vercel ecosystem
- ✅ Excellent deliverability
- ✅ Custom domain support
- ✅ Delivery analytics and webhooks

**Alternatives:**
- Gmail App Password (❌ unprofessional, limited, spam risk)
- SendGrid (✅ proven, slightly more complex)
- Postmark (✅ excellent deliverability, more expensive)
- AWS SES (✅ cheapest at scale, requires AWS)

**Email Volume Estimate:**
```
100 volunteers:
- Shift reminders: 400/month (2 per volunteer per week)
- Incident notifications: 200/month
- Welcome/verification: 20/month
- Password resets: 50/month
Total: ~700/month (within free tier)
```

**Email Types:**
1. Account emails (welcome, verification, password reset)
2. Shift notifications (invitations, reminders, confirmations)
3. Incident assignments (urgent, with Signal link)
4. Training reminders
5. Administrative announcements

### 2.6 SMS Service

#### Decision: Postponed to Phase 2

**Rationale:**
- Email + Signal provides sufficient notification coverage
- Reduces initial complexity and cost (~$10/month saved)
- Can add later when needed (minimal code changes)
- Focus on core functionality first

**When to Reconsider:**
- User feedback indicates SMS needed
- Email open rates insufficient
- Urgent incident response requires faster notification
- Budget allows for additional service

**Implementation Note:**
When adding SMS (Phase 2), recommended service:
- **Twilio** (~$10/month for 1,000 messages)
- Well-documented, reliable
- Easy integration with Next.js
- Industry standard

### 2.7 Additional Services

#### File Storage
**Service:** Vercel Blob Storage (or Cloudflare R2)

**Purpose:**
- Incident photos
- Training documents
- User avatars (future)

**Why Vercel Blob:**
- ✅ Native Vercel integration
- ✅ Simple API
- ✅ Generous free tier
- ✅ CDN included

**Alternative:** Cloudflare R2 (cheaper at scale)

#### Monitoring & Error Tracking
**Service:** Sentry (free tier)

**Purpose:**
- Error tracking
- Performance monitoring
- User session replay (opt-in)

**Why Sentry:**
- ✅ Free tier sufficient for MVP
- ✅ Excellent Next.js integration
- ✅ Real-time error alerts
- ✅ Source map support

---

## 3. Architecture Overview

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USERS                                 │
│  Volunteers | Coordinators | Dispatchers | Admins       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│                 VERCEL EDGE NETWORK                      │
│  CDN | SSL | DDoS Protection | Geographic Distribution  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS APPLICATION (Vercel)                │
│  ┌────────────────┐  ┌────────────────┐                │
│  │   Frontend     │  │   API Routes   │                │
│  │  (React SSR)   │  │  (Serverless)  │                │
│  │                │  │                │                │
│  │  - Dashboards  │  │  - Auth        │                │
│  │  - Forms       │  │  - Volunteers  │                │
│  │  - Tables      │  │  - Shifts      │                │
│  │  - Mobile UI   │  │  - Incidents   │                │
│  └────────────────┘  └────────────────┘                │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Neon DB    │ │ Auth.js  │ │   Resend     │
│  (Postgres)  │ │ (Auth)   │ │   (Email)    │
│              │ │          │ │              │
│  - Users     │ │ - JWT    │ │ - SMTP       │
│  - Shifts    │ │ - OAuth  │ │ - Templates  │
│  - Incidents │ │ - 2FA    │ │ - Analytics  │
│  - Zones     │ └──────────┘ └──────────────┘
└──────────────┘
        │
        ↓
┌──────────────┐
│  Backups     │
│  (Automated) │
└──────────────┘
```

### 3.2 Request Flow

**Example: Volunteer Views Shift**
```
1. User requests /shifts/123
2. Vercel Edge Network routes to nearest region
3. Next.js SSR renders page:
   - Checks authentication (Auth.js)
   - Queries database via Prisma
   - Renders React components
4. HTML sent to user (fast, SEO-friendly)
5. React hydrates (interactive)
```

**Example: Dispatcher Assigns Team**
```
1. Dispatcher submits form
2. POST /api/incidents/123/assign
3. API Route:
   - Validates auth & permissions
   - Updates incident in database
   - Sends email via Resend to team
   - Returns success
4. UI updates optimistically
```

### 3.3 Data Flow

**Incident Reporting Flow:**
```
Volunteer observes → VMS Intake Form → API Route
                                        ↓
                                   Prisma ORM
                                        ↓
                                   Neon Database
                                        ↓
                              Dispatcher Dashboard
                                        ↓
                              Team Assignment
                                        ↓
                              Email via Resend
                                        ↓
                              Field Team Notified
```

---

## 4. Database Design

### 4.1 Core Entities

**Schema Overview (Prisma):**

```prisma
// User accounts (all roles)
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  emailVerified     DateTime?
  name              String
  phone             String?
  password          String?   // hashed, null if OAuth only
  role              Role
  status            UserStatus @default(PENDING)
  zones             UserZone[]
  createdShifts     Shift[]   @relation("CreatedBy")
  assignedShifts    ShiftVolunteer[]
  incidents         Incident[] @relation("Reporter")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

enum Role {
  VOLUNTEER
  COORDINATOR
  DISPATCHER
  ADMIN
}

enum UserStatus {
  PENDING      // Awaiting approval
  ACTIVE       // Can participate
  INACTIVE     // Temporarily disabled
  SUSPENDED    // Account suspended
}

// Zones (geographic areas)
model Zone {
  id            String   @id
  name          String
  description   String?
  signalLink    String?  // Signal group invite URL
  active        Boolean  @default(true)
  volunteers    UserZone[]
  shifts        Shift[]
  incidents     Incident[]
  createdAt     DateTime @default(now())
}

// Many-to-many: Users ↔ Zones
model UserZone {
  id            String   @id @default(cuid())
  userId        String
  zoneId        String
  isPrimary     Boolean  @default(false)
  user          User     @relation(fields: [userId], references: [id])
  zone          Zone     @relation(fields: [zoneId], references: [id])
  assignedAt    DateTime @default(now())

  @@unique([userId, zoneId])
}

// Shifts
model Shift {
  id            String   @id @default(cuid())
  name          String
  description   String?
  date          DateTime
  startTime     DateTime
  endTime       DateTime
  zoneId        String
  zone          Zone     @relation(fields: [zoneId], references: [id])
  requiredRole  Role     @default(VOLUNTEER)
  minVolunteers Int      @default(2)
  idealVolunteers Int    @default(4)
  maxVolunteers Int      @default(6)
  status        ShiftStatus @default(OPEN)
  createdById   String
  createdBy     User     @relation("CreatedBy", fields: [createdById], references: [id])
  volunteers    ShiftVolunteer[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum ShiftStatus {
  OPEN
  FULLY_STAFFED
  UNDERSTAFFED
  CANCELLED
  COMPLETED
}

// Many-to-many: Shifts ↔ Volunteers
model ShiftVolunteer {
  id            String   @id @default(cuid())
  shiftId       String
  volunteerId   String
  shift         Shift    @relation(fields: [shiftId], references: [id])
  volunteer     User     @relation(fields: [volunteerId], references: [id])
  status        RSVPStatus @default(PENDING)
  respondedAt   DateTime?
  checkedIn     Boolean  @default(false)
  checkedOut    Boolean  @default(false)

  @@unique([shiftId, volunteerId])
}

enum RSVPStatus {
  PENDING
  CONFIRMED
  DECLINED
  WAITLIST
}

// Incidents
model Incident {
  id            String   @id @default(cuid())
  incidentNumber String  @unique // e.g., "2025-1122-001"
  type          IncidentType
  priority      Priority @default(MEDIUM)
  status        IncidentStatus @default(PENDING)
  reportedAt    DateTime @default(now())
  occurredAt    DateTime
  location      String
  latitude      Float?
  longitude     Float?
  zoneId        String
  zone          Zone     @relation(fields: [zoneId], references: [id])
  description   String
  reporterId    String
  reporter      User     @relation("Reporter", fields: [reporterId], references: [id])
  assignedTeam  IncidentTeam[]
  disposition   Disposition?
  verifiedAt    DateTime?
  publishedToOjo Boolean @default(false)
  publishedAt   DateTime?
  notes         IncidentNote[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum IncidentType {
  LAW_ENFORCEMENT
  VEHICLE_SIGHTING
  SAFETY_CONCERN
  OTHER
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum IncidentStatus {
  PENDING       // Awaiting dispatch
  ASSIGNED      // Team assigned
  EN_ROUTE      // Team traveling
  ON_SCENE      // Team at location
  VERIFIED      // Confirmed
  FALSE_ALARM   // Not verified
  RESOLVED      // Complete
}

enum Disposition {
  VERIFIED
  FALSE_ALARM
  INCONCLUSIVE
  REQUIRES_FOLLOWUP
}

// Many-to-many: Incidents ↔ Team Members
model IncidentTeam {
  id            String   @id @default(cuid())
  incidentId    String
  memberId      String
  incident      Incident @relation(fields: [incidentId], references: [id])
  member        User     @relation(fields: [memberId], references: [id])
  assignedAt    DateTime @default(now())

  @@unique([incidentId, memberId])
}

// Incident notes (dispatcher/admin only)
model IncidentNote {
  id            String   @id @default(cuid())
  incidentId    String
  incident      Incident @relation(fields: [incidentId], references: [id])
  authorId      String
  author        User     @relation(fields: [authorId], references: [id])
  content       String
  createdAt     DateTime @default(now())
}
```

### 4.2 Indexes

**Performance-critical indexes:**
```prisma
@@index([email])           // User lookup
@@index([zoneId])          // Zone filtering
@@index([status])          // Status filtering
@@index([date, zoneId])    // Shift queries
@@index([priority, status])// Incident dashboard
@@index([reportedAt])      // Timeline queries
```

---

## 5. Authentication & Authorization

### 5.1 Authentication Flow

**Email/Password Registration:**
```
1. User submits registration form
2. Server validates email uniqueness
3. Password hashed (bcrypt, 12 rounds)
4. Verification email sent (Resend)
5. User clicks verification link
6. Email marked as verified
7. Account status set to PENDING
8. Coordinator approves → status = ACTIVE
```

**Google OAuth Flow:**
```
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth
3. User authorizes
4. Google returns profile + verified email
5. Server creates/updates user
6. User automatically verified (Google verified)
7. Account status = PENDING (awaits approval)
```

### 5.2 Authorization (RBAC)

**Permission Middleware:**
```typescript
// middleware/auth.ts
export function requireRole(allowedRoles: Role[]) {
  return async (req, res, next) => {
    const session = await getSession(req);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

// Usage in API route
export async function POST(req: Request) {
  const session = await getServerSession();
  requireRole([Role.COORDINATOR, Role.ADMIN])(session);

  // Create shift logic...
}
```

**Zone-Based Permissions (Future):**
```typescript
// Check if user can access this zone
function canAccessZone(user: User, zoneId: string) {
  if (user.role === Role.ADMIN) return true;
  return user.zones.some(z => z.zoneId === zoneId);
}
```

---

## 6. API Design

### 6.1 RESTful Endpoints

**Volunteers:**
```
GET    /api/volunteers           # List (coordinator/admin)
GET    /api/volunteers/:id       # Get one
POST   /api/volunteers           # Register
PATCH  /api/volunteers/:id       # Update
DELETE /api/volunteers/:id       # Delete (admin only)
```

**Shifts:**
```
GET    /api/shifts               # List shifts
GET    /api/shifts/:id           # Get details
POST   /api/shifts               # Create (coordinator)
PATCH  /api/shifts/:id           # Update
DELETE /api/shifts/:id           # Cancel
POST   /api/shifts/:id/rsvp      # RSVP to shift
```

**Incidents:**
```
GET    /api/incidents            # List (role-based filter)
GET    /api/incidents/:id        # Get details
POST   /api/incidents            # Create report
PATCH  /api/incidents/:id        # Update status
POST   /api/incidents/:id/assign # Assign team
POST   /api/incidents/:id/verify # Field verification
POST   /api/incidents/:id/publish# Publish to Ojo
```

**Zones:**
```
GET    /api/zones                # List zones
GET    /api/zones/:id            # Get zone details
POST   /api/zones                # Create (admin)
PATCH  /api/zones/:id            # Update
```

### 6.2 API Response Format

**Standard Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-11-27T10:00:00Z"
  }
}
```

**Standard Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "field": "email"
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 7. Deployment & Infrastructure

### 7.1 Vercel Deployment

**Branch Strategy:**
- `main` → Production (vms.siembra.org)
- `develop` → Staging (vms-staging.vercel.app)
- Feature branches → Preview URLs

**Environment Variables:**
```bash
# Database
DATABASE_URL=
DIRECT_URL=

# Auth
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
RESEND_API_KEY=

# Optional
SENTRY_DSN=
VERCEL_ENV=
```

**Build Configuration (vercel.json):**
```json
{
  "buildCommand": "prisma generate && next build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### 7.2 Database Management

**Neon Setup:**
1. Create Neon project
2. Create production database
3. Create staging branch (copy of production)
4. Configure connection URLs

**Migrations:**
```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

**Seeding (Development):**
```bash
npx prisma db seed
```

### 7.3 CI/CD Pipeline

**Automatic Deployment:**
```
Push to GitHub → Vercel detects → Build → Deploy

1. Install dependencies
2. Run Prisma generate
3. Build Next.js
4. Deploy to edge network
5. Notify in Slack (optional)
```

**Pre-deployment Checks:**
- TypeScript compilation
- Linting (ESLint)
- Unit tests (if configured)
- Build success

---

## 8. Security Considerations

### 8.1 Data Protection

**Encryption:**
- TLS 1.3 for all connections
- Database encryption at rest (Neon default)
- Password hashing (bcrypt, 12 rounds)
- JWT signing (HS256 or RS256)

**PII Handling:**
- Minimize collection
- Encrypted storage
- Limited access (RBAC)
- Audit logging for access

### 8.2 Input Validation

**All user input validated:**
- Zod schemas for API validation
- React Hook Form for client-side validation
- Server-side validation (always)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (React escapes by default)

**Example:**
```typescript
import { z } from 'zod';

const CreateShiftSchema = z.object({
  name: z.string().min(3).max(100),
  date: z.date(),
  zoneId: z.string().uuid(),
  minVolunteers: z.number().int().min(1).max(20),
});
```

### 8.3 Rate Limiting

**API Rate Limits:**
- Login: 5 attempts per 15 minutes
- Registration: 3 per hour per IP
- API calls: 100 per minute per user
- Email sending: Respects Resend limits

**Implementation:**
- Vercel Edge Middleware
- Upstash Redis (for rate limit tracking)

### 8.4 OWASP Top 10 Mitigation

| Vulnerability | Mitigation |
|---------------|------------|
| Injection | Prisma (parameterized), input validation |
| Broken Auth | Auth.js, secure sessions, password rules |
| Sensitive Data | Encryption, RBAC, minimal collection |
| XXE | N/A (no XML parsing) |
| Broken Access | RBAC, server-side checks |
| Security Config | Secure defaults, env vars |
| XSS | React escaping, CSP headers |
| Insecure Deserialization | JSON only, validation |
| Vulnerable Components | Automated updates, audits |
| Logging & Monitoring | Sentry, Vercel logs |

---

## 9. Cost Analysis

### 9.1 Monthly Costs (100 Volunteers)

```
Production Environment:
┌────────────────────┬──────────┬─────────┐
│ Service            │ Tier     │ Cost    │
├────────────────────┼──────────┼─────────┤
│ Neon DB            │ Free/Pro │ $0-20   │
│ Vercel             │ Pro      │ $20     │
│ Resend             │ Free     │ $0      │
│ Auth.js            │ OSS      │ $0      │
│ Prisma             │ OSS      │ $0      │
│ Sentry (optional)  │ Free     │ $0      │
├────────────────────┼──────────┼─────────┤
│ TOTAL              │          │ $20-40  │
└────────────────────┴──────────┴─────────┘

Development Environment:
- Neon (branch): $0 (included)
- Vercel (preview): $0 (included)
- Total: $0
```

### 9.2 Scaling Costs (1,000 Volunteers)

```
┌────────────────────┬──────────┬─────────┐
│ Service            │ Tier     │ Cost    │
├────────────────────┼──────────┼─────────┤
│ Neon DB            │ Pro      │ $40     │
│ Vercel             │ Pro      │ $20     │
│ Resend             │ Paid     │ $20     │
│ Vercel Blob        │ Paid     │ $10     │
├────────────────────┼──────────┼─────────┤
│ TOTAL              │          │ $90     │
└────────────────────┴──────────┴─────────┘

Note: Still significantly cheaper than
self-hosting + ops engineer time
```

### 9.3 ROI Analysis

**Traditional Approach (Self-hosted):**
```
Server: $50/month
Database: $30/month
SSL certificate: $10/month
Maintenance: 10 hrs/month × $50/hr = $500/month
Total: $590/month
```

**Serverless Approach (Proposed):**
```
Services: $40/month
Maintenance: 1 hr/month × $50/hr = $50/month
Total: $90/month

SAVINGS: $500/month = $6,000/year
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Basic infrastructure and authentication

**Tasks:**
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Neon database
- [ ] Configure Prisma schema
- [ ] Implement Auth.js with email/password
- [ ] Add Google OAuth
- [ ] Deploy to Vercel
- [ ] Set up staging environment

**Deliverables:**
- Working authentication
- Database connected
- Deployed to production

### Phase 2: Volunteer Management (Weeks 3-4)

**Goal:** Volunteer registration and management

**Tasks:**
- [ ] Volunteer registration flow
- [ ] Email verification (Resend)
- [ ] Volunteer profiles
- [ ] Volunteer directory (coordinator view)
- [ ] Zone assignment
- [ ] Training tracking

**Deliverables:**
- Volunteers can register
- Coordinators can manage volunteers
- Zone-based organization

### Phase 3: Shift Coordination (Weeks 5-6)

**Goal:** Shift creation and RSVP system

**Tasks:**
- [ ] Create shift form (coordinator)
- [ ] Shift invitation system
- [ ] RSVP functionality
- [ ] Shift roster management
- [ ] Email reminders (Resend)
- [ ] Shift calendar view

**Deliverables:**
- Full shift lifecycle
- Automated notifications

### Phase 4: Incident Management (Weeks 7-8)

**Goal:** Incident tracking and dispatch

**Tasks:**
- [ ] Incident intake form
- [ ] Dispatcher dashboard
- [ ] Team assignment
- [ ] Field verification (mobile)
- [ ] Status tracking
- [ ] Incident archive

**Deliverables:**
- Complete incident workflow
- Mobile-optimized field view

### Phase 5: Ojo Integration (Weeks 9-10)

**Goal:** Community alert publication

**Tasks:**
- [ ] Ojo publication interface
- [ ] Alert formatting
- [ ] Multi-language support
- [ ] Publication approval workflow
- [ ] Alert history

**Deliverables:**
- Verified incidents published to Ojo
- Community alerts distributed

### Phase 6: Polish & Launch (Weeks 11-12)

**Goal:** Production readiness

**Tasks:**
- [ ] User testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation
- [ ] Training materials
- [ ] Production deployment
- [ ] Monitoring setup

**Deliverables:**
- Production-ready application
- User documentation
- Launch!

---

## Appendix A: Technology Alternatives

**If primary choices don't work:**

| Component | Primary | Alternative 1 | Alternative 2 |
|-----------|---------|---------------|---------------|
| Database | Neon | Supabase | Railway |
| ORM | Prisma | Drizzle | Kysely |
| Auth | Auth.js | Clerk | Supabase Auth |
| Email | Resend | SendGrid | Postmark |
| Hosting | Vercel | Railway | Render |

---

## Appendix B: Local Development Setup

**Prerequisites:**
```bash
Node.js 18+
pnpm (or npm/yarn)
Git
```

**Setup Steps:**
```bash
# 1. Clone repository
git clone https://github.com/soulfshr/VMS.git
cd VMS

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Set up database
npx prisma migrate dev
npx prisma db seed

# 5. Run development server
pnpm dev

# Open http://localhost:3000
```

---

## Appendix C: Migration Path

**If we need to migrate away from services:**

**Neon → Another Postgres:**
- Export via `pg_dump`
- Import to new Postgres
- Update connection string
- Zero code changes (standard Postgres)

**Vercel → Another Host:**
- Next.js can deploy anywhere
- Railway, Render, AWS, etc.
- Minimal configuration changes

**Auth.js → Another Auth:**
- Session data is portable
- User table remains the same
- Swap auth library, update endpoints

---

**Document Version:** 1.0
**Last Updated:** November 27, 2025
**Status:** Approved for Implementation
**Next Review:** After Phase 1 completion
