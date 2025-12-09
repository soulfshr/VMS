# End-to-End Test Scenarios

**Version:** 1.0
**Date:** December 2025
**Framework:** Playwright

---

## Overview

This document defines the critical user journeys that must be validated through end-to-end testing before v1 launch. These tests simulate real user behavior in a browser environment.

---

## Test User Accounts

```typescript
// e2e/fixtures/users.ts
export const testUsers = {
  volunteer: {
    email: 'e2e-volunteer@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Volunteer',
  },
  coordinator: {
    email: 'e2e-coordinator@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Coordinator',
  },
  admin: {
    email: 'e2e-admin@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Admin',
  },
};
```

---

## Scenario 1: Volunteer Registration & First Shift

**Priority:** P0
**Duration:** ~3 minutes

### Journey

```gherkin
Feature: New Volunteer Onboarding

Scenario: New volunteer signs up and RSVPs to their first shift
  Given I am a new community member
  When I navigate to the registration page
  And I fill in my details
  And I verify my email
  Then I should be logged in to the dashboard

  When I navigate to available shifts
  And I find a shift in my zone
  And I click RSVP
  Then I should see my RSVP status as "Pending"
  And I should see the shift in "My Upcoming Shifts"
```

### Test Implementation

```typescript
// e2e/volunteer-registration.spec.ts
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

test.describe('Volunteer Registration Journey', () => {
  const newUser = {
    email: faker.internet.email(),
    password: 'TestPassword123!',
    name: faker.person.fullName(),
    phone: faker.phone.number(),
  };

  test('new volunteer can register and RSVP to shift', async ({ page }) => {
    // Step 1: Navigate to registration
    await page.goto('/register');
    await expect(page).toHaveTitle(/Register/);

    // Step 2: Fill registration form
    await page.fill('[name="name"]', newUser.name);
    await page.fill('[name="email"]', newUser.email);
    await page.fill('[name="password"]', newUser.password);
    await page.fill('[name="confirmPassword"]', newUser.password);
    await page.fill('[name="phone"]', newUser.phone);

    // Step 3: Submit and verify success
    await page.click('button[type="submit"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // Step 4: Login (for e2e, we may auto-login or need to verify email)
    await page.goto('/login');
    await page.fill('[name="email"]', newUser.email);
    await page.fill('[name="password"]', newUser.password);
    await page.click('button[type="submit"]');

    // Step 5: Verify dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Step 6: Navigate to shifts
    await page.click('[data-testid="nav-shifts"]');
    await page.waitForURL('/shifts');

    // Step 7: Find and RSVP to a shift
    const shiftCard = page.locator('[data-testid^="shift-"]').first();
    await shiftCard.click();

    // Step 8: RSVP
    await page.click('[data-testid="rsvp-button"]');
    await expect(page.locator('.toast-success')).toContainText('RSVP');

    // Step 9: Verify in dashboard
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="upcoming-shifts"]')).toContainText('Pending');
  });
});
```

---

## Scenario 2: Coordinator Creates and Manages Shift

**Priority:** P0
**Duration:** ~2 minutes

### Journey

```gherkin
Feature: Coordinator Shift Management

Scenario: Coordinator creates a shift and confirms volunteers
  Given I am logged in as a Coordinator
  When I navigate to create shift page
  And I fill in shift details
  And I click "Create Shift"
  Then the shift should be created successfully

  When volunteers RSVP to my shift
  And I navigate to the shift roster
  And I select pending RSVPs
  And I click "Confirm"
  Then the RSVPs should be confirmed
  And confirmation emails should be sent
```

### Test Implementation

