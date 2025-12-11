# Weekly Schedule Email Digest

## Overview

Automated weekly email sent on Sundays showing the schedule for the upcoming week. Sent to dispatchers and coordinators who have email notifications enabled.

## Requirements

- **Admin toggle** to enable/disable the feature (off by default)
- Send every Sunday evening (e.g., 6 PM ET)
- Include schedule for Mon-Sun of the upcoming week
- Recipients: COORDINATOR, DISPATCHER, ADMINISTRATOR roles with `emailNotifications: true`
- Show assignments by day with coverage status
- Include gaps/unfilled positions as call-to-action
- Respect user unsubscribe preferences

## Implementation

### 0. Add Admin Setting

**File:** `prisma/schema.prisma`

Add field to `OrganizationSettings`:

```prisma
weeklyDigestEnabled  Boolean  @default(false)
```

**File:** `src/app/admin/settings/page.tsx`

Add toggle in Email Settings section:

```tsx
<div className="flex items-center justify-between">
  <div>
    <label className="font-medium">Weekly Schedule Digest</label>
    <p className="text-sm text-gray-500">
      Send weekly schedule overview to coordinators/dispatchers every Sunday
    </p>
  </div>
  <Switch
    checked={settings.weeklyDigestEnabled}
    onChange={(checked) => updateSetting('weeklyDigestEnabled', checked)}
  />
</div>
```

### 1. Create Cron Endpoint

**File:** `src/app/api/cron/weekly-digest/route.ts`

```typescript
// GET /api/cron/weekly-digest
// Triggered by Vercel cron on Sundays at 6 PM ET

export async function GET(request: NextRequest) {
  // 1. Verify cron auth
  // 2. Check if weeklyDigestEnabled is true - exit early if disabled
  // 3. Calculate next week's date range (Monday to Sunday)
  // 4. Fetch schedule data for the week
  // 5. Query eligible recipients (COORDINATOR/DISPATCHER/ADMIN with emailNotifications: true)
  // 6. Generate email HTML with weekly summary
  // 7. Send emails via sendWeeklyDigestEmail()
  // 8. Log results
}
```

### 2. Add Email Function

**File:** `src/lib/email.ts`

Add new function `sendWeeklyDigestEmail()`:

```typescript
export async function sendWeeklyDigestEmail(params: {
  to: string;
  recipientName: string;
  weekStartDate: Date;
  weekEndDate: Date;
  scheduleData: WeeklyDigestData;
  unsubscribeToken?: string;
}) {
  // Subject: "[RippleVMS] Weekly Schedule: Dec 16-22"
  // Body:
  //   - Week overview header
  //   - Table with each day showing:
  //     - Dispatch Coordinator (if assigned)
  //     - Dispatchers per county
  //     - Zone coverage summary
  //   - Highlight gaps/unfilled positions
  //   - Link to full schedule page
  //   - Unsubscribe footer
}
```

### 3. Configure Vercel Cron

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 23 * * 0"  // 6 PM ET = 11 PM UTC on Sundays
    }
  ]
}
```

### 4. Email Template Structure

```html
Subject: [RippleVMS] Weekly Schedule: Dec 16-22, 2024

Header:
  "Here's your schedule overview for the upcoming week"

For each day (Mon-Sun):
  ┌─────────────────────────────────────┐
  │ Monday, December 16                 │
  ├─────────────────────────────────────┤
  │ Dispatch Coord: John Smith          │
  │ Durham Dispatcher: Jane Doe         │
  │ Wake Dispatcher: (NEEDED)           │
  │ Zone Coverage: 8/10 zones covered   │
  └─────────────────────────────────────┘

Summary Section:
  - Total shifts scheduled: 42
  - Positions still needed: 5
  - [View Full Schedule] button

Footer:
  - Manage preferences link
  - Unsubscribe link
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `weeklyDigestEnabled` field to OrganizationSettings |
| `src/app/admin/settings/page.tsx` | Modify | Add toggle for Weekly Schedule Digest |
| `src/app/api/cron/weekly-digest/route.ts` | Create | New cron endpoint |
| `src/lib/email.ts` | Modify | Add `sendWeeklyDigestEmail()` function |
| `vercel.json` | Modify | Add cron schedule |

## Data Flow

1. Vercel cron triggers `/api/cron/weekly-digest` at 6 PM ET Sundays
2. **Check `weeklyDigestEnabled` setting - exit if disabled**
3. Endpoint calculates Monday-Sunday date range for upcoming week
4. Fetches schedule using same logic as `/api/schedule` route
5. Queries users: `{ role: in [COORDINATOR, DISPATCHER, ADMINISTRATOR], isActive: true, emailNotifications: true }`
6. Generates personalized email for each recipient
7. Sends via AWS SES using existing `sendEmail()` pattern
8. Logs send counts to SystemLog

## Testing

- Add manual trigger via query param: `?test=true` (dev only)
- Test with single recipient first
- Verify timezone handling for week boundaries
