# Test Environment Setup Guide

**Version:** 1.0
**Date:** December 2025

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install Test Dependencies](#2-install-test-dependencies)
3. [Configure Test Environment](#3-configure-test-environment)
4. [Database Setup](#4-database-setup)
5. [Running Tests](#5-running-tests)
6. [IDE Integration](#6-ide-integration)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

Before setting up the test environment, ensure you have:

- **Node.js 20+** (LTS recommended)
- **npm 10+** or pnpm
- **Docker** (for local test database)
- **Git** (for version control)

Verify installations:
```bash
node --version   # Should be v20.x or higher
npm --version    # Should be v10.x or higher
docker --version # Any recent version
```

---

## 2. Install Test Dependencies

### Add Testing Libraries

Run the following to install all testing dependencies:

```bash
npm install -D vitest @vitest/coverage-v8 @vitest/ui \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @playwright/test \
  msw \
  supertest @types/supertest \
  @faker-js/faker \
  happy-dom
```

### Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --dir __tests__/unit",
    "test:api": "vitest run --dir __tests__/api",
    "test:integration": "vitest run --dir __tests__/integration",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report",
    "test:prelaunch": "npm run test:unit && npm run test:api && npm run test:integration && npm run test:e2e",
    "test:critical": "vitest run --testNamePattern='P0'",
    "db:test:setup": "docker-compose -f docker-compose.test.yml up -d && npx prisma migrate deploy",
    "db:test:seed": "npx prisma db seed",
    "db:test:reset": "docker-compose -f docker-compose.test.yml down -v && npm run db:test:setup && npm run db:test:seed",
    "db:test:down": "docker-compose -f docker-compose.test.yml down"
  }
}
```

---

## 3. Configure Test Environment

### Create vitest.config.ts

Create `vitest.config.ts` in the project root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        '__tests__',
        'e2e',
        '**/*.d.ts',
        '**/*.config.*',
        '**/generated/**',
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Create vitest.setup.ts

Create `vitest.setup.ts` in the project root:

```typescript
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/vms_test';
process.env.SKIP_EMAIL_SEND = 'true';

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
```

### Create playwright.config.ts

Create `playwright.config.ts` in the project root:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Create .env.test

Create `.env.test` in the project root:

```bash
# Test Database
DATABASE_URL="postgresql://test:test@localhost:5433/vms_test"
DIRECT_URL="postgresql://test:test@localhost:5433/vms_test"

# Authentication
NEXTAUTH_SECRET="test-secret-do-not-use-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Disable External Services
SKIP_EMAIL_SEND="true"
AWS_SES_DISABLED="true"
RESEND_API_KEY="re_test_disabled"

# Feature Flags for Tests
NEXT_PUBLIC_FEATURE_TRAININGS="true"
NEXT_PUBLIC_FEATURE_SIGHTINGS="true"

# Test Mode
NODE_ENV="test"
```

---

## 4. Database Setup

### Create docker-compose.test.yml

Create `docker-compose.test.yml` in the project root:

```yaml
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    container_name: vms-postgres-test
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: vms_test
    ports:
      - "5433:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d vms_test"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_test_data:
```

### Start Test Database

```bash
# Start the test database
docker-compose -f docker-compose.test.yml up -d

# Wait for database to be ready
sleep 5

# Apply migrations
DATABASE_URL="postgresql://test:test@localhost:5433/vms_test" npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed test data (optional)
DATABASE_URL="postgresql://test:test@localhost:5433/vms_test" npx prisma db seed
```

### Create Test Seed Script

Create `prisma/seed-test.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding test database...');

  // Create test users
  const passwordHash = await hash('TestPassword123!', 12);

  await prisma.user.createMany({
    data: [
      {
        id: 'user-volunteer-1',
        email: 'volunteer@test.com',
        name: 'Test Volunteer',
        role: 'VOLUNTEER',
        passwordHash,
        status: 'ACTIVE',
        emailNotifications: true,
      },
      {
        id: 'user-coordinator-1',
        email: 'coordinator@test.com',
        name: 'Test Coordinator',
        role: 'COORDINATOR',
        passwordHash,
        status: 'ACTIVE',
        emailNotifications: true,
      },
      {
        id: 'user-dispatcher-1',
        email: 'dispatcher@test.com',
        name: 'Test Dispatcher',
        role: 'DISPATCHER',
        passwordHash,
        status: 'ACTIVE',
        emailNotifications: true,
      },
      {
        id: 'user-admin-1',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'ADMINISTRATOR',
        passwordHash,
        status: 'ACTIVE',
        emailNotifications: true,
      },
    ],
    skipDuplicates: true,
  });

  // Create test zones
  await prisma.zone.createMany({
    data: [
      {
        id: 'zone-durham-1',
        name: 'Durham 1',
        county: 'DURHAM',
        active: true,
        color: '#3B82F6',
      },
      {
        id: 'zone-durham-2',
        name: 'Durham 2',
        county: 'DURHAM',
        active: true,
        color: '#10B981',
      },
      {
        id: 'zone-orange-1',
        name: 'Orange 1',
        county: 'ORANGE',
        active: true,
        color: '#F59E0B',
      },
    ],
    skipDuplicates: true,
  });

  // Create test shift types
  await prisma.shiftTypeConfig.createMany({
    data: [
      {
        id: 'type-zone-patrol',
        name: 'Zone Patrol',
        slug: 'zone-patrol',
        color: '#3B82F6',
        active: true,
        defaultDurationMinutes: 240,
        defaultMinVolunteers: 2,
        defaultMaxVolunteers: 6,
      },
      {
        id: 'type-on-call',
        name: 'On-Call',
        slug: 'on-call',
        color: '#10B981',
        active: true,
        defaultDurationMinutes: 480,
        defaultMinVolunteers: 1,
        defaultMaxVolunteers: 3,
      },
    ],
    skipDuplicates: true,
  });

  // Create test qualified roles
  await prisma.qualifiedRole.createMany({
    data: [
      {
        id: 'role-verifier',
        name: 'Verifier',
        slug: 'verifier',
        color: '#8B5CF6',
        countsTowardMinimum: true,
        active: true,
      },
      {
        id: 'role-zone-lead',
        name: 'Zone Lead',
        slug: 'zone-lead',
        color: '#EC4899',
        countsTowardMinimum: true,
        active: true,
      },
      {
        id: 'role-shadower',
        name: 'Shadower',
        slug: 'shadower',
        color: '#6B7280',
        countsTowardMinimum: false,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Test database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding test database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 5. Running Tests

### Quick Start

```bash
# Start test database
npm run db:test:setup

# Run all tests
npm test

# Run with UI (development)
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# API tests only
npm run test:api

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# E2E with visible browser
npm run test:e2e:headed

# Pre-launch (all tests)
npm run test:prelaunch
```

### Watch Mode (Development)

```bash
# Watch all tests
npm run test:watch

# Watch specific file
npm run test:watch -- __tests__/api/shifts.api.test.ts
```

### Filter Tests

```bash
# Run tests matching pattern
npm test -- --testNamePattern="SHIFT"

# Run specific file
npm test -- __tests__/api/shifts.api.test.ts

# Run critical (P0) tests only
npm run test:critical
```

---

## 6. IDE Integration

### VS Code Setup

Install the following extensions:
- **Vitest** (ZixuanChen.vitest-explorer)
- **Playwright Test for VSCode** (ms-playwright.playwright)

Create `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npx vitest",
  "testing.automaticallyOpenPeekView": "never",
  "playwright.reuseBrowser": true
}
```

### Running Tests from VS Code

1. Open the Testing sidebar (beaker icon)
2. Click the play button next to any test or test file
3. View results in the Test Results panel

### Debugging Tests

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Vitest",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Playwright",
      "program": "${workspaceFolder}/node_modules/@playwright/test/cli.js",
      "args": ["test", "--debug", "${relativeFile}"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

---

## 7. Troubleshooting

### Common Issues

#### Database Connection Failed

```
Error: Can't reach database server at localhost:5433
```

**Solution:**
```bash
# Check if Docker container is running
docker ps | grep vms-postgres-test

# If not running, start it
docker-compose -f docker-compose.test.yml up -d

# Check container logs
docker logs vms-postgres-test
```

#### Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
npx prisma generate
```

#### Port Already in Use

```
Error: Port 5433 is already in use
```

**Solution:**
```bash
# Find process using port
lsof -i :5433

# Kill the process or use a different port
docker-compose -f docker-compose.test.yml down
```

#### E2E Tests Timeout

```
Error: Test timeout of 30000ms exceeded
```

**Solution:**
```bash
# Ensure dev server is running
npm run dev

# Or increase timeout in playwright.config.ts
timeout: 60000
```

### Reset Everything

If tests are in a bad state:

```bash
# Stop and remove test database
npm run db:test:down

# Remove node_modules and reinstall
rm -rf node_modules
npm install

# Regenerate Prisma client
npx prisma generate

# Setup test database fresh
npm run db:test:setup
npm run db:test:seed

# Run tests
npm test
```

### Getting Help

- Check Vitest docs: https://vitest.dev/
- Check Playwright docs: https://playwright.dev/
- Check Testing Library docs: https://testing-library.com/

---

*Last Updated: December 2025*
