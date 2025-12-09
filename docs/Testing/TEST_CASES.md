# RippleVMS Test Cases

**Version:** 1.0
**Date:** December 2025

---

## Table of Contents

1. [Authentication Tests](#1-authentication-tests)
2. [Authorization Tests](#2-authorization-tests)
3. [Shift Management Tests](#3-shift-management-tests)
4. [Training System Tests](#4-training-system-tests)
5. [Sighting Report Tests](#5-sighting-report-tests)
6. [Email System Tests](#6-email-system-tests)
7. [Admin Configuration Tests](#7-admin-configuration-tests)
8. [Dashboard Tests](#8-dashboard-tests)
9. [Profile & Settings Tests](#9-profile--settings-tests)
10. [Zone & POI Tests](#10-zone--poi-tests)

---

## 1. Authentication Tests

### AUTH-001: Login with Email/Password

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /login | Login form displayed |
| 2 | Enter valid email and password | Fields accept input |
| 3 | Click "Sign In" | Redirect to /dashboard |
| 4 | Verify session cookie | httpOnly cookie set |

**Test Data:**
```typescript
{
  email: "volunteer@test.com",
  password: "TestPassword123!"
}
```

---

### AUTH-002: Login with Google OAuth

**Priority:** P0
**Type:** E2E

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /login | Login form with Google button |
| 2 | Click "Sign in with Google" | Redirect to Google OAuth |
| 3 | Complete Google authentication | Redirect back to /dashboard |
| 4 | Verify user created/updated | User record in database |

---

### AUTH-003: Login with Invalid Credentials

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter invalid email | Form validation error |
| 2 | Enter valid email, wrong password | "Invalid credentials" error |
| 3 | Verify no session created | No cookie set |

---

### AUTH-004: Password Reset Flow

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /forgot-password | Reset form displayed |
| 2 | Enter registered email | Success message shown |
| 3 | Verify reset email sent | Email contains reset link |
| 4 | Click reset link | Navigate to reset form |
| 5 | Enter new password | Password updated |
| 6 | Login with new password | Login successful |

---

### AUTH-005: Session Expiration

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login successfully | Session created |
| 2 | Wait for session expiry (or mock) | Session expires |
| 3 | Attempt protected route | Redirect to /login |

---

### AUTH-006: Logout

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login successfully | Session active |
| 2 | Click logout | Session cleared |
| 3 | Attempt protected route | Redirect to /login |

---

## 2. Authorization Tests

### PERM-001: Role-Based Route Protection

**Priority:** P0
**Type:** API

| Role | Route | Expected |
|------|-------|----------|
| VOLUNTEER | GET /api/shifts | 200 OK |
| VOLUNTEER | POST /api/shifts | 403 Forbidden |
| VOLUNTEER | GET /api/admin/settings | 403 Forbidden |
| COORDINATOR | POST /api/shifts | 201 Created |
| COORDINATOR | GET /api/volunteers | 200 OK |
| COORDINATOR | PUT /api/admin/settings | 403 Forbidden |
| ADMIN | PUT /api/admin/settings | 200 OK |
| ADMIN | DELETE /api/volunteers/[id] | 200 OK |

---

### PERM-002: Resource Ownership Check

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | User A creates resource | Resource owned by A |
| 2 | User B attempts to modify | 403 or 404 (depending on visibility) |
| 3 | Admin modifies resource | Success |

---

### PERM-003: API Authentication Required

**Priority:** P0
**Type:** API

| Route | Without Auth | With Auth |
|-------|--------------|-----------|
| GET /api/dashboard | 401 | 200 |
| GET /api/shifts | 401 | 200 |
| POST /api/shifts/[id]/rsvp | 401 | 200/201 |
| GET /api/profile | 401 | 200 |

---

## 3. Shift Management Tests

### SHIFT-001: Create Shift (Coordinator)

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/shifts with valid data | 201 Created |
| 2 | Verify shift in database | Shift record exists |
| 3 | Verify response contains shift | ID and fields returned |

**Test Data:**
```typescript
{
  title: "Morning Patrol - Downtown",
  shiftTypeId: "type-zone-patrol",
  zoneId: "zone-durham-1",
  date: "2025-12-15",
  startTime: "08:00",
  endTime: "12:00",
  minVolunteers: 2,
  maxVolunteers: 6,
  description: "Regular morning patrol shift"
}
```

---

### SHIFT-002: Create Shift Validation

**Priority:** P1
**Type:** API

| Input | Expected Error |
|-------|----------------|
| Missing title | "Title is required" |
| Past date | "Date must be in the future" |
| End time before start | "End time must be after start time" |
| Max < min volunteers | "Max must be >= min" |
| Invalid zone ID | "Zone not found" |

---

### SHIFT-003: Volunteer RSVP to Shift

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/shifts/[id] as volunteer | Shift details returned |
| 2 | POST /api/shifts/[id]/rsvp | 201 Created, status=PENDING |
| 3 | Verify ShiftVolunteer record | Record exists with PENDING |
| 4 | Attempt duplicate RSVP | 409 Conflict |

---

### SHIFT-004: Coordinator Confirms RSVP

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create shift with PENDING RSVP | RSVP exists |
| 2 | POST /api/shifts/confirm-rsvps | RSVPs updated |
| 3 | Verify status = CONFIRMED | Database updated |
| 4 | Verify confirmation email sent | Email mock called |

---

### SHIFT-005: Shift Capacity Enforcement

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create shift with maxVolunteers=2 | Shift created |
| 2 | RSVP volunteer 1 | Success, PENDING |
| 3 | RSVP volunteer 2 | Success, PENDING |
| 4 | Confirm both | Both CONFIRMED |
| 5 | RSVP volunteer 3 | 400 "Shift is full" |

---

### SHIFT-006: Cancel Shift

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create shift with confirmed volunteers | Shift exists |
| 2 | POST /api/shifts/cancel | Status = CANCELLED |
| 3 | Verify cancellation emails sent | Emails to all confirmed |
| 4 | Verify RSVPs updated | All RSVPs cancelled |

---

### SHIFT-007: Edit Shift

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/shifts/[id] with new data | 200 OK |
| 2 | Verify changes persisted | Database updated |
| 3 | Attempt edit of CANCELLED shift | 400 Error |
| 4 | Attempt edit of past shift | 400 Error |

---

### SHIFT-008: Delete Shift

**Priority:** P2
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | DELETE /api/shifts/[id] (no RSVPs) | 200 OK |
| 2 | Shift removed from database | Record deleted |
| 3 | DELETE shift with RSVPs | 400 "Has RSVPs" |

---

### SHIFT-009: Shadow Role Doesn't Count Toward Minimum

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create shift with minVolunteers=2 | Shift created |
| 2 | Add 1 volunteer with counting role | confirmedCount=1 |
| 3 | Add 1 volunteer with shadow role | confirmedCount still 1 |
| 4 | Verify shift shows "needs 1 more" | UI reflects count |
| 5 | Add 1 more counting volunteer | confirmedCount=2, ready |

---

## 4. Training System Tests

### TRAIN-001: Create Training Session

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/trainings with valid data | 201 Created |
| 2 | Verify session in database | Record exists |
| 3 | Verify linked to training type | Type relationship set |

---

### TRAIN-002: RSVP to Training

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/trainings/[id]/rsvp | 201 Created |
| 2 | Verify attendee record | Status = PENDING |
| 3 | Attempt duplicate RSVP | 409 Conflict |

---

### TRAIN-003: Complete Training Grants Qualification

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create training type that grants "VERIFIER" | Type configured |
| 2 | Create session, volunteer RSVPs | Attendee exists |
| 3 | Mark attendee as COMPLETED | completedAt set |
| 4 | Verify UserQualification created | Qualification record exists |
| 5 | Verify expiresAt calculated | Based on training type |

---

### TRAIN-004: Training Capacity Enforcement

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create session with maxAttendees=5 | Session created |
| 2 | RSVP 5 attendees | All accepted |
| 3 | Attempt 6th RSVP | 400 "Training is full" |

---

## 5. Sighting Report Tests

### SIGHT-001: Submit Public Sighting Report

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/sightings (public endpoint) | 201 Created |
| 2 | Verify sighting in database | Record exists, status=NEW |
| 3 | Verify dispatcher notified | Notification email sent |

**Test Data:**
```typescript
{
  size: "3-5",
  activity: "Vehicle checkpoint",
  location: "Main St & 5th Ave",
  latitude: 35.9940,
  longitude: -78.8986,
  time: "2025-12-15T14:30:00Z",
  uniform: "Plain clothes, tactical vests",
  equipment: "Radios, unmarked SUVs"
}
```

---

### SIGHT-002: Sighting Status Workflow

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create sighting | Status = NEW |
| 2 | Dispatcher reviews | Status = REVIEWING |
| 3 | Dispatcher verifies | Status = VERIFIED |
| 4 | Response dispatched | Status = RESPONDED |
| 5 | Close sighting | Status = CLOSED |

---

### SIGHT-003: Upload Sighting Media

**Priority:** P2
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/upload with image | 200 OK, URL returned |
| 2 | Attach media to sighting | SightingMedia record created |
| 3 | Verify file in blob storage | File accessible |

---

## 6. Email System Tests

### EMAIL-001: Shift Confirmation Email

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Confirm volunteer RSVP | RSVP status updated |
| 2 | Verify email sent | Mock called with correct template |
| 3 | Verify recipient | Volunteer's email address |
| 4 | Verify content | Shift details included |

---

### EMAIL-002: Password Reset Email

**Priority:** P0
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request password reset | API returns success |
| 2 | Verify email sent | Mock called |
| 3 | Verify reset token | Token in email link |
| 4 | Token expires after 24h | Token validation fails after expiry |

---

### EMAIL-003: Email Blast with Filters

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create blast with zone filter | Blast created |
| 2 | Send blast | Only zone volunteers receive |
| 3 | Verify recipient count | Matches filtered users |

**Filter Test Matrix:**
```typescript
const filters = [
  { zones: ["zone-durham-1"] },
  { roles: ["COORDINATOR", "ADMIN"] },
  { qualifiedRoles: ["verifier"] },
  { languages: ["Spanish"] },
  { hasQualifications: true },
];
```

---

### EMAIL-004: Unsubscribe Flow

**Priority:** P1
**Type:** Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click unsubscribe link in email | Navigate to unsubscribe page |
| 2 | Confirm unsubscribe | User.emailNotifications = false |
| 3 | Future blasts skip user | User not in recipient list |

---

## 7. Admin Configuration Tests

### ADMIN-001: Create Qualified Role

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/admin/qualified-roles | 201 Created |
| 2 | Verify role in database | Record exists |
| 3 | Role available in shift creation | Shows in dropdown |

---

### ADMIN-002: Create Shift Type

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/admin/shift-types | 201 Created |
| 2 | Configure default capacity | Defaults applied to new shifts |

---

### ADMIN-003: Create Training Type

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/admin/training-types | 201 Created |
| 2 | Link to qualified role | grantsQualifiedRoleId set |
| 3 | Set expiration days | expiresAfterDays set |

---

### ADMIN-004: Organization Settings

**Priority:** P2
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/admin/settings | 200 OK |
| 2 | Verify settings persisted | Database updated |
| 3 | Verify email uses new branding | From name/address updated |

---

## 8. Dashboard Tests

### DASH-001: Volunteer Dashboard Data

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/dashboard as volunteer | 200 OK |
| 2 | Verify upcoming shifts | Only user's confirmed shifts |
| 3 | Verify training status | User's training progress |
| 4 | Verify volunteer hours | Calculated correctly |

---

### DASH-002: Coordinator Dashboard Data

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/dashboard as coordinator | 200 OK |
| 2 | Includes pending RSVPs | RSVPs awaiting confirmation |
| 3 | Includes understaffed shifts | Shifts needing volunteers |

---

### DASH-003: Admin Dashboard Data

**Priority:** P2
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/dashboard as admin | 200 OK |
| 2 | Includes system statistics | User counts, shift stats |

---

## 9. Profile & Settings Tests

### PROF-001: Update Profile

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/profile with new data | 200 OK |
| 2 | Verify changes persisted | Database updated |
| 3 | Cannot change email (security) | Email field ignored |

---

### PROF-002: Update Availability

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/profile/availability | 200 OK |
| 2 | Verify availability records | Database updated |

---

### PROF-003: Update Zone Preferences

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/profile/zones | 200 OK |
| 2 | Verify UserZone records | Zones linked to user |

---

## 10. Zone & POI Tests

### ZONE-001: Create Zone

**Priority:** P1
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/admin/zones | 201 Created |
| 2 | Verify zone in database | Record exists |
| 3 | Zone available for shifts | Shows in zone dropdown |

---

### ZONE-002: Update Zone Boundaries

**Priority:** P2
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/admin/zones/[id] with GeoJSON | 200 OK |
| 2 | Verify boundaries stored | GeoJSON in database |

---

### POI-001: Create POI

**Priority:** P2
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/admin/pois | 201 Created |
| 2 | Verify POI in database | Record exists |
| 3 | POI visible on map | Shows for users |

---

### POI-002: POI Category

**Priority:** P2
**Type:** API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/admin/poi-categories | 201 Created |
| 2 | Create POI with category | POI linked to category |
| 3 | Map shows category color/icon | Visual differentiation |

---

## Appendix: Test Data Requirements

### Users (Fixtures)

```typescript
export const testUsers = {
  volunteer: {
    id: 'user-volunteer-1',
    email: 'volunteer@test.com',
    name: 'Test Volunteer',
    role: 'VOLUNTEER',
    password: 'TestPassword123!',
  },
  coordinator: {
    id: 'user-coordinator-1',
    email: 'coordinator@test.com',
    name: 'Test Coordinator',
    role: 'COORDINATOR',
    password: 'TestPassword123!',
  },
  dispatcher: {
    id: 'user-dispatcher-1',
    email: 'dispatcher@test.com',
    name: 'Test Dispatcher',
    role: 'DISPATCHER',
    password: 'TestPassword123!',
  },
  admin: {
    id: 'user-admin-1',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMINISTRATOR',
    password: 'TestPassword123!',
  },
};
```

### Zones (Fixtures)

```typescript
export const testZones = {
  durham1: {
    id: 'zone-durham-1',
    name: 'Durham 1',
    county: 'DURHAM',
    active: true,
  },
  orange1: {
    id: 'zone-orange-1',
    name: 'Orange 1',
    county: 'ORANGE',
    active: true,
  },
};
```

### Shift Types (Fixtures)

```typescript
export const testShiftTypes = {
  zonePatrol: {
    id: 'type-zone-patrol',
    name: 'Zone Patrol',
    slug: 'zone-patrol',
    defaultDurationMinutes: 240,
    defaultMinVolunteers: 2,
    defaultMaxVolunteers: 6,
  },
  onCall: {
    id: 'type-on-call',
    name: 'On-Call',
    slug: 'on-call',
    defaultDurationMinutes: 480,
    defaultMinVolunteers: 1,
    defaultMaxVolunteers: 3,
  },
};
```

---

*Last Updated: December 2025*
