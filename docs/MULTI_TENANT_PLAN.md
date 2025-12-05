# Multi-Tenant Architecture Plan

> **Status:** Planning (not yet implemented)
> **Created:** 2025-12-03
> **Purpose:** Make VMS portable to other organizations (e.g., New Orleans)
> **Platform Domain:** `ripple-vms.com`

## Overview

Transform Siembra NC VMS into **Ripple VMS**, a multi-tenant platform where each organization gets their own subdomain with admin-configurable settings.

**URL Structure:** `<organization>.ripple-vms.com`
- `siembra.ripple-vms.com` → Siembra NC
- `neworleans.ripple-vms.com` → New Orleans RDN
- `app.ripple-vms.com` → Platform landing/marketing page

---

## Core Architecture Changes

### New Data Model

```
Organization (new root entity)
├── OrganizationMember (joins Users to Orgs with per-org roles)
├── OrganizationSettings (expanded from current singleton)
├── Zones
├── Shifts
├── Trainings
├── ICE Sightings
└── ... all operational data
```

**Key Design Decision:** Users remain global (one account, one email), but their **role and qualifications become per-organization** via `OrganizationMember`. This allows someone to be an Administrator in Siembra NC but just a Volunteer in New Orleans.

### New Prisma Models

```prisma
model Organization {
  id              String   @id @default(cuid())
  name            String                        // Display name: "Siembra NC"
  slug            String   @unique              // Subdomain: "siembra" → siembra.ripple-vms.com

  // Contact info
  email           String?
  phone           String?  // Hotline number
  address         String?

  // Status
  isActive        Boolean  @default(true)

  // Relationships
  members         OrganizationMember[]
  settings        OrganizationSettings?
  zones           Zone[]
  shifts          Shift[]
  trainings       Training[]
  trainingTypes   TrainingType[]
  shiftTypes      ShiftTypeConfig[]
  sightings       IceSighting[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Slug validation: lowercase alphanumeric + hyphens, 3-30 chars
// Reserved slugs: app, www, api, admin, support, help, mail, email

model OrganizationMember {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Per-org role (not global)
  role            Role         @default(VOLUNTEER)
  qualifications  Qualification[]

  // Per-org zone assignment
  primaryZoneId   String?
  primaryZone     Zone?        @relation("PrimaryZone", fields: [primaryZoneId], references: [id])

  joinedAt        DateTime     @default(now())

  @@unique([userId, organizationId])
  @@index([organizationId])
}
```

### Expanded OrganizationSettings

