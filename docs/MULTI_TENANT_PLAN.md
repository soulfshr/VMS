# Multi-Tenant Architecture Plan

> **Status:** Planning (not yet implemented)
> **Created:** 2025-12-03
> **Updated:** 2025-12-23
> **Purpose:** Make VMS portable to other organizations (e.g., New Orleans)
> **Platform Domain:** `ripple-vms.com`

## Overview

Transform Siembra NC VMS into **Ripple VMS**, a multi-tenant platform where each organization gets their own subdomain with admin-configurable settings.

**URL Structure:** `<organization>.ripple-vms.com`
- `org-slug.ripple-vms.com` → Organization instance
- `app.ripple-vms.com` → Platform landing/marketing page

---

## Current State (December 2025)

Before implementing multi-tenancy, note what already exists:

### OrganizationSettings (Already Implemented as Singleton)
```prisma
model OrganizationSettings {
  // Branding (already exists)
  orgName          String   @default("RippleVMS")
  emailFromName    String   @default("RippleVMS")
  emailFromAddress String   @default("")
  emailReplyTo     String   @default("")
  emailFooter      String   @default("RippleVMS Team")

  // Feature toggles (already exists)
  featureTrainings  Boolean?
  featureSightings  Boolean?

  // Scheduling (already exists)
  schedulingMode    String  @default("SIMPLE")  // SIMPLE or FULL
  dispatcherSchedulingMode String @default("ZONE")

  // Email digest (already exists)
  weeklyDigestEnabled  Boolean @default(false)
  weeklyDigestSendHour Int     @default(18)

  // Other existing fields...
  autoConfirmRsvp, timezone, maxUploadSizeMb, maxUploadsPerReport
}
```

### What Needs to be Added to OrganizationSettings
```prisma
model OrganizationSettings {
  // NEW: Link to organization (convert from singleton)
  organizationId      String   @unique
  organization        Organization @relation(...)

  // NEW: Branding (not yet in schema)
  logoUrl             String?
  primaryColor        String?  @default("#0d9488")
  secondaryColor      String?

  // NEW: Contact info (currently hardcoded in UI)
  hotlineNumber       String?   // Currently: 336-543-0353
  supportEmail        String?   // Currently hardcoded

  // NEW: Maps integration
  mapEmbedUrl         String?   // Google My Maps embed URL
}
```

### QualifiedRole System (Replaces Qualification Enum)
The codebase now uses a fully dynamic `QualifiedRole` system instead of the `Qualification` enum. This needs to be org-scoped:
```prisma
model QualifiedRole {
  // NEW: Add org scope
  organizationId  String
  organization    Organization @relation(...)

  // Existing fields
  name, slug, description, color, isActive, sortOrder...
}
```

---

## Core Architecture Changes

### New Data Model

```
Organization (new root entity)
├── OrganizationMember (joins Users to Orgs with per-org roles)
├── OrganizationSettings (expanded from current singleton)
├── Zones
├── Shifts / CoverageSignups
├── Trainings / TrainingModules (Training Center)
├── ICE Sightings
├── QualifiedRoles (admin-configurable positions)
├── IntakeQuestions (signup form questions)
└── ... all operational data
```

**Key Design Decision:** Users remain global (one account, one email), but their **role and qualifications become per-organization** via `OrganizationMember`. This allows someone to be an Administrator in Siembra NC but just a Volunteer in New Orleans.

### New Prisma Models

