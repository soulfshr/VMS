# Pre-Launch Testing Checklist

**Version:** 1.0
**Target Date:** v1 Launch (Next Week)
**Last Updated:** December 2025

---

## Overview

This checklist must be completed before launching RippleVMS v1 to production. All P0 items are **blocking** - the launch cannot proceed until they pass.

---

## Quick Status

| Category | Status | Pass Rate | Notes |
|----------|--------|-----------|-------|
| P0 Tests | ⬜ | 0/15 | Must be 100% |
| P1 Tests | ⬜ | 0/12 | Should be 90%+ |
| P2 Tests | ⬜ | 0/8 | Nice to have |
| E2E Tests | ⬜ | 0/8 | Critical flows |
| Security | ⬜ | 0/10 | Must be 100% |
| Performance | ⬜ | 0/5 | Must meet SLAs |

**Legend:** ✅ Pass | ⚠️ Warning | ❌ Fail | ⬜ Not Run

---

## 1. P0 Tests (BLOCKING)

All must pass for launch.

### Authentication

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| AUTH-001 | Login with email/password | ⬜ | | |
| AUTH-002 | Login with Google OAuth | ⬜ | | |
| AUTH-003 | Password reset flow | ⬜ | | |
| AUTH-004 | Session expiration | ⬜ | | |
| AUTH-005 | Logout clears session | ⬜ | | |

### Authorization

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| PERM-001 | Volunteer cannot access admin routes | ⬜ | | |
| PERM-002 | Coordinator cannot modify admin settings | ⬜ | | |
| PERM-003 | API requires authentication | ⬜ | | |

### Shifts

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| SHIFT-001 | Coordinator can create shift | ⬜ | | |
| SHIFT-002 | Volunteer can RSVP | ⬜ | | |
| SHIFT-003 | Coordinator can confirm RSVP | ⬜ | | |
| SHIFT-004 | Shift capacity enforced | ⬜ | | |

### Email

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| EMAIL-001 | Confirmation email sends | ⬜ | | |
| EMAIL-002 | Password reset email sends | ⬜ | | |
| EMAIL-003 | Emails render correctly | ⬜ | | |

---

## 2. P1 Tests (Should Pass)

Target: 90%+ pass rate.

### Training

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| TRAIN-001 | Create training session | ⬜ | | |
| TRAIN-002 | RSVP to training | ⬜ | | |
| TRAIN-003 | Training grants qualification | ⬜ | | |

### Sightings

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| SIGHT-001 | Public sighting submission | ⬜ | | |
| SIGHT-002 | Dispatcher notification | ⬜ | | |
| SIGHT-003 | Status workflow | ⬜ | | |

### Dashboard

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| DASH-001 | Volunteer dashboard loads | ⬜ | | |
| DASH-002 | Coordinator dashboard loads | ⬜ | | |
| DASH-003 | Correct data displayed | ⬜ | | |

### Email Blast

| ID | Test | Status | Verified By | Date |
|----|------|--------|-------------|------|
| BLAST-001 | Create and send blast | ⬜ | | |
| BLAST-002 | Filters apply correctly | ⬜ | | |
| BLAST-003 | Unsubscribe works | ⬜ | | |

---

## 3. E2E Critical Flows

| Scenario | Status | Browser | Mobile | Notes |
|----------|--------|---------|--------|-------|
| Volunteer registration & RSVP | ⬜ | ⬜ | ⬜ | |
| Coordinator creates shift | ⬜ | ⬜ | ⬜ | |
| Full RSVP lifecycle | ⬜ | ⬜ | ⬜ | |
| Training completion | ⬜ | ⬜ | ⬜ | |
| Public sighting report | ⬜ | ⬜ | ⬜ | |
| Password reset | ⬜ | ⬜ | ⬜ | |
| Admin configuration | ⬜ | ⬜ | ⬜ | |
| Email blast | ⬜ | ⬜ | ⬜ | |

---

## 4. Security Checklist

All must pass for launch.

