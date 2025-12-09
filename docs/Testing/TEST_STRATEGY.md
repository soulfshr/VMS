# RippleVMS Test Strategy

**Version:** 1.0
**Date:** December 2025
**Status:** Approved for v1 Launch

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Pyramid](#2-test-pyramid)
3. [Technology Stack](#3-technology-stack)
4. [Test Environment](#4-test-environment)
5. [Test Data Management](#5-test-data-management)
6. [Test Categories](#6-test-categories)
7. [Priority Matrix](#7-priority-matrix)
8. [CI/CD Integration](#8-cicd-integration)
9. [Performance Testing](#9-performance-testing)
10. [Security Testing](#10-security-testing)

---

## 1. Testing Philosophy

### Core Principles

1. **Test What Matters** - Focus on business-critical functionality first
2. **Fast Feedback** - Tests should run quickly to enable rapid iteration
3. **Isolated Tests** - Each test should be independent and repeatable
4. **Realistic Data** - Use production-like data to catch edge cases
5. **Continuous Testing** - Run tests on every commit and PR

### Coverage Goals

| Priority | Category | Coverage Target |
|----------|----------|-----------------|
| P0 | Authentication & Authorization | 95% |
| P0 | Shift RSVP & Management | 90% |
| P1 | Training Sessions | 85% |
| P1 | Email Notifications | 80% |
| P1 | Sighting Reports | 85% |
| P2 | Admin Configuration | 75% |
| P3 | UI Components | 60% |

---

## 2. Test Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  10% of tests
                    │  (Slow)     │  Critical user journeys
                    ├─────────────┤
                    │ Integration │  20% of tests
                    │  (Medium)   │  API + Database
                    ├─────────────┤
                    │    Unit     │  70% of tests
                    │   (Fast)    │  Functions, utilities
                    └─────────────┘
```

### Test Distribution

| Type | Count (Target) | Run Time | Frequency |
|------|----------------|----------|-----------|
| Unit | ~200 | < 30s | Every commit |
| Integration | ~80 | < 2min | Every commit |
| E2E | ~25 | < 5min | Every PR, nightly |

---

## 3. Technology Stack

### Test Framework: Vitest

**Why Vitest:**
- Native ESM support (matches Next.js)
- Fast execution with parallel tests
- Jest-compatible API
- Built-in code coverage
- Excellent TypeScript support

### Supporting Libraries

| Library | Purpose |
|---------|---------|
| **@testing-library/react** | Component testing |
| **@testing-library/user-event** | User interaction simulation |
| **msw** (Mock Service Worker) | API mocking |
| **supertest** | HTTP assertion library |
| **@prisma/client** | Database testing |
| **playwright** | E2E browser automation |
| **faker-js** | Test data generation |

### Configuration Files

```
/
├── vitest.config.ts          # Vitest configuration
├── vitest.setup.ts           # Global test setup
├── playwright.config.ts      # Playwright E2E config
├── __tests__/
│   ├── unit/                 # Unit tests
│   ├── api/                  # API route tests
│   ├── integration/          # Integration tests
│   └── helpers/              # Test utilities
└── e2e/                      # Playwright E2E tests
```

---

## 4. Test Environment

### Database Strategy

**Approach:** Isolated test database with transaction rollback

```
Production DB (Neon) ──────────────────────────────

Development DB (Neon Branch) ──────────────────────

Test DB (Local Docker PostgreSQL) ─────────────────
  └── Each test file gets isolated transaction
  └── Rolled back after each test
```

### Environment Variables

```bash
# .env.test
DATABASE_URL="postgresql://test:test@localhost:5433/vms_test"
NEXTAUTH_SECRET="test-secret-do-not-use-in-prod"
NEXTAUTH_URL="http://localhost:3000"

# Disable external services in tests
RESEND_API_KEY="re_test_disabled"
AWS_SES_DISABLED="true"
SKIP_EMAIL_SEND="true"
```

### Docker Compose for Test DB

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: vms_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data  # RAM disk for speed
```

---

## 5. Test Data Management

### Seed Data Approach

**Factory Pattern** using test helpers:

```typescript
// __tests__/helpers/factories.ts

export const createTestUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: 'VOLUNTEER',
  ...overrides,
});

export const createTestShift = (overrides = {}) => ({
  id: faker.string.uuid(),
  title: `Test Shift - ${faker.word.adjective()}`,
  date: faker.date.future(),
  startTime: '09:00',
  endTime: '13:00',
  status: 'PUBLISHED',
  minVolunteers: 2,
  maxVolunteers: 6,
  ...overrides,
});
```

### Test Data Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Fixtures** | Static, reusable data | Users, zones, shift types |
| **Factories** | Dynamic, customizable | Shifts, trainings, sightings |
| **Scenarios** | Complete data sets | "Fully staffed shift", "New volunteer" |

---

## 6. Test Categories

### 6.1 Unit Tests

**Purpose:** Test individual functions and utilities in isolation

**Examples:**
- Date formatting utilities
- Permission checking logic
- Shift capacity calculations
- Email template rendering
- Validation schemas

**Location:** `__tests__/unit/`

**Naming:** `[module].test.ts`

```typescript
// __tests__/unit/lib/shift-utils.test.ts
describe('calculateShiftCapacity', () => {
  it('should return true when shift has available spots', () => {
    const result = calculateShiftCapacity({
      confirmed: 3,
      maxVolunteers: 6,
    });
    expect(result.hasCapacity).toBe(true);
    expect(result.remaining).toBe(3);
  });
});
```

### 6.2 API Tests

**Purpose:** Test API route handlers with mocked database

**Examples:**
- Authentication endpoints
- CRUD operations for all resources
- Permission/authorization checks
- Error handling

**Location:** `__tests__/api/`

**Naming:** `[resource].api.test.ts`

```typescript
// __tests__/api/shifts.api.test.ts
describe('POST /api/shifts', () => {
  it('should create shift as coordinator', async () => {
    const response = await testClient
      .post('/api/shifts')
      .withAuth('coordinator')
      .send(validShiftData);

    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe(validShiftData.title);
  });

  it('should reject shift creation as volunteer', async () => {
    const response = await testClient
      .post('/api/shifts')
      .withAuth('volunteer')
      .send(validShiftData);

    expect(response.status).toBe(403);
  });
});
```

### 6.3 Integration Tests

**Purpose:** Test complete flows with real database

**Examples:**
- Shift creation → RSVP → Confirmation flow
- Training completion → Qualification grant
- User registration → Email verification
- Sighting report → Dispatcher notification

**Location:** `__tests__/integration/`

**Naming:** `[flow].integration.test.ts`

```typescript
// __tests__/integration/shift-rsvp.integration.test.ts
describe('Shift RSVP Flow', () => {
  it('should complete full RSVP lifecycle', async () => {
    // 1. Create shift
    const shift = await createShift({ minVolunteers: 2 });

    // 2. Volunteer RSVPs
    const rsvp = await createRsvp(shift.id, volunteer.id);
    expect(rsvp.status).toBe('PENDING');

    // 3. Coordinator confirms
    await confirmRsvp(rsvp.id);
    const updated = await getRsvp(rsvp.id);
    expect(updated.status).toBe('CONFIRMED');

    // 4. Verify email was triggered
    expect(mockEmailService.sends).toContainEmail({
      to: volunteer.email,
      template: 'shift-confirmed',
    });
  });
});
```

### 6.4 E2E Tests

**Purpose:** Test complete user journeys in real browser

**Examples:**
- Volunteer signs up → Completes profile → RSVPs to shift
- Coordinator creates shift → Manages roster → Confirms volunteers
- Admin configures zone → Creates shift type → Publishes shift

**Location:** `e2e/`

**Naming:** `[journey].spec.ts`

```typescript
// e2e/volunteer-journey.spec.ts
test.describe('Volunteer Journey', () => {
  test('new volunteer can RSVP to shift', async ({ page }) => {
    // Login as volunteer
    await page.goto('/login');
    await page.fill('[name="email"]', testVolunteer.email);
    await page.fill('[name="password"]', testVolunteer.password);
    await page.click('button[type="submit"]');

    // Navigate to shifts
    await page.click('text=Shifts');
    await page.waitForURL('/shifts');

    // Find and RSVP to shift
    await page.click(`[data-testid="shift-${testShift.id}"]`);
    await page.click('button:has-text("RSVP")');

    // Verify success
    await expect(page.locator('.toast-success')).toContainText('RSVP submitted');
  });
});
```

---

## 7. Priority Matrix

### P0 - Must Pass for Launch

| Test | Category | Description |
|------|----------|-------------|
| AUTH-001 | Auth | User can login with email/password |
| AUTH-002 | Auth | User can login with Google OAuth |
| AUTH-003 | Auth | Password reset flow works |
| AUTH-004 | Auth | Session expires correctly |
| SHIFT-001 | Shifts | Coordinator can create shift |
| SHIFT-002 | Shifts | Volunteer can RSVP to shift |
| SHIFT-003 | Shifts | Coordinator can confirm RSVP |
| SHIFT-004 | Shifts | Shift capacity limits enforced |
| TRAIN-001 | Training | Training session creation |
| TRAIN-002 | Training | Training RSVP and completion |
| EMAIL-001 | Email | Shift confirmation email sends |
| EMAIL-002 | Email | Password reset email sends |
| PERM-001 | Permissions | Role-based access enforced |
| PERM-002 | Permissions | Volunteers cannot access admin |

### P1 - Should Pass for Launch

| Test | Category | Description |
|------|----------|-------------|
| SIGHT-001 | Sightings | Public sighting report submission |
| SIGHT-002 | Sightings | Dispatcher receives notification |
| QUAL-001 | Qualifications | Training grants qualification |
| QUAL-002 | Qualifications | Qualification expiration works |
| ZONE-001 | Zones | Zone CRUD operations |
| BLAST-001 | Email Blast | Bulk email with filters |
| DASH-001 | Dashboard | Dashboard loads for all roles |

### P2 - Nice to Pass

| Test | Category | Description |
|------|----------|-------------|
| MAP-001 | Maps | Zone boundaries render |
| POI-001 | POI | POI creation and display |
| CAL-001 | Calendar | Calendar view renders correctly |
| ONBOARD-001 | Onboarding | Welcome tour completes |

---

## 8. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM UTC

jobs:
  unit-and-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run API tests
        run: npm run test:api

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: vms_test
        ports:
          - 5433:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: npm run db:test:setup

      - name: Run integration tests
        run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload E2E report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-Commit Hooks

```bash
# .husky/pre-commit
npm run test:unit -- --changed
npm run lint
```

### Pre-Push Hooks

```bash
# .husky/pre-push
npm run test:api
```

---

## 9. Performance Testing

### Key Metrics

| Endpoint | Target Response Time | Max Concurrent |
|----------|---------------------|----------------|
| GET /api/dashboard | < 500ms | 100 |
| GET /api/shifts | < 300ms | 200 |
| POST /api/shifts/[id]/rsvp | < 200ms | 50 |
| GET /api/schedule | < 400ms | 100 |
| POST /api/sightings | < 300ms | 20 |

### Load Testing (Optional)

```typescript
// __tests__/performance/load.test.ts
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  vus: 50,
  duration: '30s',
};

export default function () {
  const res = http.get('https://dev.ripple-vms.com/api/shifts');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

## 10. Security Testing

### Authentication Tests

- [ ] Password brute force protection (rate limiting)
- [ ] Session fixation prevention
- [ ] CSRF protection on state-changing operations
- [ ] Secure cookie attributes (httpOnly, secure, sameSite)
- [ ] JWT expiration and rotation

### Authorization Tests

- [ ] Volunteers cannot access /admin routes
- [ ] Coordinators cannot modify other coordinators' data
- [ ] API routes check session before database access
- [ ] Zone-scoped data access (future)

### Input Validation Tests

- [ ] SQL injection prevention (Prisma parameterized)
- [ ] XSS prevention (React escaping)
- [ ] Email validation on user creation
- [ ] File upload type restrictions
- [ ] Request size limits

### Data Protection Tests

- [ ] PII not exposed in API responses (unless authorized)
- [ ] Password hashes never returned
- [ ] Email enumeration prevention on forgot-password
- [ ] Unsubscribe tokens are cryptographically secure

---

## Appendix A: Test Naming Conventions

```
[CATEGORY]-[NUMBER]: [Brief Description]

Examples:
AUTH-001: User can login with email/password
SHIFT-003: Coordinator can confirm RSVP
PERM-002: Volunteers cannot access admin
```

## Appendix B: Test ID Attributes

Add `data-testid` attributes to critical UI elements:

```tsx
<button data-testid="rsvp-button">RSVP</button>
<div data-testid={`shift-${shift.id}`}>...</div>
<input data-testid="email-input" />
```

## Appendix C: Mocking External Services

```typescript
// __tests__/helpers/mocks.ts

export const mockEmailService = {
  sends: [],
  send: vi.fn((email) => {
    mockEmailService.sends.push(email);
    return Promise.resolve({ success: true });
  }),
  reset: () => {
    mockEmailService.sends = [];
    mockEmailService.send.mockClear();
  },
};

export const mockS3 = {
  uploads: [],
  upload: vi.fn((file) => {
    const url = `https://mock-s3.com/${file.name}`;
    mockS3.uploads.push({ file, url });
    return Promise.resolve({ url });
  }),
};
```

---

*Last Updated: December 2025*
