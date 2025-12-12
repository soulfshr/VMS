# Settings Consolidation Assessment

## Current State

Settings are currently distributed across 5 different locations:

### 1. Admin Settings (`/admin/settings`)
**Roles:** ADMINISTRATOR, DEVELOPER

| Setting | Purpose |
|---------|---------|
| Auto-Confirm RSVPs | Automatically confirm volunteer signups |
| Max File Upload Size | ICE sighting report file limits (10-100 MB) |
| Max Files Per Report | ICE sighting report file count (3-20) |
| Organization Name | Used in email subject/body |
| Email From Name | Sender display name |
| Email From Address | Sender email (local part only) |
| Reply-To Address | Where replies go |
| Email Footer Team Name | Footer branding |
| Weekly Digest Toggle | Enable/disable Sunday emails |
| Weekly Digest Hour | Send time (0-23) |

### 2. Coordinator Settings (`/coordinator/settings`)
**Roles:** COORDINATOR, ADMINISTRATOR, DEVELOPER

| Setting | Purpose |
|---------|---------|
| Dispatcher Scheduling Mode | REGIONAL / COUNTY / ZONE |
| Volunteer Scheduling Mode | SIMPLE (Leaders Only) / FULL (All Volunteers) |

### 3. User Profile (`/profile`)
**Roles:** All authenticated users

| Setting | Purpose |
|---------|---------|
| Phone/Signal Handle | Contact info |
| Primary Language | English/Spanish/Other |
| Email Notifications | Toggle email preferences |
| Weekly Availability | 3x7 time slot grid |
| Zone Preferences | Multi-select with primary zone |

### 4. Developer Feature Flags (`/developer/feature-flags`)
**Roles:** DEVELOPER only

| Setting | Purpose |
|---------|---------|
| Trainings Feature | Toggle trainings visibility |
| ICE Sightings Feature | Toggle sightings visibility |

### 5. Developer System Monitoring (`/developer`)
**Roles:** DEVELOPER only

| Setting | Purpose |
|---------|---------|
| Feedback Email Recipient | Where feedback widget sends emails |

---

## Opportunities for Consolidation

### Option A: Unified Admin Settings Panel (Recommended)

Consolidate all organization-level settings into tabs within `/admin/settings`:

```
/admin/settings
├── General (existing)
│   ├── Auto-Confirm RSVPs
│   └── Timezone (future)
├── Scheduling (move from Coordinator)
│   ├── Dispatcher Mode
│   └── Volunteer Mode
├── Email & Branding (existing)
│   ├── Organization Name
│   ├── From/Reply-To
│   └── Weekly Digest
├── File Uploads (existing)
│   └── ICE Sighting Limits
└── Feature Flags (move from Developer)
    ├── Trainings
    └── Sightings
```

**Pros:**
- Single location for all org settings
- Coordinators still access via elevated permissions
- Reduces navigation complexity

**Cons:**
- Coordinators need Admin access to change scheduling modes
- May need role-based tab visibility

### Option B: Keep Coordinator Settings Separate

Leave scheduling modes in Coordinator Console since they're frequently adjusted during operations.

**Consolidate only:**
- Move Feature Flags to Admin Settings (with ADMINISTRATOR access)
- Keep Developer page for monitoring-only features

### Option C: Role-Based Settings Hub

Create a unified `/settings` page that shows different sections based on role:

```
/settings
├── My Profile (all users - current /profile)
├── Scheduling (COORDINATOR+)
├── Organization (ADMINISTRATOR+)
└── Developer (DEVELOPER only)
```

---

## Recommendation

**Start with Option B (minimal disruption):**

1. Move Feature Flags from `/developer/feature-flags` to `/admin/settings` as a new tab
2. Allow ADMINISTRATOR role to toggle features (currently DEVELOPER only)
3. Keep Coordinator scheduling settings where they are (operational convenience)
4. Keep Developer monitoring page for feedback email and system health

**Future consideration (Option C):**

If users request a unified settings experience, implement a `/settings` hub with role-based sections.

---

## Implementation Effort

| Task | Effort | Priority |
|------|--------|----------|
| Move Feature Flags to Admin Settings | Low (1-2 hours) | Medium |
| Add tabs to Admin Settings | Low (1 hour) | Low |
| Unified /settings hub | Medium (4-6 hours) | Low |
| Role-based tab visibility | Low (1 hour) | Low |

---

## Notes

- User Profile settings should remain at `/profile` (personal, not organizational)
- Developer-only monitoring tools should stay in `/developer` (not settings)
- Feedback email recipient could move to Admin > Email settings

Created: 2024-12-12