```prisma
model OrganizationSettings {
  id                  String   @id @default(cuid())
  organizationId      String   @unique
  organization        Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Current fields
  autoConfirmRsvp     Boolean  @default(false)
  timezone            String   @default("America/New_York")
  maxUploadSizeMb     Int      @default(50)
  maxUploadsPerReport Int      @default(5)

  // NEW: Branding
  logoUrl             String?
  primaryColor        String?  // Hex color
  secondaryColor      String?
  footerText          String?

  // NEW: Contact
  supportEmail        String?
  hotlineNumber       String?

  // NEW: Feature toggles
  enableIceSightings  Boolean  @default(true)
  enableTraining      Boolean  @default(true)
  enableDispatching   Boolean  @default(true)

  // NEW: External integrations
  mapEmbedUrl         String?  // Google My Maps embed

  // NEW: Notifications
  notifyOnNewSighting Boolean  @default(true)
  notifyOnRsvp        Boolean  @default(true)
  emailSenderName     String?  // e.g., "Siembra NC VMS"

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

---

## Models Requiring organizationId

### Must Add organizationId Directly

| Model | Notes |
|-------|-------|
| Zone | Geographic areas per org |
| Shift | Shifts per org |
| Training | Training definitions per org |
| TrainingType | Training types per org |
| TrainingSession | Sessions per org |
| ShiftTypeConfig | Shift types per org |
| IceSighting | Sightings reported to org |
| DispatcherAssignment | Assignments per org |
| Availability | User availability per org |
| UserZone | Zone membership per user-org |
| UserTraining | Training records per user-org |

### Scoped Through Parent (No Direct organizationId)

| Model | Scoped Via |
|-------|-----------|
| ShiftVolunteer | Shift.organizationId |
| TrainingSessionAttendee | TrainingSession.organizationId |
| SightingMedia | IceSighting.organizationId |
| ShiftTypeRoleRequirement | ShiftTypeConfig.organizationId |

### Global (No organizationId)

| Model | Reason |
|-------|--------|
| User | Users can belong to multiple orgs |

---

## Hardcoded Content to Make Configurable

| Currently Hardcoded | Location | New Source |
|---------------------|----------|------------|
| "Siembra NC" | 26+ files | `organization.name` |
| 336-543-0353 | page.tsx, report/page.tsx | `settings.hotlineNumber` |
| support@siembranc.org | HelpDrawer.tsx | `settings.supportEmail` |
| America/New_York | email.ts, schema.prisma | `settings.timezone` |
| Google Maps embed ID | page.tsx, about/page.tsx | `settings.mapEmbedUrl` |
| siembra-logo.webp | Header, Footer | `settings.logoUrl` |
| Teal color (#0d9488) | Multiple components | `settings.primaryColor` |
| Signal group links | seed.ts | Per-zone admin config |

---

## URL Structure (Subdomain-based)

Each organization gets a subdomain of `ripple-vms.com`:

```
siembra.ripple-vms.com      → Siembra NC (slug: "siembra")
neworleans.ripple-vms.com   → New Orleans RDN (slug: "neworleans")
app.ripple-vms.com          → Platform landing page
www.ripple-vms.com          → Redirect to app.ripple-vms.com
```

### Subdomain Resolution

```typescript
// src/lib/org-resolver.ts
export async function getOrgFromSubdomain(hostname: string): Promise<Organization | null> {
  // Extract subdomain: "siembra.ripple-vms.com" → "siembra"
  const subdomain = hostname.split('.')[0];

  // Skip platform subdomains
  if (['app', 'www', 'api'].includes(subdomain)) {
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
vms.siembranc.org → siembra.ripple-vms.com
vms.nolardn.org   → neworleans.ripple-vms.com
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
/admin/settings               - Expand with new options
```

---

## API Route Changes

All 36 API routes need org-scoping. Pattern:

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
    },
  });
}
```

---

## Implementation Phases

### Phase 1: Schema Foundation
- [ ] Add `Organization` and `OrganizationMember` models
- [ ] Add `organizationId` to all scoped models
- [ ] Expand `OrganizationSettings` with new fields
- [ ] Create migration that assigns existing data to "Siembra NC" org
- [ ] Existing users become OrganizationMembers with current roles

### Phase 2: Auth & API Updates
- [ ] Create `src/lib/org-user.ts` helper functions
- [ ] Add org context to session/cookies
- [ ] Update all 36 API routes to filter by organizationId
- [ ] Add org authorization middleware

### Phase 3: Admin UI
- [ ] Organization settings page (name, contact, branding)
- [ ] Member management (invite, roles, remove)
- [ ] Feature toggles UI
- [ ] Expand existing admin pages for org scope

### Phase 4: Frontend Updates
- [ ] Add org selector/switcher in navigation
- [ ] Update all data fetching to include organizationId
- [ ] Dynamic branding (logo, colors) from settings
- [ ] Replace hardcoded strings with database lookups

### Phase 5: Onboarding & Testing
- [ ] Org creation flow (see Organization Onboarding section below)
- [ ] Initial setup wizard (zones, shift types)
- [ ] Test with second org (New Orleans)
- [ ] Verify complete data isolation

---

## Migration Script Outline

```sql
-- 1. Create Organization table
-- 2. Create OrganizationMember table
-- 3. Insert "Siembra NC" as first organization
-- 4. Create OrganizationMembers from existing Users
-- 5. Add organizationId column to Zone, Shift, etc.
-- 6. Update all records to reference Siembra NC org
-- 7. Add NOT NULL constraint to organizationId columns
-- 8. Create indexes on organizationId fields
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
  - `@@index([organizationId, date])` on Shift
  - `@@index([organizationId, isActive])` on Zone

### Public Routes
- ICE sighting report page needs org context
- Options: org selector, subdomain detection, or org-specific URLs

---

## Effort Estimate

| Phase | Effort |
|-------|--------|
| Schema & Migration | ~1 week |
| Auth & API Updates | ~1.5 weeks |
| Admin UI | ~1 week |
| Frontend Updates | ~0.5 week |
| Testing & Polish | ~0.5 week |
| **Total** | **~4-5 weeks** |

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

**Key Point:** Verifying `ripple-vms.com` in SES automatically allows sending from **any subdomain** (e.g., `siembra.ripple-vms.com`, `neworleans.ripple-vms.com`). No additional verification needed per organization.

### Email Sending Pattern

Each organization's emails use a **subdomain-based sender address**:

| Organization | Sender Address | Display Name |
|--------------|----------------|--------------|
| Siembra NC | `noreply@siembra.ripple-vms.com` | "Siembra NC" |
| New Orleans | `noreply@neworleans.ripple-vms.com` | "New Orleans RDN" |
| Platform | `noreply@ripple-vms.com` | "Ripple VMS" |

**Implementation:**
```typescript
// src/lib/email.ts
function getEmailFrom(organization: Organization): string {
  const senderName = organization.settings?.emailSenderName || organization.name;
  const senderAddress = `noreply@${organization.slug}.ripple-vms.com`;
  return `"${senderName}" <${senderAddress}>`;
}

// Example output: "Siembra NC" <noreply@siembra.ripple-vms.com>
```

### OrganizationSettings Email Fields

```prisma
model OrganizationSettings {
  // ... existing fields ...

  // Email customization
  emailSenderName     String?   // Display name (e.g., "Siembra NC")
  replyToEmail        String?   // Optional reply-to address
  emailFooterText     String?   // Custom footer for emails
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
- Slug: lowercase alphanumeric + hyphens, 3-30 chars, unique
- Reserved slugs blocked: `app`, `www`, `api`, `admin`, `support`, `help`, `mail`, `email`

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

| Template | Shift Types | Features | Qualifications |
|----------|-------------|----------|----------------|
| **Rapid Response** | Patrol, Hotline, On-Call Support | ICE Sightings ✓, Training ✓, Dispatching ✓ | Verifier, Zone Lead, Dispatcher |
| **Legal Observer** | Court Watch, Street Team, Documentation | ICE Sightings ✗, Training ✓, Dispatching ✗ | Observer, Lead Observer |
| **Mutual Aid** | Distribution, Outreach, Transport | ICE Sightings ✗, Training ✓, Dispatching ✗ | Volunteer, Team Lead |
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
│  ✓ Dispatcher assignments enabled                           │
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
  qualifications: string[];

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
   - How to create shifts
   - How to invite volunteers
   - Admin settings location

3. **Sample data option** (optional):
   - Create a few example shifts
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
