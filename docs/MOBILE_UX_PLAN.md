# Mobile UX Improvement Plan

## Priority Focus: Shift Signup Experience

This plan addresses mobile usability issues, prioritized by user impact and frequency of use.

---

## Priority 1: Critical - Shift Browsing & Signup (High Traffic)

### 1.1 Shift List View Table → Mobile Cards
**File:** `src/app/shifts/page.tsx` (Lines 658-778)

**Current Problem:**
- Table layout completely broken on mobile
- Columns overlap and become unreadable
- Action buttons (Sign Up, Cancel) are tiny and hard to tap

**Solution:**
- Hide table on mobile, show card view by default
- OR replace table with responsive card layout on `sm:` breakpoint
- Increase button tap targets to minimum 44px height

**Changes:**
```tsx
// Wrap table in md:block hidden
<div className="hidden md:block">
  <table>...</table>
</div>

// Show cards on mobile
<div className="md:hidden">
  {shifts.map(shift => <ShiftCard key={shift.id} />)}
</div>
```

**Impact:** High - Most users browse shifts on mobile

---

### 1.2 Sign Up Button Size & Placement
**File:** `src/app/shifts/page.tsx` (Lines 740-774)

**Current Problem:**
- `text-xs px-3 py-1` buttons are too small for reliable touch
- Multiple actions crammed together

**Solution:**
- Increase to `text-sm px-4 py-2` minimum
- Stack actions vertically on mobile
- Make "Sign Up" button full-width and prominent on mobile cards

**Impact:** Critical - This is the primary user action

---

### 1.3 Header Layout Collision
**File:** `src/app/shifts/page.tsx` (Lines 505-526)

**Current Problem:**
- Title and buttons fight for space on narrow screens

**Solution:**
```tsx
<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
  <h1>Browse Shifts</h1>
  <div className="flex gap-2">
    {/* buttons */}
  </div>
</div>
```

**Impact:** Medium - Visual polish

---

## Priority 2: High - Shift Detail & RSVP

### 2.1 Shift Detail Page Layout
**File:** `src/app/shifts/[id]/page.tsx`

**Current Problem:**
- Volunteer action buttons cramped together (Lines 225-258)
- Status message and Cancel button on same row

**Solution:**
- Stack vertically on mobile with `flex-col sm:flex-row`
- Make action buttons full-width on mobile
- Increase touch targets

**Impact:** High - Users access this to manage their signups

---

### 2.2 Roster Stats Grid
**File:** `src/app/shifts/[id]/roster/page.tsx` (Line 301)

**Current Problem:**
- `grid grid-cols-3` without responsive breakpoint
- Numbers/text can overflow on small screens

**Solution:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
```

**Impact:** Medium - Coordinators use this on mobile

---

## Priority 3: Medium - Shift Creation/Editing (Admin)

### 3.1 Create Shift Form
**File:** `src/app/shifts/create/page.tsx` (Lines 278, 463)

**Current Problem:**
- `grid grid-cols-3` layout without ANY breakpoints
- All form fields squashed horizontally on mobile
- Completely unusable on phones

**Solution:**
```tsx
// Change from:
<div className="grid grid-cols-3 gap-4">

// To:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

**Impact:** Medium - Only coordinators create shifts, but they may do so on mobile

---

### 3.2 Edit Shift Form
**File:** `src/app/shifts/[id]/edit/page.tsx` (Lines 264, 332)

**Same issues and solutions as 3.1**

---

## Priority 4: Lower - Calendar & Filters

### 4.1 Calendar View Height
**File:** `src/app/shifts/calendar/page.tsx` (Line 107)

**Current Problem:**
- Fixed 700px height doesn't adapt to mobile

**Solution:**
- Use `h-[500px] sm:h-[600px] md:h-[700px]`
- Or calculate based on viewport height

---

### 4.2 Filter Panel Layout
**File:** `src/app/shifts/page.tsx` (Lines 575-652)

**Current Problem:**
- Filters and legend don't stack on mobile
- View toggle buttons don't have mobile breakpoints

**Solution:**
- Stack filters vertically on mobile
- Collapse legend into expandable section or move below filters

---

### 4.3 Calendar Legend
**File:** `src/app/shifts/calendar/page.tsx` (Lines 228-245)

**Current Problem:**
- Four color legend items in horizontal row
- Doesn't wrap on mobile

**Solution:**
```tsx
<div className="flex flex-wrap gap-2 sm:gap-4 justify-center sm:justify-end">
```

---

## Implementation Phases

### Phase 1: Quick Wins (1-2 hours)
- [ ] Increase button sizes across shifts pages
- [ ] Add `flex-col sm:flex-row` to header layouts
- [ ] Make filter sections wrap properly

### Phase 2: Shift List Mobile Redesign (2-3 hours)
- [ ] Default to card view on mobile (`md:hidden` / `hidden md:block`)
- [ ] Enhance shift cards with larger tap targets
- [ ] Stack action buttons vertically

### Phase 3: Forms Responsive (2-3 hours)
- [ ] Add breakpoints to create/edit shift grids
- [ ] Stack form sections vertically on mobile
- [ ] Ensure all inputs are touch-friendly

### Phase 4: Detail Pages (1-2 hours)
- [ ] Fix shift detail page action buttons
- [ ] Make roster management mobile-friendly
- [ ] Add responsive breakpoints to stat grids

### Phase 5: Calendar Polish (1 hour)
- [ ] Responsive calendar height
- [ ] Legend wrapping
- [ ] Mobile-friendly date navigation

---

## Mobile Design Guidelines (Going Forward)

### Touch Targets
- Minimum 44x44px for all interactive elements
- Use `py-3 px-4` minimum for buttons on mobile

### Typography
- Body text: minimum 16px (`text-base`)
- Use `text-sm` sparingly, never smaller on mobile

### Layout
- Mobile-first approach: start with single column
- Add columns at `sm:` (640px) and `md:` (768px)
- Stack navigation and actions vertically on mobile

### Testing
- Test all changes at 375px width (iPhone SE)
- Test at 390px width (iPhone 14)
- Test at 412px width (Android common)

---

## Files to Modify (Summary)

| File | Priority | Changes |
|------|----------|---------|
| `src/app/shifts/page.tsx` | P1 | Table/card view, header, buttons, filters |
| `src/app/shifts/[id]/page.tsx` | P2 | Action buttons, layout |
| `src/app/shifts/[id]/roster/page.tsx` | P2 | Stats grid, volunteer cards |
| `src/app/shifts/create/page.tsx` | P3 | Form grid breakpoints |
| `src/app/shifts/[id]/edit/page.tsx` | P3 | Form grid breakpoints |
| `src/app/shifts/calendar/page.tsx` | P4 | Height, legend, filters |

---

## Success Metrics

- All pages usable at 375px width without horizontal scrolling
- All buttons/links meet 44px minimum tap target
- Shift signup can be completed in <3 taps on mobile
- No text overlap or truncation issues