```typescript
// e2e/coordinator-shift-management.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Coordinator Shift Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as coordinator
    await page.goto('/login');
    await page.fill('[name="email"]', testUsers.coordinator.email);
    await page.fill('[name="password"]', testUsers.coordinator.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('coordinator can create shift and confirm volunteers', async ({ page }) => {
    // Step 1: Navigate to create shift
    await page.click('[data-testid="nav-shifts"]');
    await page.click('[data-testid="create-shift-button"]');
    await page.waitForURL('/shifts/create');

    // Step 2: Fill shift form
    await page.fill('[name="title"]', 'E2E Test Shift');
    await page.selectOption('[name="shiftTypeId"]', { index: 1 });
    await page.selectOption('[name="zoneId"]', { index: 1 });

    // Set date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[name="date"]', tomorrow.toISOString().split('T')[0]);

    await page.fill('[name="startTime"]', '09:00');
    await page.fill('[name="endTime"]', '13:00');
    await page.fill('[name="minVolunteers"]', '2');
    await page.fill('[name="maxVolunteers"]', '6');

    // Step 3: Create shift
    await page.click('[data-testid="create-shift-submit"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // Step 4: Get shift ID from URL or response
    await page.waitForURL(/\/shifts\/\w+/);
    const shiftUrl = page.url();

    // Step 5: Navigate to roster
    await page.click('[data-testid="view-roster-button"]');
    await expect(page.locator('h1')).toContainText('Roster');

    // At this point, in a real test, we'd need volunteers to have RSVPed
    // For E2E, we can either:
    // - Pre-seed the database with RSVPs
    // - Have another browser context RSVP
    // - Skip to verification of empty roster

    await expect(page.locator('[data-testid="roster-table"]')).toBeVisible();
  });

  test('coordinator can confirm pending RSVPs', async ({ page }) => {
    // Navigate to a pre-seeded shift with pending RSVPs
    await page.goto('/shifts/test-shift-with-rsvps/roster');

    // Select pending RSVPs
    await page.click('[data-testid="select-all-pending"]');

    // Confirm
    await page.click('[data-testid="confirm-selected"]');

    // Verify success
    await expect(page.locator('.toast-success')).toContainText('confirmed');

    // Verify RSVPs now show as confirmed
    await expect(page.locator('[data-testid="status-confirmed"]')).toHaveCount(
      await page.locator('[data-testid^="rsvp-row-"]').count()
    );
  });
});
```

---

## Scenario 3: Complete Shift RSVP Flow

**Priority:** P0
**Duration:** ~4 minutes

### Journey

```gherkin
Feature: Complete RSVP Lifecycle

Scenario: Full RSVP flow from creation to confirmation
  Given a Coordinator creates a shift
  And a Volunteer RSVPs to the shift
  When the Coordinator confirms the RSVP
  Then the Volunteer sees confirmed status
  And the Volunteer receives confirmation email
```

### Test Implementation

