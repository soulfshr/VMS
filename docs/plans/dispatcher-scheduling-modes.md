# Dispatcher Scheduling Modes Plan

## Problem Statement

Some weeks are very busy requiring lots of volunteers and dedicated dispatchers per county. Other weeks are slow, warranting a more bare-bones approach with a single dispatcher covering all counties.

The VMS needs an admin setting to toggle between:
1. **HIGH NEED**: Dispatchers scheduled by shift time/date AND county (current implementation)
2. **LOW NEED**: Dispatchers scheduled by shift time/date only (simplified)

## Current Implementation

- `DispatcherAssignment` model has a required `county` field
- Each dispatcher is assigned to a specific county + date + time block
- Schedule grid shows dispatcher in each cell (county × time block)

## Recommended Approach: "ALL" County + New UI Row

### Concept

1. Add `dispatcherSchedulingMode` admin setting: `'PER_COUNTY'` | `'CONSOLIDATED'`
2. Allow `'ALL'` as a valid county value for dispatcher assignments
3. When in CONSOLIDATED mode, show a dedicated "Dispatcher" row between Dispatch Coordinator and counties

### Schedule Grid Visualization

**PER_COUNTY mode (current):**
```
| Time      | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|-----------|-----|-----|-----|-----|-----|-----|-----|
| 🌐 RL     | Hart| ... | ... | ... | ... | ... | ... |
| Wake      |     |     |     |     |     |     |     |
|  6a-12p   | 🎧Amy| 🎧Bob| ... |     |     |     |     |
|  12p-6p   | 🎧Sam| 🎧—  | ... |     |     |     |     |
| Durham    |     |     |     |     |     |     |     |
|  6a-12p   | 🎧Pat| 🎧—  | ... |     |     |     |     |
```

**CONSOLIDATED mode (new):**
```
| Time      | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|-----------|-----|-----|-----|-----|-----|-----|-----|
| 🌐 RL     | Hart| ... | ... | ... | ... | ... | ... |
| 🎧 Disp   |     |     |     |     |     |     |     |
|  6a-12p   | Amy | Bob | —   | Amy | Bob | —   | —   |
|  12p-6p   | Sam | —   | Pat | Sam | Pat | —   | —   |
| Wake      |     |     |     |     |     |     |     |
|  6a-12p   | (zones only - no dispatcher shown)      |
| Durham    |     |     |     |     |     |     |     |
```

## Implementation Details

### 1. Schema Changes

Add to `OrganizationSettings`:
```prisma
dispatcherSchedulingMode  String  @default("PER_COUNTY")  // "PER_COUNTY" or "CONSOLIDATED"
```

No changes needed to `DispatcherAssignment` - just use `county: "ALL"` for consolidated assignments.

### 2. Admin Settings UI

Add toggle to Admin > Settings:
```
Dispatcher Scheduling
○ Per County (assign dispatchers for each county separately)
● Consolidated (one dispatcher covers all counties per time block)
```

### 3. Schedule API Changes

- Fetch `dispatcherSchedulingMode` from settings
- Return it in the schedule response
- When mode is CONSOLIDATED:
  - Return dispatchers with `county: "ALL"` as a separate array
  - Group by timeBlock only (not by county)

### 4. Schedule UI Changes

When mode is CONSOLIDATED:
- Add a new "Dispatcher" section between Dispatch Coordinator row and county sections
- Show time block rows with dispatcher for each day
- Hide dispatcher info from individual county cells (show only zones)

### 5. AssignmentModal Changes

When mode is CONSOLIDATED:
- Instead of "Dispatcher for Wake 6am-12pm", show "Dispatcher for 6am-12pm (all counties)"
- Assignment creates/updates record with `county: "ALL"`

## Alternative Approaches Considered

### Option A: Make county nullable
- **Pros**: Clean null semantics
- **Cons**: Requires migration, need to update all queries
- **Verdict**: More invasive than needed

### Option B: UI-only solution (display mode)
- **Pros**: No schema changes
- **Cons**: Still requires per-county assignments, doesn't simplify coordinator workflow
- **Verdict**: Doesn't solve the actual workflow problem

### Option C: Separate "GlobalDispatcher" model
- **Pros**: Clean separation
- **Cons**: Over-engineered, duplicate logic
- **Verdict**: Too complex

## Migration Path

1. Add setting (defaults to PER_COUNTY - no change for existing users)
2. When switched to CONSOLIDATED:
   - Existing per-county assignments remain valid
   - New assignments use `county: "ALL"`
   - Could add migration tool to convert existing assignments

## Files to Modify

1. `prisma/schema.prisma` - Add dispatcherSchedulingMode to OrganizationSettings
2. `src/app/admin/settings/page.tsx` - Add toggle UI
3. `src/app/api/admin/settings/route.ts` - Handle new setting
4. `src/app/api/schedule/route.ts` - Return consolidated dispatchers separately
5. `src/app/schedule/page.tsx` - Add conditional Dispatcher row section
6. `src/components/schedule/AssignmentModal.tsx` - Handle consolidated mode

## Estimated Complexity

- **Schema**: Minimal (one field)
- **API**: Moderate (new response structure for consolidated mode)
- **UI**: Moderate (new conditional row section, modal changes)
- **Total**: Medium complexity, ~4-6 hours

## Open Questions

1. Should switching modes auto-convert existing assignments?
2. Should we allow mixing modes (some days consolidated, some per-county)?
3. Should the time blocks in consolidated mode be different from county mode?
