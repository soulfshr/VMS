# User Feedback Log

This document tracks user feedback for triage and resolution.

---

## Open Issues

### 1. Blurry "Next" button in guided tour (recurring)
- **Date Reported:** 2024-12-11
- **Reporter:** User
- **Location:** Dashboard welcome tour modal
- **Description:** The "Next" button text appears blurry in the onboarding tour popup
- **Screenshot:** Attached - "Blurry Next button"
- **Status:** ✅ Resolved (2024-12-11)
- **Priority:** Medium
- **Notes:** Fixed by adding explicit CSS overrides for text-shadow, webkit-text-stroke, and filter properties

### 2. Schedule page: day/date bar not sticky
- **Date Reported:** 2024-12-11
- **Reporter:** User
- **Location:** /schedule page
- **Description:** The filter section is sticky when scrolling, but the day/date header row doesn't stick. When scrolling down the schedule, users lose context of which day each column represents.
- **Screenshot:** Attached - "Sticky filter window, no sticky day/date bar"
- **Status:** ✅ Resolved (2024-12-11)
- **Priority:** High
- **Notes:** Fixed with internal scroll container and sticky thead within the table

### 3. Terminology: "Regional Lead" should be "Dispatch Coordinator"
- **Date Reported:** 2024-12-11
- **Reporter:** User
- **Location:** Schedule page, Dispatch Process documentation
- **Description:** The role is labeled as "Regional Lead" but should be "Dispatch Coordinator" per organization terminology
- **Screenshot:** Attached - "Should be Dispatch Coordinator"
- **Status:** ✅ Resolved (2024-12-11)
- **Priority:** Medium
- **Notes:** Updated UI labels in schedule page, modal, settings, email templates, and API messages. Internal code/database names remain unchanged.

### 4. Coordinator Console right margin issues
- **Date Reported:** 2024-12-11
- **Reporter:** User
- **Location:** /coordinator page
- **Description:** Layout/spacing issues with right margins on the Coordinator Console. Content appears cramped or misaligned.
- **Screenshot:** Attached - "Coordinator Console right margins"
- **Status:** ✅ Resolved (2024-12-11)
- **Priority:** Medium
- **Notes:** Fixed by adding responsive mobile navigation - sidebar hidden on mobile, replaced with horizontal tab navigation

### 5. Google Maps Marker API deprecation warning
- **Date Reported:** 2024-12-11
- **Reporter:** Console warning
- **Location:** Map components (mapping pages)
- **Description:** Console warning: "As of February 21st, 2024, google.maps.Marker is deprecated. Please use google.maps.marker.AdvancedMarkerElement instead."
- **Status:** Open
- **Priority:** Low
- **Notes:** Not urgent - Google says at least 12 months notice before discontinuation. Migration guide: https://developers.google.com/maps/documentation/javascript/advanced-markers/migration

---

## Feature Requests

### 1. Active training with videos and quizzes
- **Date Requested:** 2024-12-10
- **Requester:** User
- **Description:** Add interactive training modules with video content, quizzes, and progress tracking
- **Status:** Backlog
- **Priority:** Medium
- **Notes:** Could include onboarding videos, role-specific training, certification quizzes

### 2. Daily zone-level documents for dispatchers
- **Date Requested:** 2024-12-10
- **Requester:** User
- **Description:** Zone-level documents viewable by dispatchers for daily operations
- **Status:** Backlog
- **Priority:** Medium
- **Notes:** Could include zone briefings, special instructions, or operational notes

### 3. Daily schedule email reminder
- **Date Requested:** 2024-12-10
- **Requester:** User
- **Description:** Automated daily email showing the schedule for the next day
- **Status:** Backlog
- **Priority:** Medium
- **Notes:** Could be sent evening before to dispatchers/coordinators with next day's assignments

### 4. Weekly schedule email digest
- **Date Requested:** 2024-12-10
- **Requester:** User
- **Description:** Weekly email sent on Sundays showing the schedule for the upcoming week
- **Status:** ✅ Implemented (2024-12-11)
- **Priority:** Medium
- **Notes:** Implemented with configurable send time. Enable in Admin Settings → Email Notifications

### 5. Smart dispatcher staffing recommendations
- **Date Requested:** 2024-12-10
- **Requester:** User
- **Description:** Algorithm to recommend optimal number of dispatchers based on historical data
- **Status:** Backlog
- **Priority:** Low
- **Notes:** Could analyze past coverage, incident volume, volunteer availability patterns

### 6. MFA / Authenticator support
- **Date Requested:** 2024-12-10
- **Requester:** User
- **Description:** Add multi-factor authentication support for enhanced account security
- **Status:** Backlog
- **Priority:** Medium
- **Notes:** Could support TOTP authenticator apps (Google Authenticator, Authy, etc.), SMS backup codes

---

## Resolved Issues

### 1. Blurry button text in guided tour
- **Date Resolved:** 2024-12-10
- **Fix:** Added CSS font smoothing and GPU acceleration to tour buttons
- **Commit:** ad9cd6a

---

## How to Add Feedback

Add new issues under "Open Issues" with:
- Date reported
- Reporter (if known)
- Location in app
- Description of issue
- Screenshot reference (if available)
- Status: Open / In Progress / Resolved
- Priority: Critical / High / Medium / Low
