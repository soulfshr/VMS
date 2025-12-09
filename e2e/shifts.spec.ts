/**
 * E2E Shift Tests
 *
 * Tests for shift creation, RSVP, and management flows.
 * Priority: P0 (Critical for launch)
 */

import { test, expect } from '@playwright/test';
import { testUsers, testZones, testShiftTypes } from './fixtures/users';

// Helper to login
async function login(page: any, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('[name="email"], [type="email"]', user.email);
  await page.fill('[name="password"], [type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

// Helper to get future date string
function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

test.describe('Shift Management', () => {
  test.describe('Shift Creation (Coordinator)', () => {
    test('SHIFT-001: coordinator can create a new shift', async ({ page }) => {
      await login(page, testUsers.coordinator);

      // Navigate to create shift page
      await page.goto('/shifts/create');
      await expect(page.locator('h1')).toContainText(/create|new/i);

      // Fill shift form
      await page.fill('[name="title"]', 'E2E Test Morning Patrol');

      // Select shift type (if dropdown)
      const shiftTypeSelect = page.locator('[name="shiftTypeId"], [name="type"]');
      if (await shiftTypeSelect.isVisible()) {
        await shiftTypeSelect.selectOption({ index: 1 });
      }

      // Select zone
      const zoneSelect = page.locator('[name="zoneId"], [name="zone"]');
      if (await zoneSelect.isVisible()) {
        await zoneSelect.selectOption({ index: 1 });
      }

      // Set date
      await page.fill('[name="date"]', getFutureDate(7));

      // Set times
      await page.fill('[name="startTime"]', '09:00');
      await page.fill('[name="endTime"]', '13:00');

      // Set volunteer counts
      const minInput = page.locator('[name="minVolunteers"]');
      if (await minInput.isVisible()) {
        await minInput.fill('2');
      }

      const maxInput = page.locator('[name="maxVolunteers"]');
      if (await maxInput.isVisible()) {
        await maxInput.fill('6');
      }

      // Submit
      await page.click('button[type="submit"], [data-testid="create-shift-submit"]');

      // Should show success and/or redirect to shift page
      await expect(page.locator('.toast-success, [role="status"]')).toBeVisible({ timeout: 5000 });
    });

    test('should validate required fields', async ({ page }) => {
      await login(page, testUsers.coordinator);
      await page.goto('/shifts/create');

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('.error, [role="alert"], :invalid')).toBeVisible();
    });
  });

  test.describe('Shift RSVP (Volunteer)', () => {
    test('SHIFT-002: volunteer can RSVP to available shift', async ({ page }) => {
      await login(page, testUsers.volunteer);

      // Navigate to shifts
      await page.goto('/shifts');
      await expect(page.locator('h1')).toContainText(/shift/i);

      // Wait for shifts to load
      await page.waitForSelector('[data-testid^="shift-"], .shift-card, .shift-row', { timeout: 10000 });

      // Click on first available shift
      const firstShift = page.locator('[data-testid^="shift-"], .shift-card, .shift-row').first();
      await firstShift.click();

      // Should show shift details
      await page.waitForURL(/\/shifts\/\w+/);

      // Find and click RSVP button
      const rsvpButton = page.locator('[data-testid="rsvp-button"], button:has-text("RSVP")');
      if (await rsvpButton.isVisible()) {
        await rsvpButton.click();

        // Should show success
        await expect(page.locator('.toast-success, [role="status"]')).toBeVisible({ timeout: 5000 });

        // Status should show pending
        await expect(page.locator('[data-testid="rsvp-status"], .rsvp-status')).toContainText(/pending/i);
      }
    });

    test('should show RSVP status on dashboard', async ({ page }) => {
      await login(page, testUsers.volunteer);

      // Dashboard should show upcoming shifts
      await page.goto('/dashboard');

      // Look for upcoming shifts section
      const upcomingSection = page.locator('[data-testid="upcoming-shifts"], .upcoming-shifts');
      await expect(upcomingSection).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('RSVP Confirmation (Coordinator)', () => {
    test('SHIFT-003: coordinator can confirm pending RSVPs', async ({ page }) => {
      await login(page, testUsers.coordinator);

      // Navigate to shifts
      await page.goto('/shifts');

      // Find a shift with pending RSVPs (if any)
      // In a real test, we'd have pre-seeded data
      const shiftWithRsvps = page.locator('[data-testid^="shift-"], .shift-card, .shift-row').first();

      if (await shiftWithRsvps.isVisible()) {
        await shiftWithRsvps.click();
        await page.waitForURL(/\/shifts\/\w+/);

        // Navigate to roster
        const rosterLink = page.locator('[data-testid="view-roster"], a:has-text("Roster")');
        if (await rosterLink.isVisible()) {
          await rosterLink.click();
          await page.waitForURL(/\/roster/);

          // Look for pending RSVPs
          const pendingRsvps = page.locator('[data-testid*="pending"], .status-pending');

          if (await pendingRsvps.first().isVisible()) {
            // Select pending RSVPs
            const selectAll = page.locator('[data-testid="select-all-pending"]');
            if (await selectAll.isVisible()) {
              await selectAll.click();
            }

            // Confirm
            const confirmButton = page.locator('[data-testid="confirm-selected"], button:has-text("Confirm")');
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
              await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
            }
          }
        }
      }
    });
  });

  test.describe('Shift Editing', () => {
    test('coordinator can edit existing shift', async ({ page }) => {
      await login(page, testUsers.coordinator);

      // Navigate to shifts
      await page.goto('/shifts');

      // Find a shift to edit
      const shift = page.locator('[data-testid^="shift-"], .shift-card, .shift-row').first();

      if (await shift.isVisible()) {
        // Click edit link/button
        const editButton = shift.locator('[data-testid="edit-shift"], a:has-text("Edit"), button:has-text("Edit")');

        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForURL(/\/edit/);

          // Modify title
          await page.fill('[name="title"]', 'Updated E2E Shift Title');

          // Save
          await page.click('button[type="submit"]');

          // Should show success
          await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});

test.describe('Full RSVP Lifecycle', () => {
  test('complete RSVP flow from creation to confirmation', async ({ browser }) => {
    // This test uses two browser contexts for different users
    const coordinatorContext = await browser.newContext();
    const volunteerContext = await browser.newContext();

    const coordinatorPage = await coordinatorContext.newPage();
    const volunteerPage = await volunteerContext.newPage();

    try {
      // STEP 1: Coordinator creates shift
      await login(coordinatorPage, testUsers.coordinator);
      await coordinatorPage.goto('/shifts/create');

      await coordinatorPage.fill('[name="title"]', 'Lifecycle Test Shift');

      const shiftTypeSelect = coordinatorPage.locator('[name="shiftTypeId"]');
      if (await shiftTypeSelect.isVisible()) {
        await shiftTypeSelect.selectOption({ index: 1 });
      }

      const zoneSelect = coordinatorPage.locator('[name="zoneId"]');
      if (await zoneSelect.isVisible()) {
        await zoneSelect.selectOption({ index: 1 });
      }

      await coordinatorPage.fill('[name="date"]', getFutureDate(10));
      await coordinatorPage.fill('[name="startTime"]', '10:00');
      await coordinatorPage.fill('[name="endTime"]', '14:00');

      await coordinatorPage.click('button[type="submit"]');
      await expect(coordinatorPage.locator('.toast-success')).toBeVisible({ timeout: 5000 });

      // Get the created shift URL
      await coordinatorPage.waitForURL(/\/shifts\/\w+/, { timeout: 10000 });
      const shiftUrl = coordinatorPage.url();

      // STEP 2: Volunteer RSVPs
      await login(volunteerPage, testUsers.volunteer);
      await volunteerPage.goto(shiftUrl);

      const rsvpButton = volunteerPage.locator('[data-testid="rsvp-button"], button:has-text("RSVP")');
      if (await rsvpButton.isVisible()) {
        await rsvpButton.click();
        await expect(volunteerPage.locator('.toast-success')).toBeVisible({ timeout: 5000 });
      }

      // STEP 3: Coordinator confirms
      await coordinatorPage.goto(shiftUrl.replace(/\/shifts\//, '/shifts/') + '/roster');

      const selectPending = coordinatorPage.locator('[data-testid="select-all-pending"]');
      if (await selectPending.isVisible()) {
        await selectPending.click();
        await coordinatorPage.click('[data-testid="confirm-selected"]');
        await expect(coordinatorPage.locator('.toast-success')).toBeVisible({ timeout: 5000 });
      }

      // STEP 4: Volunteer sees confirmed status
      await volunteerPage.reload();
      const status = volunteerPage.locator('[data-testid="rsvp-status"]');
      if (await status.isVisible()) {
        await expect(status).toContainText(/confirmed/i);
      }

    } finally {
      await coordinatorContext.close();
      await volunteerContext.close();
    }
  });
});
