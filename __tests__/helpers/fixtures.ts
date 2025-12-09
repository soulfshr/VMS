/**
 * Test Fixtures
 *
 * Static, reusable test data for consistent testing.
 * These represent common test scenarios with predictable IDs.
 */

// ============================================
// USER FIXTURES
// ============================================

export const testUsers = {
  volunteer: {
    id: 'user-volunteer-1',
    email: 'volunteer@test.com',
    name: 'Test Volunteer',
    role: 'VOLUNTEER' as const,
    status: 'ACTIVE' as const,
    phone: '(919) 555-0101',
    emailNotifications: true,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uWpFwpHQjgQC2C', // TestPassword123!
  },
  volunteer2: {
    id: 'user-volunteer-2',
    email: 'volunteer2@test.com',
    name: 'Second Volunteer',
    role: 'VOLUNTEER' as const,
    status: 'ACTIVE' as const,
    phone: '(919) 555-0102',
    emailNotifications: true,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uWpFwpHQjgQC2C',
  },
  coordinator: {
    id: 'user-coordinator-1',
    email: 'coordinator@test.com',
    name: 'Test Coordinator',
    role: 'COORDINATOR' as const,
    status: 'ACTIVE' as const,
    phone: '(919) 555-0201',
    emailNotifications: true,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uWpFwpHQjgQC2C',
  },
  dispatcher: {
    id: 'user-dispatcher-1',
    email: 'dispatcher@test.com',
    name: 'Test Dispatcher',
    role: 'DISPATCHER' as const,
    status: 'ACTIVE' as const,
    phone: '(919) 555-0301',
    emailNotifications: true,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uWpFwpHQjgQC2C',
  },
  admin: {
    id: 'user-admin-1',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMINISTRATOR' as const,
    status: 'ACTIVE' as const,
    phone: '(919) 555-0401',
    emailNotifications: true,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uWpFwpHQjgQC2C',
  },
  inactiveVolunteer: {
    id: 'user-inactive-1',
    email: 'inactive@test.com',
    name: 'Inactive Volunteer',
    role: 'VOLUNTEER' as const,
    status: 'INACTIVE' as const,
    phone: '(919) 555-0501',
    emailNotifications: false,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uWpFwpHQjgQC2C',
  },
};

export const testPassword = 'TestPassword123!';

// ============================================
// ZONE FIXTURES
// ============================================

export const testZones = {
  durham1: {
    id: 'zone-durham-1',
    name: 'Durham 1',
    county: 'DURHAM' as const,
    description: 'Central Durham area',
    color: '#3B82F6',
    active: true,
    signalLink: 'https://signal.group/durham1',
  },
  durham2: {
    id: 'zone-durham-2',
    name: 'Durham 2',
    county: 'DURHAM' as const,
    description: 'South Durham area',
    color: '#10B981',
    active: true,
    signalLink: 'https://signal.group/durham2',
  },
  orange1: {
    id: 'zone-orange-1',
    name: 'Orange 1',
    county: 'ORANGE' as const,
    description: 'Chapel Hill area',
    color: '#F59E0B',
    active: true,
    signalLink: 'https://signal.group/orange1',
  },
  wake1: {
    id: 'zone-wake-1',
    name: 'Wake 1',
    county: 'WAKE' as const,
    description: 'Raleigh area',
    color: '#8B5CF6',
    active: true,
    signalLink: 'https://signal.group/wake1',
  },
  inactiveZone: {
    id: 'zone-inactive',
    name: 'Inactive Zone',
    county: 'DURHAM' as const,
    description: 'This zone is archived',
    color: '#6B7280',
    active: false,
    signalLink: null,
  },
};

// ============================================
// SHIFT TYPE FIXTURES
// ============================================

export const testShiftTypes = {
  zonePatrol: {
    id: 'type-zone-patrol',
    name: 'Zone Patrol',
    slug: 'zone-patrol',
    description: 'Regular zone patrol shift',
    color: '#3B82F6',
    active: true,
    defaultDurationMinutes: 240,
    defaultMinVolunteers: 2,
    defaultIdealVolunteers: 4,
    defaultMaxVolunteers: 6,
  },
  onCall: {
    id: 'type-on-call',
    name: 'On-Call',
    slug: 'on-call',
    description: 'On-call response shift',
    color: '#10B981',
    active: true,
    defaultDurationMinutes: 480,
    defaultMinVolunteers: 1,
    defaultIdealVolunteers: 2,
    defaultMaxVolunteers: 3,
  },
  intelCollection: {
    id: 'type-intel',
    name: 'Intel Collection',
    slug: 'intel-collection',
    description: 'Intelligence gathering shift',
    color: '#F59E0B',
    active: true,
    defaultDurationMinutes: 180,
    defaultMinVolunteers: 1,
    defaultIdealVolunteers: 2,
    defaultMaxVolunteers: 4,
  },
};