```typescript
// e2e/rsvp-lifecycle.spec.ts
import { test, expect, Browser, Page } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Complete RSVP Lifecycle', () => {
  let coordinatorPage: Page;
  let volunteerPage: Page;

  test('full RSVP lifecycle with confirmation', async ({ browser }) => {
    // Create two browser contexts for different users
    const coordinatorContext = await browser.newContext();
    const volunteerContext = await browser.newContext();

    coordinatorPage = await coordinatorContext.newPage();
    volunteerPage = await volunteerContext.newPage();

    // --- COORDINATOR: Create Shift ---
    await coordinatorPage.goto('/login');
    await coordinatorPage.fill('[name="email"]', testUsers.coordinator.email);
    await coordinatorPage.fill('[name="password"]', testUsers.coordinator.password);
    await coordinatorPage.click('button[type="submit"]');
    await coordinatorPage.waitForURL('/dashboard');

    await coordinatorPage.goto('/shifts/create');
    await coordinatorPage.fill('[name="title"]', 'Lifecycle Test Shift');
    await coordinatorPage.selectOption('[name="shiftTypeId"]', { index: 1 });
    await coordinatorPage.selectOption('[name="zoneId"]', { index: 1 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await coordinatorPage.fill('[name="date"]', tomorrow.toISOString().split('T')[0]);
    await coordinatorPage.fill('[name="startTime"]', '09:00');
    await coordinatorPage.fill('[name="endTime"]', '13:00');

    await coordinatorPage.click('[data-testid="create-shift-submit"]');
    await coordinatorPage.waitForURL(/\/shifts\/\w+/);
    const shiftId = coordinatorPage.url().split('/').pop();

    // --- VOLUNTEER: RSVP to Shift ---
    await volunteerPage.goto('/login');
    await volunteerPage.fill('[name="email"]', testUsers.volunteer.email);
    await volunteerPage.fill('[name="password"]', testUsers.volunteer.password);
    await volunteerPage.click('button[type="submit"]');
    await volunteerPage.waitForURL('/dashboard');

    await volunteerPage.goto(`/shifts/${shiftId}`);
    await volunteerPage.click('[data-testid="rsvp-button"]');
    await expect(volunteerPage.locator('.toast-success')).toBeVisible();
    await expect(volunteerPage.locator('[data-testid="rsvp-status"]')).toContainText('Pending');

    // --- COORDINATOR: Confirm RSVP ---
    await coordinatorPage.goto(`/shifts/${shiftId}/roster`);
    await coordinatorPage.click('[data-testid="select-all-pending"]');
    await coordinatorPage.click('[data-testid="confirm-selected"]');
    await expect(coordinatorPage.locator('.toast-success')).toBeVisible();

    // --- VOLUNTEER: Verify Confirmation ---
    await volunteerPage.reload();
    await expect(volunteerPage.locator('[data-testid="rsvp-status"]')).toContainText('Confirmed');

    // Cleanup
    await coordinatorContext.close();
    await volunteerContext.close();
  });
});
```

---

## Scenario 4: Training Session Completion

**Priority:** P1
**Duration:** ~3 minutes

### Journey

```gherkin
Feature: Training Session Workflow

Scenario: Volunteer completes training and earns qualification
  Given a Training Session exists
  And I am a Volunteer
  When I RSVP to the training
  And the Coordinator marks me as completed
  Then I should receive the associated qualification
  And I should see it on my profile
```

### Test Implementation

```typescript
// e2e/training-completion.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Training Completion', () => {
  test('volunteer earns qualification after training completion', async ({ browser }) => {
    const coordinatorContext = await browser.newContext();
    const volunteerContext = await browser.newContext();

    const coordinatorPage = await coordinatorContext.newPage();
    const volunteerPage = await volunteerContext.newPage();

    // Pre-condition: Training session exists (seeded in database)
    const trainingId = 'test-training-session-id';

    // --- VOLUNTEER: RSVP to Training ---
    await volunteerPage.goto('/login');
    await volunteerPage.fill('[name="email"]', testUsers.volunteer.email);
    await volunteerPage.fill('[name="password"]', testUsers.volunteer.password);
    await volunteerPage.click('button[type="submit"]');

    await volunteerPage.goto(`/trainings/${trainingId}`);
    await volunteerPage.click('[data-testid="rsvp-button"]');
    await expect(volunteerPage.locator('.toast-success')).toBeVisible();

    // --- COORDINATOR: Mark as Completed ---
    await coordinatorPage.goto('/login');
    await coordinatorPage.fill('[name="email"]', testUsers.coordinator.email);
    await coordinatorPage.fill('[name="password"]', testUsers.coordinator.password);
    await coordinatorPage.click('button[type="submit"]');

    await coordinatorPage.goto(`/trainings/${trainingId}/roster`);

    // Find the volunteer and mark completed
    const volunteerRow = coordinatorPage.locator(`[data-testid="attendee-${testUsers.volunteer.email}"]`);
    await volunteerRow.locator('[data-testid="mark-completed"]').click();
    await expect(coordinatorPage.locator('.toast-success')).toBeVisible();

    // --- VOLUNTEER: Verify Qualification ---
    await volunteerPage.goto('/profile');
    await expect(volunteerPage.locator('[data-testid="qualifications-list"]')).toContainText('Verifier');

    await coordinatorContext.close();
    await volunteerContext.close();
  });
});
```

---