```prisma
model Organization {
  id              String   @id @default(cuid())
  name            String                        // Display name: "Siembra NC"
  slug            String   @unique              // Subdomain: "org-slug" → org-slug.ripple-vms.com

  // Contact info
  email           String?
  phone           String?  // Hotline number
  address         String?

  // Status
  isActive        Boolean  @default(true)

  // Relationships
  members             OrganizationMember[]
  settings            OrganizationSettings?
  zones               Zone[]
  shifts              Shift[]
  trainings           Training[]
  trainingTypes       TrainingType[]
  trainingModules     TrainingModule[]      // Training Center
  shiftTypes          ShiftTypeConfig[]
  sightings           IceSighting[]
  qualifiedRoles      QualifiedRole[]       // Admin-configurable positions
  intakeQuestions     IntakeQuestion[]      // Signup form questions
  coverageConfigs     CoverageConfig[]      // Coverage grid
  poiCategories       POICategory[]         // Points of interest

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Slug validation: lowercase alphanumeric + hyphens, 2-30 chars
// Reserved slugs: app, www, api, admin, support, help, mail, email, dev

model OrganizationMember {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Per-org role (moved from User.role)
  role            Role         @default(VOLUNTEER)

  // Per-org qualifications (via UserQualification)
  userQualifications UserQualification[]

  // Per-org settings
  primaryZoneId   String?
  primaryZone     Zone?        @relation("PrimaryZone", fields: [primaryZoneId], references: [id])
  notes           String?      // Internal notes about this member

  // Account status for this org
  accountStatus   AccountStatus @default(APPROVED)
  intakeResponses Json?        // Signup form responses

  joinedAt        DateTime     @default(now())

  @@unique([userId, organizationId])
  @@index([organizationId])
}
```

---

## Models Requiring organizationId

### Must Add organizationId Directly

| Model | Notes |
|-------|-------|
| **Core Operations** | |
| Zone | Geographic areas per org |
| Shift | Shifts per org (legacy system) |
| ShiftTypeConfig | Shift types per org |
| DispatcherAssignment | Dispatcher scheduling per org |
| RegionalLeadAssignment | Regional lead scheduling per org |
| **Coverage Grid (New)** | |
| CoverageConfig | Weekly slot configuration per zone |
| CoverageSignup | Volunteer slot signups |
| CoverageOverride | Date-specific exceptions |
| **Training System** | |
| Training | Training definitions per org |
| TrainingType | Training types per org |
| TrainingSession | Scheduled sessions per org |
| **Training Center (LMS)** | |
| TrainingModule | Interactive training modules |
| ModuleSection | Sections within modules |
| ModuleQuiz | Quiz configurations |
| QuizQuestion | Quiz questions |
| QuizOption | Quiz answer options |
| **Qualifications** | |
| QualifiedRole | Admin-configurable positions |
| **Sightings** | |
| IceSighting | Sightings reported to org |
| **POI System** | |
| POICategory | Point of interest categories |
| PointOfInterest | Points of interest |
| **Signup & Config** | |
| IntakeQuestion | Signup form questions |
| Availability | User availability per org |
| UserZone | Zone membership per user-org |
| UserTraining | Training records per user-org |

### Scoped Through Parent (No Direct organizationId)

| Model | Scoped Via |
|-------|-----------|
| ShiftVolunteer | Shift.organizationId |
| TrainingSessionAttendee | TrainingSession.organizationId |
| SightingMedia | IceSighting.organizationId |
| ShiftTypeQualifiedRoleRequirement | ShiftTypeConfig.organizationId |
| ModuleEnrollment | TrainingModule.organizationId |
| SectionProgress | ModuleEnrollment → TrainingModule.organizationId |
| QuizAttempt | ModuleQuiz → ModuleSection → TrainingModule.organizationId |
| UserQualification | QualifiedRole.organizationId (or OrganizationMember) |
| EmailBlastRecipient | EmailBlast.organizationId |

### Global (No organizationId)

| Model | Reason |
|-------|--------|
| User | Users can belong to multiple orgs |
| SystemLog | Platform-wide monitoring (org context in metadata) |
| AuditLog | Platform-wide audit trail (org context in metadata) |
| HealthCheck | Platform health monitoring |
| AlertState | Platform alert management |

---

## Hardcoded Content to Make Configurable