| ID | Check | Status | Notes |
|----|-------|--------|-------|
| SEC-001 | No sensitive data in client bundle | ⬜ | Check for API keys, secrets |
| SEC-002 | All API routes check auth | ⬜ | No unauthenticated access |
| SEC-003 | Password hashing (bcrypt 12+) | ⬜ | Verify hash rounds |
| SEC-004 | HTTPS enforced | ⬜ | No HTTP in production |
| SEC-005 | Secure cookie attributes | ⬜ | httpOnly, secure, sameSite |
| SEC-006 | CSRF protection | ⬜ | State-changing operations |
| SEC-007 | Rate limiting on auth | ⬜ | Login, password reset |
| SEC-008 | SQL injection prevention | ⬜ | Prisma parameterized |
| SEC-009 | XSS prevention | ⬜ | React escaping |
| SEC-010 | Email enumeration blocked | ⬜ | Forgot password response |

---

## 5. Performance Checklist

| Endpoint | Target | Actual | Status | Notes |
|----------|--------|--------|--------|-------|
| Dashboard load | < 2s | | ⬜ | First contentful paint |
| Shifts list (50) | < 500ms | | ⬜ | API response time |
| RSVP action | < 300ms | | ⬜ | Includes DB write |
| Login | < 500ms | | ⬜ | Auth flow complete |
| Sighting submit | < 500ms | | ⬜ | Includes notification |

---

## 6. Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | Latest | ⬜ | |
| Firefox | Latest | ⬜ | |
| Safari | Latest | ⬜ | |
| Edge | Latest | ⬜ | |
| Chrome Mobile | Latest | ⬜ | |
| Safari iOS | Latest | ⬜ | |

---

## 7. Database Verification

| Check | Status | Notes |
|-------|--------|-------|
| Migrations applied | ⬜ | All migrations in production |
| Indexes created | ⬜ | Performance-critical indexes |
| Seed data loaded | ⬜ | Zones, shift types, training types |
| Backups configured | ⬜ | Neon automated backups |
| Connection pooling | ⬜ | PgBouncer enabled |

---

## 8. Infrastructure

| Check | Status | Notes |
|-------|--------|-------|
| Vercel production deployed | ⬜ | |
| Environment variables set | ⬜ | All required vars |
| Domain configured | ⬜ | SSL certificate valid |
| Error tracking (Sentry) | ⬜ | Errors reported |
| Email service (SES/Resend) | ⬜ | Verified sender domain |

---

## 9. Pre-Launch Commands

Run these commands to execute the pre-launch test suite:

```bash
# 1. Start test database
npm run db:test:setup

# 2. Run all unit and API tests
npm run test:unit && npm run test:api

# 3. Run integration tests
npm run test:integration

# 4. Run E2E tests
npm run test:e2e

# 5. Generate coverage report
npm run test:coverage

# 6. Run security audit
npm audit

# 7. Run pre-launch suite (all of the above)
npm run test:prelaunch
```

---

## 10. Sign-Off

### Required Approvals

| Role | Name | Approved | Date | Signature |
|------|------|----------|------|-----------|
| Tech Lead | | ⬜ | | |
| QA Lead | | ⬜ | | |
| Product Owner | | ⬜ | | |

### Launch Decision

| Criteria | Met |
|----------|-----|
| All P0 tests pass | ⬜ |
| P1 tests ≥ 90% pass | ⬜ |
| E2E critical flows pass | ⬜ |
| Security checklist complete | ⬜ |
| Performance SLAs met | ⬜ |
| All sign-offs obtained | ⬜ |

**Launch Approved:** ⬜ Yes / ⬜ No

**Launch Date:** ________________

**Notes:**

---

## Post-Launch Monitoring

After launch, monitor:

- [ ] Error rates in Sentry
- [ ] API response times
- [ ] Database connection pool
- [ ] Email delivery rates
- [ ] User signups
- [ ] Shift RSVPs

### Rollback Criteria

Immediately rollback if:
- Authentication fails for >5% of attempts
- Critical API endpoints return 500 errors
- Database connection pool exhausted
- Email delivery rate drops below 90%

### Rollback Command

```bash
# Revert to previous deployment
vercel rollback
```

---

*Last Updated: December 2025*
