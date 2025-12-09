/**
 * Vitest Setup File
 *
 * This file runs before each test file.
 * Use it to set up global mocks, environment variables, and utilities.
 */

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ============================================
// Environment Variables
// ============================================
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret-for-vitest';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/vms_test';
process.env.SKIP_EMAIL_SEND = 'true';
process.env.AWS_SES_DISABLED = 'true';

// ============================================
// Global Test Cleanup
// ============================================
afterEach(() => {
  // Clean up React Testing Library after each test
  cleanup();

  // Clear all mocks
  vi.clearAllMocks();
});

// ============================================
// Mock Next.js Navigation
// ============================================
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// ============================================
// Mock Next.js Headers
// ============================================
vi.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
    has: vi.fn(() => false),
  }),
}));

// ============================================
// Mock next-auth
// ============================================
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(() => null),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => null),
}));

// ============================================
// Mock Email Service
// ============================================
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendShiftConfirmationEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendShiftReminderEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendTrainingReminderEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendSightingNotificationToDispatchers: vi.fn(() => Promise.resolve({ success: true })),
  sendBlastEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

// ============================================
// Mock File Upload
// ============================================
vi.mock('@/lib/s3', () => ({
  uploadFile: vi.fn(() => Promise.resolve({ url: 'https://mock-storage.test/file.jpg' })),
  deleteFile: vi.fn(() => Promise.resolve({ success: true })),
  generatePresignedUrl: vi.fn(() =>
    Promise.resolve({ url: 'https://mock-storage.test/presigned', fields: {} })
  ),
}));

// ============================================
// Suppress Console Warnings
// ============================================
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress specific warnings in tests
  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';

    // Suppress React DOM render warnings
    if (message.includes('ReactDOM.render is no longer supported')) {
      return;
    }

    // Suppress act() warnings in async tests
    if (message.includes('act(...)')) {
      return;
    }

    originalConsoleError.call(console, ...args);
  };

  console.warn = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';

    // Suppress Prisma warnings in tests
    if (message.includes('prisma:warn')) {
      return;
    }

    originalConsoleWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// ============================================
// Global Test Utilities
// ============================================

/**
 * Wait for a specified amount of time.
 * Useful for testing async behavior.
 */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Flush all pending promises.
 * Useful for testing components with async effects.
 */
export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Create a mock fetch response.
 */
export const mockFetchResponse = (data: unknown, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};