## Scenario 5: Public Sighting Report

**Priority:** P1
**Duration:** ~2 minutes

### Journey

```gherkin
Feature: Public Sighting Report

Scenario: Community member submits sighting report
  Given I am on the public report page
  When I fill in the SALUTE information
  And I optionally upload an image
  And I submit the report
  Then the sighting should be created
  And dispatchers should be notified
```

### Test Implementation

```typescript
// e2e/public-sighting-report.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Public Sighting Report', () => {
  test('anonymous user can submit sighting report', async ({ page }) => {
    // Navigate to public report page
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText('Report');

    // Fill SALUTE form
    // Size
    await page.fill('[name="size"]', '3-5 individuals');

    // Activity
    await page.fill('[name="activity"]', 'Vehicle checkpoint at intersection');

    // Location
    await page.fill('[name="location"]', 'Main St & 5th Ave, Durham NC');

    // Use current time or set specific time
    // (Form may auto-fill current time)

    // Uniform
    await page.fill('[name="uniform"]', 'Plain clothes with tactical vests');

    // Equipment
    await page.fill('[name="equipment"]', 'Radios, unmarked black SUVs');

    // Optional: Upload image
    // await page.setInputFiles('[name="media"]', 'test-files/sample-image.jpg');

    // Submit
    await page.click('[data-testid="submit-report"]');

    // Verify success
    await expect(page.locator('.toast-success')).toContainText('submitted');

    // May redirect to thank you page
    await expect(page.locator('body')).toContainText(/thank you|submitted/i);
  });
});
```

---

## Scenario 6: Admin Configuration

**Priority:** P2
**Duration:** ~3 minutes

### Journey

```gherkin
Feature: Admin Configuration

Scenario: Admin creates new zone and shift type
  Given I am logged in as an Administrator
  When I create a new zone with boundaries
  And I create a new shift type
  Then Coordinators can create shifts with the new type
  And shifts can be assigned to the new zone
```

### Test Implementation

```typescript
// e2e/admin-configuration.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Admin Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', testUsers.admin.email);
    await page.fill('[name="password"]', testUsers.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('admin can create new zone', async ({ page }) => {
    await page.goto('/admin/mapping');

    // Click add zone
    await page.click('[data-testid="add-zone-button"]');

    // Fill zone details
    await page.fill('[name="name"]', 'E2E Test Zone');
    await page.selectOption('[name="county"]', 'DURHAM');
    await page.fill('[name="description"]', 'Test zone created by E2E tests');

    // Submit
    await page.click('[data-testid="save-zone"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // Verify zone appears in list
    await expect(page.locator('[data-testid="zones-list"]')).toContainText('E2E Test Zone');
  });

  test('admin can create new shift type', async ({ page }) => {
    await page.goto('/admin/shift-types');

    // Click add
    await page.click('[data-testid="add-shift-type-button"]');

    // Fill details
    await page.fill('[name="name"]', 'E2E Shift Type');
    await page.fill('[name="slug"]', 'e2e-shift-type');
    await page.fill('[name="defaultDurationMinutes"]', '180');
    await page.fill('[name="defaultMinVolunteers"]', '2');
    await page.fill('[name="defaultMaxVolunteers"]', '4');

    // Submit
    await page.click('[data-testid="save-shift-type"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // Verify appears in list
    await expect(page.locator('[data-testid="shift-types-list"]')).toContainText('E2E Shift Type');
  });

  test('admin can create qualified role', async ({ page }) => {
    await page.goto('/admin/qualified-roles');

    await page.click('[data-testid="add-qualified-role-button"]');

    await page.fill('[name="name"]', 'E2E Role');
    await page.fill('[name="slug"]', 'e2e-role');
    await page.fill('[name="color"]', '#FF5733');

    // Toggle shadow role option
    await page.uncheck('[name="countsTowardMinimum"]');

    await page.click('[data-testid="save-qualified-role"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // Verify shadow badge
    await expect(page.locator('[data-testid="role-e2e-role"]')).toContainText('Shadow');
  });
});
```