// ============================================
// QUALIFIED ROLE FIXTURES
// ============================================

export const testQualifiedRoles = {
  verifier: {
    id: 'role-verifier',
    name: 'Verifier',
    slug: 'verifier',
    description: 'Can verify sighting reports',
    color: '#8B5CF6',
    countsTowardMinimum: true,
    active: true,
    sortOrder: 1,
  },
  zoneLead: {
    id: 'role-zone-lead',
    name: 'Zone Lead',
    slug: 'zone-lead',
    description: 'Can lead zone patrols',
    color: '#EC4899',
    countsTowardMinimum: true,
    active: true,
    sortOrder: 2,
  },
  dispatcher: {
    id: 'role-dispatcher',
    name: 'Dispatcher',
    slug: 'dispatcher',
    description: 'Qualified to dispatch responses',
    color: '#EF4444',
    countsTowardMinimum: true,
    active: true,
    sortOrder: 3,
  },
  shadower: {
    id: 'role-shadower',
    name: 'Shadower',
    slug: 'shadower',
    description: 'Training/observing, does not count toward minimum',
    color: '#6B7280',
    countsTowardMinimum: false,
    active: true,
    sortOrder: 10,
  },
};

// ============================================
// TRAINING TYPE FIXTURES
// ============================================

export const testTrainingTypes = {
  basicOrientation: {
    id: 'training-type-basic',
    name: 'Basic Orientation',
    slug: 'basic-orientation',
    description: 'Required initial training for all volunteers',
    defaultDurationMinutes: 120,
    expiresAfterDays: null,
    grantsQualifiedRoleId: null,
    active: true,
  },
  verifierTraining: {
    id: 'training-type-verifier',
    name: 'Verifier Training',
    slug: 'verifier-training',
    description: 'Training to become a verifier',
    defaultDurationMinutes: 180,
    expiresAfterDays: 365,
    grantsQualifiedRoleId: 'role-verifier',
    active: true,
  },
  zoneLeadTraining: {
    id: 'training-type-zone-lead',
    name: 'Zone Lead Training',
    slug: 'zone-lead-training',
    description: 'Training to become a zone lead',
    defaultDurationMinutes: 240,
    expiresAfterDays: 365,
    grantsQualifiedRoleId: 'role-zone-lead',
    active: true,
  },
};

// ============================================
// SHIFT FIXTURES
// ============================================

