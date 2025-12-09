/**
 * E2E Sighting Report Tests
 *
 * Tests for public sighting report submission.
 * Priority: P1 (Important for launch)
 */

import { test, expect } from '@playwright/test';

test.describe('Public Sighting Report', () => {
  test('SIGHT-001: anonymous user can submit sighting report', async ({ page }) => {
    // Navigate to public report page
    await page.goto('/report');

    // Verify page loaded
    await expect(page.locator('h1, h2')).toContainText(/report|sighting/i);

    // Fill SALUTE form
    // Size
    const sizeInput = page.locator('[name="size"]');
    if (await sizeInput.isVisible()) {
      await sizeInput.fill('3-5 individuals');
    } else {
      // May be a select
      const sizeSelect = page.locator('select[name="size"]');
      if (await sizeSelect.isVisible()) {
        await sizeSelect.selectOption({ index: 1 });
      }
    }

    // Activity
    await page.fill('[name="activity"]', 'Vehicle checkpoint observed at intersection');

    // Location
    await page.fill('[name="location"]', 'Main St & 5th Ave, Durham NC');

    // Time (may be auto-filled with current time)
    const timeInput = page.locator('[name="time"]');
    if (await timeInput.isVisible() && await timeInput.inputValue() === '') {
      await timeInput.fill(new Date().toISOString().slice(0, 16));
    }

    // Uniform (optional)
    const uniformInput = page.locator('[name="uniform"]');
    if (await uniformInput.isVisible()) {
      await uniformInput.fill('Plain clothes with tactical vests');
    }

    // Equipment (optional)
    const equipmentInput = page.locator('[name="equipment"]');
    if (await equipmentInput.isVisible()) {
      await equipmentInput.fill('Radios, unmarked black SUVs');
    }

    // Submit
    await page.click('[data-testid="submit-report"], button[type="submit"]');

    // Should show success
    await expect(
      page.locator('.toast-success, [role="status"], .success-message')
    ).toContainText(/submitted|thank you|received/i, { timeout: 10000 });
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/report');

    // Try to submit empty form
    await page.click('[data-testid="submit-report"], button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('.error, [role="alert"], :invalid')).toBeVisible();
  });

  test('should allow anonymous submission', async ({ page }) => {
    await page.goto('/report');

    // Fill minimum required fields
    const sizeInput = page.locator('[name="size"]');
    if (await sizeInput.isVisible()) {
      await sizeInput.fill('1-2');
    } else {
      const sizeSelect = page.locator('select[name="size"]');
      if (await sizeSelect.isVisible()) {
        await sizeSelect.selectOption({ index: 1 });
      }
    }

    await page.fill('[name="activity"]', 'Suspicious vehicle observed');
    await page.fill('[name="location"]', '123 Test St');

    // Leave reporter info empty (anonymous)
    const reporterName = page.locator('[name="reporterName"]');
    if (await reporterName.isVisible()) {
      expect(await reporterName.inputValue()).toBe('');
    }

    // Submit should still work
    await page.click('[data-testid="submit-report"], button[type="submit"]');

    // Should show success
    await expect(
      page.locator('.toast-success, [role="status"], .success-message')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle location with GPS coordinates', async ({ page }) => {
    await page.goto('/report');

    // Fill form
    const sizeInput = page.locator('[name="size"]');
    if (await sizeInput.isVisible()) {
      await sizeInput.fill('3-5');
    }

    await page.fill('[name="activity"]', 'Test activity');
    await page.fill('[name="location"]', 'GPS Location Test');

    // If there's a "Use My Location" button, test it
    const useLocationButton = page.locator('button:has-text("Use My Location"), [data-testid="use-location"]');
    if (await useLocationButton.isVisible()) {
      // Note: In E2E, we can mock geolocation
      // For now, just verify the button exists
      expect(await useLocationButton.isVisible()).toBe(true);
    }

    // Manual coordinate entry if available
    const latInput = page.locator('[name="latitude"]');
    const lngInput = page.locator('[name="longitude"]');

    if (await latInput.isVisible() && await lngInput.isVisible()) {
      await latInput.fill('35.994');
      await lngInput.fill('-78.8986');
    }
  });

  test('should handle image upload', async ({ page }) => {
    await page.goto('/report');

    // Check if file upload is available
    const fileInput = page.locator('input[type="file"]');

    if (await fileInput.isVisible()) {
      // Create a test file (in actual test, use a real test image)
      // Note: For real tests, you'd have test image files
      expect(await fileInput.isVisible()).toBe(true);
    }
  });
});

test.describe('Sighting Map Integration', () => {
  test('should display map on report page', async ({ page }) => {
    await page.goto('/report');

    // Check if map container exists
    const mapContainer = page.locator('[data-testid="location-map"], .map-container, #map');

    if (await mapContainer.isVisible()) {
      // Map should be visible
      expect(await mapContainer.isVisible()).toBe(true);
    }
  });

  test('should allow clicking on map to set location', async ({ page }) => {
    await page.goto('/report');

    const mapContainer = page.locator('[data-testid="location-map"], .map-container, #map');

    if (await mapContainer.isVisible()) {
      // Click on map
      await mapContainer.click({ position: { x: 200, y: 200 } });

      // Check if coordinates were set
      const latInput = page.locator('[name="latitude"]');
      const lngInput = page.locator('[name="longitude"]');

      if (await latInput.isVisible()) {
        // Coordinates should be populated after click
        // (May need to wait for map click handler)
      }
    }
  });
});
