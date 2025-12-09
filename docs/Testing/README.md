# RippleVMS Test Suite

**Version:** 1.0
**Target Release:** v1.0 Launch
**Last Updated:** December 2025

---

## Overview

This directory contains the comprehensive automated test suite for RippleVMS. The suite is designed to validate all critical functionality before the v1 launch.

## Test Categories

| Category | Framework | Purpose | Files |
|----------|-----------|---------|-------|
| **Unit Tests** | Vitest | Test isolated functions, utilities | `__tests__/unit/` |
| **API Tests** | Vitest + Supertest | Test API routes and responses | `__tests__/api/` |
| **Integration Tests** | Vitest | Test database operations | `__tests__/integration/` |
| **E2E Tests** | Playwright | Test complete user flows | `e2e/` |

## Quick Start

```bash
# Install test dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:api         # API tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests

# Run with coverage
npm run test:coverage

# Run in watch mode (development)
npm run test:watch
```

## Documentation

- [TEST_STRATEGY.md](./TEST_STRATEGY.md) - Complete testing strategy and approach
- [TEST_CASES.md](./TEST_CASES.md) - Detailed test case specifications
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - How to set up the test environment
- [E2E_SCENARIOS.md](./E2E_SCENARIOS.md) - End-to-end test scenarios
- [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) - Pre-launch verification checklist

## Test Coverage Goals

| Area | Target Coverage | Priority |
|------|-----------------|----------|
| Authentication | 95% | P0 |
| Shift Management | 90% | P0 |
| Training System | 85% | P1 |
| Email Notifications | 80% | P1 |
| Sighting Reports | 85% | P1 |
| Admin Features | 75% | P2 |
| UI Components | 60% | P3 |

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Nightly at 2:00 AM UTC

See `.github/workflows/test.yml` for configuration.

## Key Commands

```bash
# Database setup for tests
npm run db:test:setup     # Create test database
npm run db:test:seed      # Seed test data
npm run db:test:reset     # Reset test database

# Specific test runs
npm run test:auth         # Auth-related tests only
npm run test:shifts       # Shift-related tests only
npm run test:critical     # P0 tests only (pre-deploy)

# E2E specific
npm run e2e:headed        # Run E2E with browser visible
npm run e2e:debug         # Debug mode with Playwright inspector
npm run e2e:report        # View last E2E test report
```

## Pre-Launch Testing

Before v1 launch, ensure:

1. All P0 and P1 tests pass
2. Code coverage meets targets
3. E2E critical flows complete successfully
4. Performance benchmarks met
5. Security tests pass

Run the pre-launch suite:
```bash
npm run test:prelaunch
```