// Helper to get future date
const getFutureDate = (daysFromNow: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const testShifts = {
  upcomingPublished: {
    id: 'shift-upcoming-1',
    title: 'Morning Zone Patrol',
    description: 'Regular morning patrol in Durham 1',
    date: getFutureDate(3),
    startTime: '09:00',
    endTime: '13:00',
    zoneId: 'zone-durham-1',
    shiftTypeId: 'type-zone-patrol',
    status: 'PUBLISHED' as const,
    minVolunteers: 2,
    idealVolunteers: 4,
    maxVolunteers: 6,
    createdById: 'user-coordinator-1',
  },
  upcomingDraft: {
    id: 'shift-draft-1',
    title: 'Draft Shift',
    description: 'This shift is not yet published',
    date: getFutureDate(5),
    startTime: '14:00',
    endTime: '18:00',
    zoneId: 'zone-durham-2',
    shiftTypeId: 'type-zone-patrol',
    status: 'DRAFT' as const,
    minVolunteers: 2,
    idealVolunteers: 4,
    maxVolunteers: 6,
    createdById: 'user-coordinator-1',
  },
  fullyStaffed: {
    id: 'shift-full-1',
    title: 'Fully Staffed Shift',
    description: 'This shift is at capacity',
    date: getFutureDate(7),
    startTime: '10:00',
    endTime: '14:00',
    zoneId: 'zone-orange-1',
    shiftTypeId: 'type-zone-patrol',
    status: 'PUBLISHED' as const,
    minVolunteers: 2,
    idealVolunteers: 2,
    maxVolunteers: 2,
    createdById: 'user-coordinator-1',
  },
  cancelled: {
    id: 'shift-cancelled-1',
    title: 'Cancelled Shift',
    description: 'This shift was cancelled',
    date: getFutureDate(10),
    startTime: '08:00',
    endTime: '12:00',
    zoneId: 'zone-wake-1',
    shiftTypeId: 'type-on-call',
    status: 'CANCELLED' as const,
    minVolunteers: 1,
    idealVolunteers: 2,
    maxVolunteers: 3,
    createdById: 'user-coordinator-1',
  },
};

// ============================================
// TRAINING SESSION FIXTURES
// ============================================

export const testTrainingSessions = {
  upcomingBasic: {
    id: 'training-session-1',
    trainingTypeId: 'training-type-basic',
    title: 'Basic Orientation - December',
    date: getFutureDate(7),
    startTime: '10:00',
    endTime: '12:00',
    location: '123 Main St, Durham NC',
    maxAttendees: 20,
    status: 'SCHEDULED' as const,
    instructorId: 'user-coordinator-1',
  },
  upcomingVerifier: {
    id: 'training-session-2',
    trainingTypeId: 'training-type-verifier',
    title: 'Verifier Training - December',
    date: getFutureDate(14),
    startTime: '09:00',
    endTime: '12:00',
    location: '456 Oak St, Chapel Hill NC',
    maxAttendees: 15,
    status: 'SCHEDULED' as const,
    instructorId: 'user-coordinator-1',
  },
};

// ============================================
// SIGHTING FIXTURES
// ============================================

export const testSightings = {
  newSighting: {
    id: 'sighting-new-1',
    size: '3-5',
    activity: 'Vehicle checkpoint observed',
    location: 'Main St & 5th Ave, Durham NC',
    latitude: 35.994,
    longitude: -78.8986,
    time: new Date(),
    uniform: 'Plain clothes with tactical vests',
    equipment: 'Radios, unmarked SUVs',
    status: 'NEW' as const,
    notes: null,
    reporterName: 'Anonymous',
    reporterPhone: null,
  },
  verifiedSighting: {
    id: 'sighting-verified-1',
    size: '6-10',
    activity: 'Active enforcement operation',
    location: 'Industrial Blvd, Durham NC',
    latitude: 35.988,
    longitude: -78.91,
    time: new Date(Date.now() - 3600000), // 1 hour ago
    uniform: 'ICE jackets',
    equipment: 'Multiple vehicles, vans',
    status: 'VERIFIED' as const,
    notes: 'Verified by field team',
    reporterName: 'Community Member',
    reporterPhone: '(919) 555-1234',
  },
};

// ============================================
// EMAIL BLAST FIXTURES
// ============================================

export const testEmailBlasts = {
  draftBlast: {
    id: 'blast-draft-1',
    subject: 'Draft Newsletter',
    body: 'This is a draft email blast.',
    template: 'GENERAL_NEWSLETTER' as const,
    filters: {},
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    status: 'DRAFT' as const,
    sentById: 'user-coordinator-1',
  },
  sentBlast: {
    id: 'blast-sent-1',
    subject: 'Weekly Update',
    body: 'Weekly update content here.',
    template: 'GENERAL_NEWSLETTER' as const,
    filters: { zones: ['zone-durham-1'] },
    recipientCount: 25,
    sentCount: 24,
    failedCount: 1,
    status: 'SENT' as const,
    sentById: 'user-coordinator-1',
  },
};

// ============================================
// SCENARIO FIXTURES
// ============================================

/**
 * Complete scenario: Shift with pending RSVPs
 */
export const shiftWithPendingRSVPs = {
  shift: testShifts.upcomingPublished,
  rsvps: [
    {
      id: 'rsvp-pending-1',
      shiftId: 'shift-upcoming-1',
      userId: 'user-volunteer-1',
      status: 'PENDING' as const,
      qualifiedRoleId: null,
      isZoneLead: false,
    },
    {
      id: 'rsvp-pending-2',
      shiftId: 'shift-upcoming-1',
      userId: 'user-volunteer-2',
      status: 'PENDING' as const,
      qualifiedRoleId: null,
      isZoneLead: false,
    },
  ],
};

/**
 * Complete scenario: Shift with confirmed RSVPs
 */
export const shiftWithConfirmedRSVPs = {
  shift: testShifts.fullyStaffed,
  rsvps: [
    {
      id: 'rsvp-confirmed-1',
      shiftId: 'shift-full-1',
      userId: 'user-volunteer-1',
      status: 'CONFIRMED' as const,
      qualifiedRoleId: null,
      isZoneLead: true,
    },
    {
      id: 'rsvp-confirmed-2',
      shiftId: 'shift-full-1',
      userId: 'user-volunteer-2',
      status: 'CONFIRMED' as const,
      qualifiedRoleId: null,
      isZoneLead: false,
    },
  ],
};
