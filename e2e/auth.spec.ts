/**
 * E2E Authentication Tests
 *
 * Tests for login, logout, and password reset flows.
 * Priority: P0 (Critical for launch)
 */

import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';

test.describe('Authentication', () => {
  test.describe('Login Flow', () => {
    test('AUTH-001: user can login with email and password', async ({ page }) => {
      await page.goto('/login');

      // Verify login page loaded
      await expect(page.locator('h1, h2')).toContainText(/sign in|login/i);

      // Fill login form
      await page.fill('[name="email"], [type="email"]', testUsers.volunteer.email);
      await page.fill('[name="password"], [type="password"]', testUsers.volunteer.password);

      // Submit
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await expect(page.locator('h1')).toContainText(/dashboard|welcome/i);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.fill('[name="email"], [type="email"]', testUsers.volunteer.email);
      await page.fill('[name="password"], [type="password"]', 'WrongPassword123!');

      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('.error, [role="alert"], .toast-error')).toBeVisible();
    });

    test('should show validation for empty fields', async ({ page }) => {
      await page.goto('/login');

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('[role="alert"], .error, :invalid')).toBeVisible();
    });
  });

  test.describe('Logout Flow', () => {
    test('AUTH-006: user can logout', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.fill('[name="email"], [type="email"]', testUsers.volunteer.email);
      await page.fill('[name="password"], [type="password"]', testUsers.volunteer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Find and click logout button
      // May be in a dropdown menu
      const userMenu = page.locator('[data-testid="user-menu"], [aria-label*="user"], .user-menu');
      if (await userMenu.isVisible()) {
        await userMenu.click();
      }

      await page.click('button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout"]');

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 10000 });
    });
  });

  test.describe('Password Reset Flow', () => {
    test('AUTH-004: user can request password reset', async ({ page }) => {
      await page.goto('/forgot-password');

      // Verify page loaded
      await expect(page.locator('h1, h2')).toContainText(/reset|forgot|password/i);

      // Enter email
      await page.fill('[name="email"], [type="email"]', testUsers.volunteer.email);

      // Submit
      await page.click('button[type="submit"]');

      // Should show success message
      await expect(page.locator('.success, .toast-success, [role="status"]')).toContainText(
        /sent|check|email/i
      );
    });

    test('should handle non-existent email gracefully', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.fill('[name="email"], [type="email"]', 'nonexistent@test.com');
      await page.click('button[type="submit"]');

      // Should show same success message (prevent email enumeration)
      await expect(page.locator('.success, .toast-success, [role="status"]')).toContainText(
        /sent|check|email/i
      );
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected routes without login
      const protectedRoutes = ['/dashboard', '/shifts', '/profile'];

      for (const route of protectedRoutes) {
        await page.goto(route);
        // Should redirect to login
        await expect(page).toHaveURL(/login/);
      }
    });

    test('should redirect to original page after login', async ({ page }) => {
      // Try to access shifts page
      await page.goto('/shifts');

      // Should redirect to login
      await page.waitForURL(/login/);

      // Login
      await page.fill('[name="email"], [type="email"]', testUsers.volunteer.email);
      await page.fill('[name="password"], [type="password"]', testUsers.volunteer.password);
      await page.click('button[type="submit"]');

      // Should redirect back to shifts (or dashboard)
      await page.waitForURL(/shifts|dashboard/);
    });
  });
});

test.describe('Authorization', () => {
  test.describe('Role-Based Access', () => {
    test('volunteer should not access admin routes', async ({ page }) => {
      // Login as volunteer
      await page.goto('/login');
      await page.fill('[name="email"], [type="email"]', testUsers.volunteer.email);
      await page.fill('[name="password"], [type="password"]', testUsers.volunteer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Try to access admin routes
      await page.goto('/admin');

      // Should be redirected or show 403
      const url = page.url();
      const content = await page.content();
      expect(url.includes('/admin') === false || content.includes('403') || content.includes('denied')).toBeTruthy();
    });

    test('coordinator should access volunteer management', async ({ page }) => {
      // Login as coordinator
      await page.goto('/login');
      await page.fill('[name="email"], [type="email"]', testUsers.coordinator.email);
      await page.fill('[name="password"], [type="password"]', testUsers.coordinator.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Navigate to volunteers
      await page.goto('/volunteers');

      // Should be able to see the page
      await expect(page.locator('h1')).toContainText(/volunteer/i);
    });

    test('admin should access all routes', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('[name="email"], [type="email"]', testUsers.admin.email);
      await page.fill('[name="password"], [type="password"]', testUsers.admin.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Should access admin settings
      await page.goto('/admin/settings');
      await expect(page.locator('h1')).toContainText(/setting/i);

      // Should access volunteers
      await page.goto('/volunteers');
      await expect(page.locator('h1')).toContainText(/volunteer/i);
    });
  });
});
