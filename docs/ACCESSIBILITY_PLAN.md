# Accessibility Implementation Plan

**Target:** WCAG 2.1 AA Compliance
**Created:** December 2025
**Estimated Total Effort:** 15-20 hours

---

## Current State Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | Partial | Alt text present, decorative elements need aria-hidden |
| 1.4.3 Contrast Minimum | TBD | Audit gray-500/gray-400 text colors |
| 2.1.1 Keyboard | Partial | Focus indicators present, no focus trap in modals |
| 2.4.1 Bypass Blocks | FAIL | No skip-to-content link |
| 2.4.7 Focus Visible | Pass | Focus indicators present |
| 4.1.2 Name, Role, Value | Fail | Missing roles, aria-expanded, aria-hidden |
| 4.1.3 Status Messages | Fail | No aria-live regions |

**Overall Compliance:** ~40-50% of WCAG 2.1 AA requirements met

---

## Phase 1: Critical Fixes (Zero Risk)

**Effort:** 4-6 hours
**Risk Level:** None - purely additive HTML attributes and CSS

### 1.1 Skip-to-Content Link
**File:** `src/app/layout.tsx`

Add before the header:
```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:ring-2 focus:ring-teal-500"
>
  Skip to main content
</a>
```

Add to main element:
```tsx
<main id="main-content" tabIndex={-1}>
```

### 1.2 Modal Dialog Roles
**Files:**
- `src/components/schedule/AssignmentModal.tsx`
- `src/components/FeedbackWidget.tsx`
- `src/components/ZoneMapModal.tsx`

Add to modal container:
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">...</h2>
</div>
```

### 1.3 Menu Toggle Accessibility
**File:** `src/components/layout/Header.tsx`

Update user menu button:
```tsx
<button
  onClick={() => setIsMenuOpen(!isMenuOpen)}
  aria-expanded={isMenuOpen}
  aria-haspopup="menu"
  aria-label="User menu"
>
```

Update mobile menu button:
```tsx
<button
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  aria-expanded={mobileMenuOpen}
  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
>
```

### 1.4 Icon Button Labels
**Files:** Header.tsx, modal components

Add aria-label to all icon-only buttons:
```tsx
<button aria-label="Close modal">
  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
</button>
```

### 1.5 Reduced Motion Support
**File:** `src/app/globals.css`

Add at end of file:
```css
/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 1.6 Decorative Icon Hiding
**All files with decorative SVG icons**

Add to decorative icons:
```tsx
<CheckIcon className="h-5 w-5" aria-hidden="true" />
```

---

## Phase 2: Focus Management (Low Risk)

**Effort:** 3-4 hours
**Risk Level:** Low - new hook and component updates

### 2.1 Create Focus Trap Hook
**New File:** `src/hooks/useFocusTrap.ts`

```tsx
import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements
    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus on close
      previousActiveElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}
```

### 2.2 Apply Focus Trap to Modals
**Files:** All modal components

```tsx
import { useFocusTrap } from '@/hooks/useFocusTrap';

function Modal({ isOpen, onClose }) {
  const focusTrapRef = useFocusTrap(isOpen);

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true">
      {/* modal content */}
    </div>
  );
}
```

---

## Phase 3: Live Regions & Announcements

**Effort:** 2-3 hours
**Risk Level:** None - additive only

### 3.1 Success/Error Message Announcements
**Files:** `src/app/profile/page.tsx`, admin pages

Add aria-live region:
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {statusMessage}
</div>
```

Or for visible messages:
```tsx
{saved && (
  <div role="status" aria-live="polite" className="text-green-600">
    Changes saved successfully
  </div>
)}
```

### 3.2 RSVP Confirmation Announcements
**File:** Schedule components

```tsx
<div aria-live="polite" className="sr-only">
  {rsvpStatus === 'confirmed' && 'Your RSVP has been confirmed'}
  {rsvpStatus === 'pending' && 'Your RSVP is pending confirmation'}
</div>
```

---

## Phase 4: Form Accessibility

**Effort:** 2-3 hours
**Risk Level:** None - additive attributes

### 4.1 Error State Attributes
**Files:** All form components

```tsx
<input
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
  aria-required={required}
/>
{error && (
  <p id="email-error" role="alert" className="text-red-600 text-sm">
    {error}
  </p>
)}
```

### 4.2 Required Field Indicators
```tsx
<label>
  Email <span aria-hidden="true">*</span>
  <span className="sr-only">(required)</span>
</label>
```

---

## Phase 5: Color & Contrast Audit

**Effort:** 1-2 hours
**Risk Level:** Low

### 5.1 Audit Process
1. Install axe DevTools browser extension
2. Run on each major page: Dashboard, Schedule, Profile, Admin
3. Document all contrast failures

### 5.2 Known Concerns
| Class | Usage | Potential Issue |
|-------|-------|-----------------|
| `text-gray-400` | Placeholder text, dates | May fail 4.5:1 on white |
| `text-gray-500` | Secondary text | Borderline compliance |
| `text-teal-600` | Links, buttons | Verify on backgrounds |

### 5.3 Remediation Options
If failures found:
- Replace `text-gray-400` with `text-gray-500` for important text
- Replace `text-gray-500` with `text-gray-600` where needed
- Use `text-gray-700` for body text

---

## Implementation Checklist

### Phase 1 - Critical (Do First)
- [ ] Add skip-to-content link to layout.tsx
- [ ] Add `id="main-content"` to main element
- [ ] Add `role="dialog"` to AssignmentModal
- [ ] Add `role="dialog"` to FeedbackWidget
- [ ] Add `role="dialog"` to ZoneMapModal
- [ ] Add `aria-expanded` to Header user menu toggle
- [ ] Add `aria-expanded` to Header mobile menu toggle
- [ ] Add `aria-label` to mobile menu button
- [ ] Add `aria-hidden="true"` to decorative icons in Header
- [ ] Add reduced-motion CSS to globals.css

### Phase 2 - Focus Management
- [ ] Create useFocusTrap hook
- [ ] Apply focus trap to AssignmentModal
- [ ] Apply focus trap to FeedbackWidget
- [ ] Apply focus trap to ZoneMapModal
- [ ] Test focus restoration on modal close

### Phase 3 - Live Regions
- [ ] Add aria-live to profile save confirmation
- [ ] Add aria-live to admin settings save
- [ ] Add aria-live to RSVP confirmations
- [ ] Add aria-live to error messages

### Phase 4 - Forms
- [ ] Add aria-invalid to form inputs with errors
- [ ] Add aria-describedby linking errors to inputs
- [ ] Add aria-required to required fields
- [ ] Add role="alert" to error messages

### Phase 5 - Contrast
- [ ] Run axe DevTools audit on all pages
- [ ] Document contrast failures
- [ ] Fix any failing color combinations

---

## Testing Plan

### Manual Testing
1. **Keyboard Navigation:** Tab through entire application without mouse
2. **Screen Reader:** Test with VoiceOver (Mac) or NVDA (Windows)
3. **Focus Visibility:** Ensure focus ring visible on all interactive elements
4. **Motion:** Enable reduced-motion preference and verify animations stop

### Automated Testing
1. Run `axe DevTools` browser extension on:
   - `/dashboard`
   - `/schedule`
   - `/profile`
   - `/admin/settings`
   - `/volunteers`
   - `/report` (public sighting form)

### Acceptance Criteria
- [ ] No critical axe violations
- [ ] All modals trap focus correctly
- [ ] Skip link works and is visible on focus
- [ ] All interactive elements have accessible names
- [ ] Status messages announced to screen readers

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN ARIA Authoring Practices](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)

---

*Last Updated: December 2025*
