/**
 * E2E Test User Fixtures
 *
 * These users should exist in the test database before E2E tests run.
 */

export const testUsers = {
  volunteer: {
    email: 'e2e-volunteer@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Volunteer',
  },
  volunteer2: {
    email: 'e2e-volunteer2@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Volunteer Two',
  },
  coordinator: {
    email: 'e2e-coordinator@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Coordinator',
  },
  dispatcher: {
    email: 'e2e-dispatcher@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Dispatcher',
  },
  admin: {
    email: 'e2e-admin@test.com',
    password: 'E2ETestPassword123!',
    name: 'E2E Admin',
  },
};

export const testZones = {
  durham1: {
    id: 'e2e-zone-durham-1',
    name: 'E2E Durham 1',
  },
  orange1: {
    id: 'e2e-zone-orange-1',
    name: 'E2E Orange 1',
  },
};

export const testShiftTypes = {
  zonePatrol: {
    id: 'e2e-type-zone-patrol',
    name: 'Zone Patrol',
  },
  onCall: {
    id: 'e2e-type-on-call',
    name: 'On-Call',
  },
};
