/**
 * Test Data Factories
 *
 * Factory functions for creating test data with sensible defaults
 * that can be overridden as needed.
 */

import { faker } from '@faker-js/faker';

// User Factories
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    role: 'VOLUNTEER',
    status: 'ACTIVE',
    phone: faker.phone.number(),
    emailNotifications: true,
    passwordHash: '$2a$12$test.hash.for.testing.purposes.only',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createVolunteer(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'VOLUNTEER', ...overrides });
}

export function createCoordinator(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'COORDINATOR', ...overrides });
}

export function createDispatcher(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'DISPATCHER', ...overrides });
}

export function createAdmin(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'ADMINISTRATOR', ...overrides });
}

// Zone Factories
export function createTestZone(overrides: Partial<TestZone> = {}): TestZone {
  const name = `${faker.location.city()} Zone ${faker.number.int({ min: 1, max: 10 })}`;
  return {
    id: faker.string.uuid(),
    name,
    county: faker.helpers.arrayElement(['DURHAM', 'ORANGE', 'WAKE']),
    description: faker.lorem.sentence(),
    color: faker.color.rgb(),
    active: true,
    signalLink: faker.internet.url(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Shift Factories
export function createTestShift(overrides: Partial<TestShift> = {}): TestShift {
  const date = faker.date.future();
  return {
    id: faker.string.uuid(),
    title: `${faker.word.adjective()} ${faker.word.noun()} Shift`,
    description: faker.lorem.paragraph(),
    date,
    startTime: '09:00',
    endTime: '13:00',
    zoneId: faker.string.uuid(),
    shiftTypeId: faker.string.uuid(),
    status: 'PUBLISHED',
    minVolunteers: 2,
    idealVolunteers: 4,
    maxVolunteers: 6,
    createdById: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createDraftShift(overrides: Partial<TestShift> = {}): TestShift {
  return createTestShift({ status: 'DRAFT', ...overrides });
}

export function createPublishedShift(overrides: Partial<TestShift> = {}): TestShift {
  return createTestShift({ status: 'PUBLISHED', ...overrides });
}

// Shift RSVP Factories
export function createTestRSVP(overrides: Partial<TestRSVP> = {}): TestRSVP {
  return {
    id: faker.string.uuid(),
    shiftId: faker.string.uuid(),
    userId: faker.string.uuid(),
    status: 'PENDING',
    qualifiedRoleId: null,
    isZoneLead: false,
    checkedInAt: null,
    checkedOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createConfirmedRSVP(overrides: Partial<TestRSVP> = {}): TestRSVP {
  return createTestRSVP({ status: 'CONFIRMED', ...overrides });
}

export function createPendingRSVP(overrides: Partial<TestRSVP> = {}): TestRSVP {
  return createTestRSVP({ status: 'PENDING', ...overrides });
}

// Training Factories
export function createTestTrainingType(
  overrides: Partial<TestTrainingType> = {}
): TestTrainingType {
  const name = `${faker.word.adjective()} Training`;
  return {
    id: faker.string.uuid(),
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    description: faker.lorem.sentence(),
    defaultDurationMinutes: 120,
    expiresAfterDays: null,
    grantsQualifiedRoleId: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestTrainingSession(
  overrides: Partial<TestTrainingSession> = {}
): TestTrainingSession {
  const date = faker.date.future();
  return {
    id: faker.string.uuid(),
    trainingTypeId: faker.string.uuid(),
    title: `${faker.word.adjective()} Training Session`,
    date,
    startTime: '10:00',
    endTime: '12:00',
    location: faker.location.streetAddress(),
    maxAttendees: 20,
    status: 'SCHEDULED',
    instructorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Sighting Factories
export function createTestSighting(overrides: Partial<TestSighting> = {}): TestSighting {
  return {
    id: faker.string.uuid(),
    size: faker.helpers.arrayElement(['1-2', '3-5', '6-10', '10+']),
    activity: faker.lorem.sentence(),
    location: faker.location.streetAddress(),
    latitude: faker.location.latitude(),
    longitude: faker.location.longitude(),
    time: new Date(),
    uniform: faker.lorem.words(3),
    equipment: faker.lorem.words(4),
    status: 'NEW',
    notes: faker.lorem.paragraph(),
    reporterName: faker.person.fullName(),
    reporterPhone: faker.phone.number(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Qualified Role Factories
export function createTestQualifiedRole(
  overrides: Partial<TestQualifiedRole> = {}
): TestQualifiedRole {
  const name = faker.word.noun();
  return {
    id: faker.string.uuid(),
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    description: faker.lorem.sentence(),
    color: faker.color.rgb(),
    countsTowardMinimum: true,
    active: true,
    sortOrder: faker.number.int({ min: 0, max: 100 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createShadowRole(overrides: Partial<TestQualifiedRole> = {}): TestQualifiedRole {
  return createTestQualifiedRole({
    name: 'Shadower',
    slug: 'shadower',
    countsTowardMinimum: false,
    ...overrides,
  });
}

// Email Blast Factories
export function createTestEmailBlast(overrides: Partial<TestEmailBlast> = {}): TestEmailBlast {
  return {
    id: faker.string.uuid(),
    subject: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(2),
    template: 'GENERAL_NEWSLETTER',
    filters: {},
    recipientCount: faker.number.int({ min: 10, max: 100 }),
    sentCount: 0,
    failedCount: 0,
    status: 'DRAFT',
    sentById: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Type Definitions
export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR';
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  phone?: string;
  emailNotifications: boolean;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestZone {
  id: string;
  name: string;
  county: 'DURHAM' | 'ORANGE' | 'WAKE';
  description?: string;
  color: string;
  active: boolean;
  signalLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestShift {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime: string;
  endTime: string;
  zoneId: string;
  shiftTypeId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  minVolunteers: number;
  idealVolunteers: number;
  maxVolunteers: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestRSVP {
  id: string;
  shiftId: string;
  userId: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'NO_SHOW';
  qualifiedRoleId: string | null;
  isZoneLead: boolean;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestTrainingType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  defaultDurationMinutes: number;
  expiresAfterDays: number | null;
  grantsQualifiedRoleId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestTrainingSession {
  id: string;
  trainingTypeId: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  maxAttendees: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  instructorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSighting {
  id: string;
  size: string;
  activity: string;
  location: string;
  latitude: number;
  longitude: number;
  time: Date;
  uniform: string;
  equipment: string;
  status: 'NEW' | 'REVIEWING' | 'VERIFIED' | 'RESPONDED' | 'CLOSED';
  notes?: string;
  reporterName?: string;
  reporterPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestQualifiedRole {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  countsTowardMinimum: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestEmailBlast {
  id: string;
  subject: string;
  body: string;
  template: 'GENERAL_NEWSLETTER' | 'SCHEDULE_ANNOUNCEMENT' | 'TRAINING_ANNOUNCEMENT' | 'FREEFORM';
  filters: Record<string, unknown>;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';
  sentById: string;
  createdAt: Date;
  updatedAt: Date;
}