| Currently Hardcoded | Location | Count | New Source |
|---------------------|----------|-------|------------|
| "Siembra NC" / organization name | 35+ files | Many | `organization.name` |
| 336-543-0353 (hotline) | report/page.tsx, resources/page.tsx | ~3 | `settings.hotlineNumber` |
| support email | HelpDrawer.tsx | ~1 | `settings.supportEmail` |
| America/New_York | email.ts, schema.prisma | ~5 | `settings.timezone` |
| Google Maps embed ID | about/page.tsx | ~2 | `settings.mapEmbedUrl` |
| Logo images | Header, Footer, emails | ~5 | `settings.logoUrl` |
| Teal color (#0d9488) | tailwind.config.ts, components | Many | `settings.primaryColor` |
| Signal group links | seed.ts, zone admin | Per-zone | Zone.signalGroup (already exists) |
| Coverage time slots (6-8, 8-10, etc.) | CoverageGrid components | ~3 | Consider making configurable |

---

## URL Structure (Subdomain-based)

Each organization gets a subdomain of `ripple-vms.com`:

```
org-slug.ripple-vms.com     → Organization instance (slug: "org-slug")
app.ripple-vms.com          → Platform landing page
www.ripple-vms.com          → Redirect to app.ripple-vms.com
dev-*.ripple-vms.com        → Dev environment (reserved)
```

### Subdomain Resolution

```typescript
// src/lib/org-resolver.ts
export async function getOrgFromSubdomain(hostname: string): Promise<Organization | null> {
  // Extract subdomain: "org-slug.ripple-vms.com" → "org-slug"
  const subdomain = hostname.split('.')[0];

  // Skip platform subdomains
  if (['app', 'www', 'api', 'dev', 'dev-nc'].includes(subdomain)) {
    return null;
  }

  return await prisma.organization.findUnique({
    where: { slug: subdomain },
    include: { settings: true },
  });
}
```

### Vercel Configuration

```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "(?<org>[^.]+).ripple-vms.com" }],
      "destination": "/:path*"
    }
  ]
}
```

### Future: Custom Domains (Premium Feature)

Organizations can optionally map their own domain:
```
vms.example-org.org → example-org.ripple-vms.com
```

This requires:
- Vercel custom domain configuration per org
- DNS CNAME from org's domain to ripple-vms.com
- SSL certificate provisioning (automatic via Vercel)

---

## New Admin Pages Required

```
/admin/organization           - Name, contact, branding
/admin/organization/members   - Invite/manage members, assign roles
/admin/organization/features  - Toggle modules
/admin/zones                  - Already exists, scope to org
/admin/shift-types            - Already exists, scope to org
/admin/training-types         - Already exists, scope to org
/admin/qualified-roles        - Already exists, scope to org
/admin/intake-questions       - Already exists, scope to org
/admin/settings               - Expand with new branding options
```

---

## API Route Changes

All **~100 API routes** need org-scoping. Pattern:

```typescript
// Before (single-tenant)
const zones = await prisma.zone.findMany({
  where: { isActive: true },
});

// After (multi-tenant)
const orgMember = await getOrgUser(organizationId);
if (!orgMember) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

const zones = await prisma.zone.findMany({
  where: {
    organizationId,
    isActive: true,
  },
});
```

### New Auth Helper

```typescript
// src/lib/org-user.ts
export async function getOrgUser(organizationId: string) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  return await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: sessionUser.id,
        organizationId,
      },
    },
    include: {
      user: true,
      organization: { include: { settings: true } },
      userQualifications: { include: { qualifiedRole: true } },
    },
  });
}

// Get org from current request context (subdomain)
export async function getOrgFromRequest(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  return getOrgFromSubdomain(hostname);
}
```

---

## Implementation Phases

### Phase 1: Core Foundation (~1.5 weeks)
- [ ] Add `Organization` model
- [ ] Add `organizationId` to core models first (minimal breaking changes):
  - Zone, QualifiedRole, ShiftTypeConfig, TrainingType
  - POICategory, IntakeQuestion
- [ ] Create migration seeding "Siembra NC" as first org
- [ ] Update OrganizationSettings to link to Organization

### Phase 2: User Membership (~1 week)
- [ ] Add `OrganizationMember` model
- [ ] Move `role` from User to OrganizationMember
- [ ] Move UserQualification to scope via OrganizationMember
- [ ] Migrate existing users to OrganizationMembers for "Siembra NC"

### Phase 3: Operational Data (~2 weeks)
- [ ] Add `organizationId` to:
  - Shift, Training, TrainingSession
  - DispatcherAssignment, RegionalLeadAssignment
  - IceSighting
  - CoverageConfig, CoverageSignup, CoverageOverride
- [ ] Update all ~100 API routes to filter by organizationId
- [ ] Add org authorization middleware

### Phase 4: Training Center (~1 week)
- [ ] Add `organizationId` to Training Center models:
  - TrainingModule, ModuleSection, ModuleQuiz
  - QuizQuestion, QuizOption
- [ ] Update S3 paths to include org prefix for video isolation
- [ ] Scope enrollment/progress tracking to org

### Phase 5: Auth & Context (~1 week)
- [ ] Create `src/lib/org-user.ts` helper functions
- [ ] Add org context to session/cookies
- [ ] Implement subdomain resolution middleware
- [ ] Update auth flow for multi-org users

### Phase 6: Admin UI (~1 week)
- [ ] Organization settings page (name, contact, branding)
- [ ] Member management (invite, roles, remove)
- [ ] Feature toggles UI
- [ ] Expand existing admin pages for org scope

### Phase 7: Frontend Updates (~1 week)
- [ ] Add org selector/switcher in navigation (for multi-org users)
- [ ] Update all data fetching to include organizationId
- [ ] Dynamic branding (logo, colors) from settings
- [ ] Replace 35+ hardcoded strings with database lookups

### Phase 8: Onboarding & Testing (~1 week)
- [ ] Org creation flow (see Organization Onboarding section below)
- [ ] Initial setup wizard (zones, shift types)
- [ ] Test with second org (New Orleans)
- [ ] Verify complete data isolation

---

## Migration Script Outline

```sql
-- 1. Create Organization table
-- 2. Create OrganizationMember table
-- 3. Insert "Siembra NC" as first organization (slug: "nc")
-- 4. Link existing OrganizationSettings to "Siembra NC"
-- 5. Create OrganizationMembers from existing Users (copy role)
-- 6. Add organizationId column to Zone, Shift, etc.
-- 7. Update all records to reference "Siembra NC" org
-- 8. Add NOT NULL constraint to organizationId columns
-- 9. Create indexes on organizationId fields
-- 10. Move UserQualification to scope via OrganizationMember
```

---

## Technical Considerations

### Data Isolation
- Every query MUST include `WHERE organizationId = ?`
- Consider Prisma middleware to auto-inject org filter
- Composite indexes for performance: `@@index([organizationId, date])`

### Performance
- Add indexes on all organizationId fields
- Composite indexes for common queries:
  - `@@index([organizationId, date])` on Shift, CoverageSignup
  - `@@index([organizationId, isActive])` on Zone, QualifiedRole
  - `@@index([organizationId, status])` on IceSighting

### Public Routes
- ICE sighting report page needs org context from subdomain
- Public zone stats API needs org scoping
- Signup page needs org context for IntakeQuestions

### Training Center Considerations
- **Video storage**: Use org-prefixed S3 paths (`training/{orgId}/videos/...`)
- **Module isolation**: Fully isolated per org initially
- **Future**: Template library for sharing modules between orgs

### Monitoring & Logs
- SystemLog and AuditLog remain platform-wide
- Include `organizationId` in metadata for filtering
- Consider per-org log retention policies

---

## Effort Estimate (Revised)

| Phase | Effort |
|-------|--------|
| Core Foundation | ~1.5 weeks |
| User Membership | ~1 week |
| Operational Data | ~2 weeks |
| Training Center | ~1 week |
| Auth & Context | ~1 week |
| Admin UI | ~1 week |
| Frontend Updates | ~1 week |
| Onboarding & Testing | ~1 week |
| **Total** | **~9-10 weeks** |

*Note: Original estimate was 4-5 weeks for 36 API routes. Current codebase has ~100 routes and significantly more features (Training Center, Coverage Grid, QualifiedRole system, etc.)*

---

## Email Configuration (Amazon SES)

### Strategy: Shared Platform SES with Per-Org Customization

All organizations send email through a **single SES account** owned by the platform, with per-org sender customization.

### SES Setup

**Verified Domain:** `ripple-vms.com` (with wildcard subdomain support)

**DNS Records Required:**
```
# DKIM (3 CNAME records - values provided by AWS)
selector1._domainkey.ripple-vms.com → CNAME → (provided by AWS)
selector2._domainkey.ripple-vms.com → CNAME → (provided by AWS)
selector3._domainkey.ripple-vms.com → CNAME → (provided by AWS)

# SPF (covers all subdomains)
ripple-vms.com → TXT → "v=spf1 include:amazonses.com ~all"

# DMARC
_dmarc.ripple-vms.com → TXT → "v=DMARC1; p=quarantine; rua=mailto:dmarc@ripple-vms.com"

# MX record for receiving bounces/complaints (optional but recommended)
ripple-vms.com → MX → inbound-smtp.us-east-1.amazonaws.com (priority 10)
```

**Key Point:** Verifying `ripple-vms.com` in SES automatically allows sending from **any subdomain** (e.g., `org-slug.ripple-vms.com`). No additional verification needed per organization.

### Email Sending Pattern

Each organization's emails use a **subdomain-based sender address**:

| Organization | Sender Address | Display Name |
|--------------|----------------|--------------|
| Example Org | `noreply@example-org.ripple-vms.com` | "Example Org" |
| Platform | `noreply@ripple-vms.com` | "Ripple VMS" |

**Implementation:**
```typescript
// src/lib/email.ts
function getEmailFrom(organization: Organization): string {
  const senderName = organization.settings?.emailFromName || organization.name;
  const senderAddress = `noreply@${organization.slug}.ripple-vms.com`;
  return `"${senderName}" <${senderAddress}>`;
}

// Example output: "Example Org" <noreply@example-org.ripple-vms.com>
```

### OrganizationSettings Email Fields (Already Exist)

```prisma
model OrganizationSettings {
  // Already implemented
  orgName          String   @default("RippleVMS")
  emailFromName    String   @default("RippleVMS")
  emailFromAddress String   @default("")
  emailReplyTo     String   @default("")
  emailFooter      String   @default("RippleVMS Team")
}
```

### Environment Variables

```env
# Platform-level SES configuration (shared across all orgs)
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_USER="<SES SMTP username>"
SMTP_PASS="<SES SMTP password>"

# Platform domain
PLATFORM_DOMAIN="ripple-vms.com"
```

### Email Tiers (Future)

| Tier | Email Configuration |
|------|---------------------|
| **Standard** | `noreply@<slug>.ripple-vms.com` |
| **Pro** | Custom verified domain (org adds DNS records to platform SES) |
| **Enterprise** | Org-provided SES credentials (full separation) |

### Pro Tier: Custom Domain Verification

For organizations that want emails from their own domain:

1. **Org provides domain:** e.g., `siembranc.org`
2. **Platform admin verifies in SES:** Add domain to platform's SES account
3. **Org adds DNS records:** DKIM, SPF, DMARC pointing to platform SES
4. **Update org settings:**
   ```prisma
   model OrganizationSettings {
     customEmailDomain       String?   // "siembranc.org"
     customEmailDomainVerified Boolean @default(false)
   }
   ```
5. **Emails now send as:** `noreply@siembranc.org`

### Enterprise Tier: Org-Owned SES (Full Isolation)

For organizations requiring complete email separation:

```prisma
model OrganizationSettings {
  // Enterprise: org provides their own SMTP/SES credentials
  customSmtpHost     String?
  customSmtpPort     Int?
  customSmtpUser     String?   // Encrypted
  customSmtpPass     String?   // Encrypted - SENSITIVE
  useCustomSmtp      Boolean   @default(false)
}
```

**Security Note:** Credentials should be encrypted at rest and only decrypted when sending email.

---

## Organization Onboarding Flow

### Approach: Hybrid (Templates + AI-Assisted Configuration)

New organizations go through a guided onboarding wizard that combines structured forms with AI-assisted setup for complex configuration like zones and shift types.

### Onboarding Steps

#### Step 1: Organization Basics (Structured Form)

```
┌─────────────────────────────────────────────────────────────┐
│  Let's set up your organization                             │
├─────────────────────────────────────────────────────────────┤
│  Organization name:  [New Orleans Rapid Defense Network   ] │
│  Subdomain:          [neworleans].ripple-vms.com           │
│  Contact email:      [contact@nolardn.org                 ] │
│  Hotline number:     [(504) 555-1234                      ] │
│  Timezone:           [America/Chicago              ▾]       │
│  Primary language:   ○ English  ○ Spanish  ● Both          │
└─────────────────────────────────────────────────────────────┘
```

**Validation:**
- Slug: lowercase alphanumeric + hyphens, 2-30 chars, unique
- Reserved slugs blocked: `app`, `www`, `api`, `admin`, `support`, `help`, `mail`, `email`, `dev`, `dev-nc`

#### Step 2: Choose a Template (Structured Selection)

```
┌─────────────────────────────────────────────────────────────┐
│  What type of organization are you?                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 🛡️ Rapid        │  │ ⚖️ Legal        │                  │
│  │ Response        │  │ Observer        │                  │
│  │ Network         │  │ Corps           │                  │
│  │                 │  │                 │                  │
│  │ ICE monitoring, │  │ Protest         │                  │
│  │ patrols,        │  │ observation,    │                  │
│  │ community       │  │ documentation,  │                  │
│  │ defense         │  │ court support   │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 🤝 Mutual Aid   │  │ ⚙️ Custom       │                  │
│  │ Network         │  │ Setup           │                  │
│  │                 │  │                 │                  │
│  │ Resource        │  │ Start from      │                  │
│  │ distribution,   │  │ scratch with    │                  │
│  │ community       │  │ full            │                  │
│  │ outreach        │  │ flexibility     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**Template Presets:**

| Template | Shift Types | Features | Qualified Roles |
|----------|-------------|----------|-----------------|
| **Rapid Response** | Patrol, Hotline, On-Call Support | ICE Sightings ✓, Training ✓, Coverage Grid ✓ | Verifier, Zone Lead, Dispatcher |
| **Legal Observer** | Court Watch, Street Team, Documentation | ICE Sightings ✗, Training ✓, Coverage Grid ✗ | Observer, Lead Observer |
| **Mutual Aid** | Distribution, Outreach, Transport | ICE Sightings ✗, Training ✓, Coverage Grid ✗ | Volunteer, Team Lead |
| **Custom** | (none - configure manually) | All optional | (none - configure manually) |

#### Step 3: Geographic Coverage (AI-Assisted)

```
┌─────────────────────────────────────────────────────────────┐
│  Describe your coverage area                                │
├─────────────────────────────────────────────────────────────┤
│  Tell us about the geographic area you'll be organizing.    │
│  Include neighborhoods, parishes/counties, or any natural   │
│  divisions you'd use to coordinate volunteers.              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ We cover Orleans Parish. We organize by the city's  │   │
│  │ historic wards - there are 17 wards but we focus on │   │
│  │ wards 1-9 in the central city, plus the Lower 9th   │   │
│  │ Ward. We also cover parts of Jefferson Parish -     │   │
│  │ Metairie and Kenner areas.                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Generate Zones →]             │
└─────────────────────────────────────────────────────────────┘
```

**AI Processing:**

```typescript
// Prompt sent to LLM
const prompt = `
Given this coverage description for a volunteer organization:
"${coverageDescription}"

Organization timezone: ${timezone}
Organization type: ${templateType}

Generate a JSON array of 5-15 geographic zones appropriate for
volunteer coordination. Each zone should have:
- name: Short identifier (e.g., "Ward 7", "Uptown", "Metairie")
- description: Brief description of the area covered
- county: Parish/county name if applicable

Consider:
- Natural neighborhood boundaries
- Practical coordination (not too large, not too small)
- Local naming conventions

Return valid JSON only.
`;
```

**AI Output → User Review:**

```
┌─────────────────────────────────────────────────────────────┐
│  Here's a suggested zone structure                          │
├─────────────────────────────────────────────────────────────┤
│  Based on your description, we suggest 12 zones:            │
│                                                             │
│  Orleans Parish:                                            │
│  ☑ Ward 1 (French Quarter/Marigny)                         │
│  ☑ Ward 2 (Central Business District/Warehouse)            │
│  ☑ Ward 3 (Bywater/St. Claude)                             │
│  ☑ Ward 4 (Algiers)                                        │
│  ☑ Ward 5 (Uptown)                          [Edit] [Remove] │
│  ☑ Ward 6 (Mid-City/Bayou St. John)                        │
│  ☑ Ward 7 (Lakeview/Gentilly)                              │
│  ☑ Ward 8 (New Orleans East)                               │
│  ☑ Ward 9 (Lower 9th Ward)                                 │
│                                                             │
│  Jefferson Parish:                                          │
│  ☑ Metairie                                                │
│  ☑ Kenner                                                  │
│                                                             │
│  [+ Add Zone]                    [Regenerate] [Looks Good →]│
└─────────────────────────────────────────────────────────────┘
```

#### Step 4: Shift Configuration (Template-Based + Customization)

If using a template, shift types are pre-populated:

```
┌─────────────────────────────────────────────────────────────┐
│  Review your shift types                                    │
├─────────────────────────────────────────────────────────────┤
│  Based on the Rapid Response template:                      │
│                                                             │
│  🔵 Patrol                                                  │
│     Teams monitor assigned zones for enforcement activity   │
│     Default duration: 4 hours                    [Edit]     │
│                                                             │
│  🟣 Hotline                                                 │
│     Receive and document community reports                  │
│     Default duration: 4 hours                    [Edit]     │
│                                                             │
│  🟠 On-Call Support                                         │
│     Available for rapid deployment when needed              │
│     Default duration: 8 hours                    [Edit]     │
│                                                             │
│  [+ Add Shift Type]                         [Continue →]    │
└─────────────────────────────────────────────────────────────┘
```

#### Step 5: Training & Qualifications (Template-Based)

```
┌─────────────────────────────────────────────────────────────┐
│  Training & qualification setup                             │
├─────────────────────────────────────────────────────────────┤
│  Volunteers will progress through these levels:             │
│                                                             │
│  Level 1: New Volunteer                                     │
│  └── Required: Basic Orientation                            │
│                                                             │
│  Level 2: Verified Observer                                 │
│  └── Required: Know Your Rights Training                    │
│                                                             │
│  Level 3: Zone Lead                                         │
│  └── Required: De-escalation & Field Leadership             │
│                                                             │
│  Level 4: Dispatcher                                        │
│  └── Required: Dispatcher Certification                     │
│                                                             │
│  [Customize]                                [Continue →]    │
└─────────────────────────────────────────────────────────────┘
```

#### Step 6: Branding (Optional)

```
┌─────────────────────────────────────────────────────────────┐
│  Customize your appearance (optional)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Logo:  [Upload Logo]  or  [Use Default]                    │
│         (Recommended: 200x200px, PNG or WebP)               │
│                                                             │
│  Primary color:  [#0d9488] 🎨  (Used for buttons, links)   │
│                                                             │
│  Coverage map:                                              │
│  If you have a Google My Maps showing your coverage area,   │
│  paste the embed URL here:                                  │
│  [https://www.google.com/maps/d/embed?mid=...             ] │
│                                                             │
│  [Skip for now]                             [Continue →]    │
└─────────────────────────────────────────────────────────────┘
```

#### Step 7: Admin Account Setup

```
┌─────────────────────────────────────────────────────────────┐
│  Create your admin account                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your name:     [Maria Santos                             ] │
│  Email:         [maria@nolardn.org                        ] │
│  Phone:         [(504) 555-9876                           ] │
│                                                             │
│  You'll be the first Administrator for this organization.   │
│  You can invite additional admins after setup.              │
│                                                             │
│                                          [Create Account →] │
└─────────────────────────────────────────────────────────────┘
```

#### Step 8: Review & Launch

```
┌─────────────────────────────────────────────────────────────┐
│  Ready to launch!                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Organization: New Orleans Rapid Defense Network            │
│  URL: neworleans.ripple-vms.com                            │
│  Template: Rapid Response Network                           │
│                                                             │
│  ✓ 12 zones configured                                      │
│  ✓ 3 shift types (Patrol, Hotline, On-Call Support)        │
│  ✓ 4 training modules                                       │
│  ✓ ICE Sighting reports enabled                             │
│  ✓ Coverage grid enabled                                    │
│                                                             │
│  Admin: Maria Santos (maria@nolardn.org)                    │
│                                                             │
│  [← Back to Edit]                      [🚀 Launch Organization]│
└─────────────────────────────────────────────────────────────┘
```

### Data Model for Onboarding

```typescript
interface OnboardingSession {
  id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  currentStep: number;

  // Step 1: Basics
  organizationName: string;
  slug: string;
  contactEmail: string;
  hotlineNumber?: string;
  timezone: string;
  primaryLanguage: 'en' | 'es' | 'both';

  // Step 2: Template
  templateType: 'rapid_response' | 'legal_observer' | 'mutual_aid' | 'custom';

  // Step 3: Geography (AI-assisted)
  coverageDescription: string;
  zones: {
    name: string;
    description: string;
    county?: string;
  }[];

  // Step 4: Shifts
  shiftTypes: {
    name: string;
    description: string;
    color: string;
    defaultDurationHours: number;
  }[];

  // Step 5: Training
  trainingModules: {
    name: string;
    description: string;
    qualificationGranted?: string;
  }[];
  qualifiedRoles: string[];

  // Step 6: Branding
  logoUrl?: string;
  primaryColor?: string;
  mapEmbedUrl?: string;

  // Step 7: Admin
  adminName: string;
  adminEmail: string;
  adminPhone?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

### AI Prompts Library

**Zone Generation Prompt:**
```
You are helping set up a volunteer management system. Given this description
of a geographic coverage area, generate appropriate zones for volunteer coordination.

Coverage description: "${coverageDescription}"
Organization type: ${templateType}
Location timezone: ${timezone}

Requirements:
- Generate 5-15 zones
- Use local naming conventions (wards, neighborhoods, parishes, etc.)
- Each zone should be manageable for a small team (not too large)
- Include county/parish if the org spans multiple

Return JSON array:
[
  { "name": "Zone Name", "description": "Brief description", "county": "County Name" }
]
```

**Shift Type Suggestion Prompt (for Custom template):**
```
Based on these volunteer activities: ${activities.join(', ')}

Suggest 2-4 shift types with:
- name: Short, clear name
- description: What volunteers do during this shift
- color: Hex color for calendar display
- defaultDurationHours: Typical shift length

Return JSON array.
```

### Guardrails & Validation

1. **AI output is always reviewable** - users can edit, add, remove AI suggestions
2. **Fallback to templates** - if AI fails, offer template-based zones
3. **Slug uniqueness check** - real-time validation against existing orgs
4. **Required field validation** - name, email, timezone are mandatory
5. **Platform admin notification** - alert when new org is created (optional review)

### Post-Onboarding

After completing onboarding:

1. **Welcome email** sent to admin with:
   - Login link to `<slug>.ripple-vms.com`
   - Quick start guide
   - Link to invite team members

2. **Guided tour** on first login showing:
   - Dashboard overview
   - How to create shifts / coverage grid
   - How to invite volunteers
   - Admin settings location

3. **Sample data option** (optional):
   - Create a few example coverage signups
   - Add placeholder training sessions
   - Helps org understand the system before going live

---

## Future Enhancements (Post-MVP)

- [ ] Custom domain support per organization (Pro tier)
- [ ] Org-provided SES credentials (Enterprise tier)
- [ ] Subscription tiers with feature gating
- [ ] Cross-org reporting for platform admins
- [ ] Organization templates (preset configurations)
- [ ] White-label deployment option
- [ ] AI-assisted zone boundary suggestions using mapping APIs
- [ ] Import existing volunteer lists (CSV upload)
- [ ] Clone organization setup (copy config from existing org)
- [ ] Training module template library (share modules between orgs)
- [ ] Configurable coverage time slots (not just 6-18 by 2-hour blocks)
