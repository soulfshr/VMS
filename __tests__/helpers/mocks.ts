/**
 * Test Mocks
 *
 * Mock implementations for external services and dependencies.
 */

import { vi } from 'vitest';
import { testUsers } from './fixtures';

// ============================================
// EMAIL SERVICE MOCK
// ============================================

interface MockEmail {
  to: string | string[];
  subject: string;
  body?: string;
  template?: string;
  data?: Record<string, unknown>;
  sentAt: Date;
}

export const mockEmailService = {
  sends: [] as MockEmail[],

  send: vi.fn(async (email: Omit<MockEmail, 'sentAt'>) => {
    const sent: MockEmail = { ...email, sentAt: new Date() };
    mockEmailService.sends.push(sent);
    return { success: true, messageId: `mock-${Date.now()}` };
  }),

  sendBatch: vi.fn(async (emails: Omit<MockEmail, 'sentAt'>[]) => {
    const results = emails.map((email) => {
      const sent: MockEmail = { ...email, sentAt: new Date() };
      mockEmailService.sends.push(sent);
      return { success: true, messageId: `mock-${Date.now()}` };
    });
    return results;
  }),

  getEmailsSentTo: (email: string): MockEmail[] => {
    return mockEmailService.sends.filter((e) =>
      Array.isArray(e.to) ? e.to.includes(email) : e.to === email
    );
  },

  getEmailsWithSubject: (subject: string): MockEmail[] => {
    return mockEmailService.sends.filter((e) => e.subject.includes(subject));
  },

  getEmailsWithTemplate: (template: string): MockEmail[] => {
    return mockEmailService.sends.filter((e) => e.template === template);
  },

  reset: () => {
    mockEmailService.sends = [];
    mockEmailService.send.mockClear();
    mockEmailService.sendBatch.mockClear();
  },
};

// ============================================
// FILE STORAGE MOCK (S3/Vercel Blob)
// ============================================

interface MockUpload {
  key: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

export const mockFileStorage = {
  uploads: [] as MockUpload[],

  upload: vi.fn(
    async (file: { name: string; type: string; size: number }): Promise<{ url: string }> => {
      const key = `uploads/${Date.now()}-${file.name}`;
      const url = `https://mock-storage.test/${key}`;
      mockFileStorage.uploads.push({
        key,
        url,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date(),
      });
      return { url };
    }
  ),

  delete: vi.fn(async (key: string): Promise<{ success: boolean }> => {
    const index = mockFileStorage.uploads.findIndex((u) => u.key === key);
    if (index >= 0) {
      mockFileStorage.uploads.splice(index, 1);
      return { success: true };
    }
    return { success: false };
  }),

  getUploadByUrl: (url: string): MockUpload | undefined => {
    return mockFileStorage.uploads.find((u) => u.url === url);
  },

  reset: () => {
    mockFileStorage.uploads = [];
    mockFileStorage.upload.mockClear();
    mockFileStorage.delete.mockClear();
  },
};

// ============================================
// AUTHENTICATION MOCK
// ============================================

type UserRole = 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR';

interface MockSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  expires: string;
}

export const mockAuth = {
  currentSession: null as MockSession | null,

  setSession: (userKey: keyof typeof testUsers) => {
    const user = testUsers[userKey];
    mockAuth.currentSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  setCustomSession: (session: MockSession) => {
    mockAuth.currentSession = session;
  },

  clearSession: () => {
    mockAuth.currentSession = null;
  },

  getSession: vi.fn(async () => mockAuth.currentSession),

  // Helpers for testing
  asVolunteer: () => mockAuth.setSession('volunteer'),
  asCoordinator: () => mockAuth.setSession('coordinator'),
  asDispatcher: () => mockAuth.setSession('dispatcher'),
  asAdmin: () => mockAuth.setSession('admin'),
  asUnauthenticated: () => mockAuth.clearSession(),
};

// ============================================
// DATABASE MOCK HELPERS
// ============================================

/**
 * Creates a mock Prisma client for unit tests.
 * For integration tests, use the real database.
 */
export const createMockPrismaClient = () => {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    zone: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shift: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    shiftVolunteer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    trainingSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    trainingSessionAttendee: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    iceSighting: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    qualifiedRole: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userQualification: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailBlast: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(createMockPrismaClient())),
    $disconnect: vi.fn(),
  };
};

// ============================================
// REQUEST/RESPONSE MOCKS
// ============================================

export const createMockRequest = (options: {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
}) => {
  const url = new URL('http://localhost:3000/api/test');

  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return {
    method: options.method || 'GET',
    url: url.toString(),
    json: vi.fn().mockResolvedValue(options.body),
    text: vi.fn().mockResolvedValue(JSON.stringify(options.body)),
    headers: new Headers(options.headers),
    nextUrl: url,
  };
};

export const createMockResponse = () => {
  const response = {
    status: 200,
    body: null as unknown,
    headers: new Map<string, string>(),

    json: vi.fn((data: unknown) => {
      response.body = data;
      return Response.json(data, { status: response.status });
    }),

    setStatus: (status: number) => {
      response.status = status;
      return response;
    },
  };

  return response;
};

// ============================================
// NEXT.JS MOCKS
// ============================================

export const mockNextNavigation = {
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
};

export const mockNextHeaders = {
  headers: () => new Headers(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  }),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Reset all mocks to their initial state.
 * Call this in beforeEach or afterEach.
 */
export const resetAllMocks = () => {
  mockEmailService.reset();
  mockFileStorage.reset();
  mockAuth.clearSession();
  vi.clearAllMocks();
};

/**
 * Wait for a condition to be true.
 * Useful for async operations in tests.
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
};

/**
 * Create a delayed promise for testing async behavior.
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