---

## Scenario 7: Email Blast

**Priority:** P2
**Duration:** ~2 minutes

### Journey

```gherkin
Feature: Email Blast

Scenario: Coordinator sends email blast to volunteers
  Given I am logged in as a Coordinator
  When I create an email blast
  And I select recipients by zone
  And I send the blast
  Then matching volunteers should receive the email
```

### Test Implementation

```typescript
// e2e/email-blast.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Email Blast', () => {
  test('coordinator can send zone-filtered email blast', async ({ page }) => {
    // Login as coordinator
    await page.goto('/login');
    await page.fill('[name="email"]', testUsers.coordinator.email);
    await page.fill('[name="password"]', testUsers.coordinator.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Navigate to email blast
    await page.goto('/admin/email-blast');
    await page.click('[data-testid="new-blast-button"]');

    // Select template
    await page.selectOption('[name="template"]', 'GENERAL_NEWSLETTER');

    // Fill content
    await page.fill('[name="subject"]', 'E2E Test Email Blast');
    await page.fill('[name="body"]', 'This is a test email blast from E2E tests.');

    // Apply zone filter
    await page.click('[data-testid="filters-section"]');
    await page.check('[data-testid="zone-durham-1"]');

    // Preview recipients
    await page.click('[data-testid="preview-recipients"]');
    await expect(page.locator('[data-testid="recipient-count"]')).toBeVisible();

    // Send (in test mode, emails are mocked)
    await page.click('[data-testid="send-blast"]');
    await expect(page.locator('.toast-success')).toContainText('sent');

    // Verify blast in history
    await page.goto('/admin/email-blast');
    await expect(page.locator('[data-testid="blast-history"]')).toContainText('E2E Test Email Blast');
  });
});
```

---

## Scenario 8: Password Reset Flow

**Priority:** P0
**Duration:** ~2 minutes

### Journey

```gherkin
Feature: Password Reset

Scenario: User resets forgotten password
  Given I have forgotten my password
  When I request a password reset
  And I receive the reset email
  And I click the reset link
  And I enter a new password
  Then I should be able to login with the new password
```

### Test Implementation

```typescript
// e2e/password-reset.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Password Reset', () => {
  test('user can reset password', async ({ page }) => {
    // Navigate to forgot password
    await page.goto('/forgot-password');

    // Enter email
    await page.fill('[name="email"]', testUsers.volunteer.email);
    await page.click('button[type="submit"]');

    // Verify success message (doesn't reveal if email exists)
    await expect(page.locator('.toast-success')).toContainText('reset link');

    // In a real test, we'd need to:
    // 1. Intercept the email (using Mailhog, Mailtrap, or similar)
    // 2. Extract the reset token
    // 3. Navigate to reset page with token

    // For now, we'll test the reset page with a mock token
    // This assumes the test database has a valid reset token seeded
    const mockToken = 'test-reset-token';
    await page.goto(`/reset-password?token=${mockToken}`);

    // Enter new password
    const newPassword = 'NewTestPassword456!';
    await page.fill('[name="password"]', newPassword);
    await page.fill('[name="confirmPassword"]', newPassword);
    await page.click('button[type="submit"]');

    // Verify success and redirect to login
    await expect(page.locator('.toast-success')).toBeVisible();
    await page.waitForURL('/login');

    // Login with new password
    await page.fill('[name="email"]', testUsers.volunteer.email);
    await page.fill('[name="password"]', newPassword);
    await page.click('button[type="submit"]');

    // Verify login successful
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
```

---

## Running E2E Tests

### Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/volunteer-registration.spec.ts

# Run in debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Run only P0 tests
npx playwright test --grep "P0"
```

### Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Clean up test data** after each test or use isolated contexts
3. **Handle async operations** with proper waits
4. **Use meaningful test names** that describe the behavior
5. **Group related tests** in describe blocks
6. **Keep tests independent** - each test should work in isolation

---

*Last Updated: December 2025*
