# Dispatch Schedule Clipboard Helper

## Overview
- **Requester:** Tobi (Dispatch Coordinator)
- **Date:** 2024‑12‑12
- **Status:** Draft spec
- **Goal:** Allow coordinators/dispatchers to copy a formatted snapshot of upcoming dispatch coverage into Signal (or any chat) with a single click.

### Problem
Dispatchers manually type daily coverage updates (assigned shifts + coverage gaps) into Signal. This is time-consuming and prone to errors. They want a fast way to pull structured data from the app and paste it into chat.

### Success Criteria
1. From the existing schedule/dispatch workspace, a privileged user can trigger “Copy Dispatch Update”.
2. The clipboard content includes:
   - Date (e.g. “Dispatch Schedule for Thu Dec 12”)
   - Assigned shifts grouped by time blocks and counties
   - Explicit “Needs coverage” blocks
   - Optional notes (e.g. shift lead)
3. Copy action takes <1s and confirms success.
4. Text pastes cleanly into Signal/Slack/SMS without formatting loss.

## User Roles
- Available to `COORDINATOR`, `DISPATCHER`, `ADMINISTRATOR`, `DEVELOPER`.
- Action hidden/disabled for volunteers.

## UX Outline
1. **Entry point:** Schedule / Dispatch tab header gains a small “Copy Dispatch Update” button (icon + label) aligned with filters/export controls.
2. **State handling:**
   - Button enabled when date range includes today or future days. Default selection = today.
   - If no shifts scheduled, clipboard still gains header + “No shifts scheduled” message.
3. **Feedback:**
   - On success: toast “Dispatch update copied”.
   - On error: toast with retry guidance.
4. **Customization:**
   - Modal with options:
     - Date (defaults to selected day)
     - Include coverage gaps? (yes default)
     - Include Signal mentions? (if volunteer handles stored)
   - Modal optional for v1; we can ship simple single-click using current schedule filters.

## Data Requirements
- Shifts scoped to chosen day and dispatch type.
- For each shift: time window, county/zone, assigned volunteer names + preferred Signal handle (`@handle` from `signalHandle` field).
- Determine coverage gaps:
  - For each standard dispatch block (6–10, 10–2, 2–6, etc.) per county determine required slots vs assigned volunteers.
  - Use existing schedule metadata (maybe `requiredVolunteers` on dispatch shifts) or fallback to heuristics (≥1 means covered).
- API endpoint proposal:
  - `GET /api/dispatch/clipboard?date=YYYY-MM-DD`
  - Returns JSON structure with `needsCoverage[]` and `assigned[]`.
  - Existing `/api/shifts` filtering might already support this; if so, reuse and format client-side.

## Clipboard Format (Draft)
```
Dispatch Schedule for Thu Dec 12

Needs coverage:
10am‑2pm – Wake
2pm‑6pm – Durham
2pm‑6pm – Orange

Assignments:
6am‑10am
  Wake – @Andrea C
  Durham – @Jem ☕️
  Orange – @Gp
10am‑2pm
  Wake – need coverage
  Durham – @B Akos
  Orange – @butter ball🧈
```
- Use standard ASCII except emojis already in volunteer names.
- Replace “need coverage” lines automatically.

## Tech Notes
- Clipboard API available via `navigator.clipboard.writeText`; fall back to hidden textarea for older browsers.
- Ensure string built client-side with deterministic order (time ascending, county alphabetical).
- Provide `useMutation` hook to hit API or to compose data locally from cached schedule query.
- Keep server logic simple: ideally reuse existing `getVisibleShiftsForDate` function.

## Analytics / Logging
- Track button usage (e.g., `analytics.track('dispatch_copy_clipboard', { date })`).
- Helps gauge adoption.

## Risks / Open Questions
1. **Coverage gap detection:** need canonical requirement per shift; confirm with Tobi.
2. **Multiple dispatch types per day:** decide whether to include all counties vs filtered subset.
3. **Time zone handling:** ensure displayed date/time uses org default timezone (likely Eastern).
4. **Localization:** currently U.S.-centric; acceptable for v1.

## Implementation Plan (High-level)
1. Backend (optional):
   - Add helper service to compute structured dispatch summary for a date.
   - Expose `/api/dispatch/clipboard`.
2. Frontend:
   - Add button + modal in `src/app/schedule/page.tsx` (or relevant component).
   - Hook to fetch/compose summary and copy to clipboard.
   - Toast feedback using existing notification component.
3. QA:
   - Unit test summary formatter.
   - Manual test: day with assignments, day with none, unauthorized user.

