#!/usr/bin/env tsx
// Seed script for Siembra NC VMS

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, ShiftType, TrainingStatus } from '../src/generated/prisma/client';

// Load environment variables
dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

  // Create pool with standard pg driver (works better for scripts)
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Starting seed...');

  // Clear existing data (in reverse dependency order)
  console.log('Clearing existing data...');
  await prisma.shiftVolunteer.deleteMany();
  await prisma.dispatcherAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.userTraining.deleteMany();
  await prisma.training.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.userZone.deleteMany();
  await prisma.trainingSessionAttendee.deleteMany();
  await prisma.trainingSession.deleteMany();  // Must be before user (createdById FK)
  await prisma.user.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.shiftTypeRoleRequirement.deleteMany();
  await prisma.shiftTypeConfig.deleteMany();
  await prisma.trainingType.deleteMany();
  await prisma.organizationSettings.deleteMany();

  // ============================================
  // ORGANIZATION SETTINGS (singleton)
  // ============================================
  console.log('Creating organization settings...');
  await prisma.organizationSettings.create({
    data: {
      id: 'org-settings-1',
      autoConfirmRsvp: false,  // Require manual confirmation by default
      timezone: 'America/New_York',
    },
  });
  console.log('✓ Created organization settings');

  // ============================================
  // SHIFT TYPE CONFIGURATIONS
  // ============================================
  console.log('Creating shift type configurations...');
  const shiftTypeConfigs = await Promise.all([
    prisma.shiftTypeConfig.create({
      data: {
        id: 'shift-type-patrol',
        name: 'Patrol',
        slug: 'PATROL',
        description: 'Community patrol shifts for area monitoring and presence',
        color: '#3b82f6',  // Blue
        defaultMinVolunteers: 2,
        defaultIdealVolunteers: 4,
        defaultMaxVolunteers: 6,
        sortOrder: 1,
        roleRequirements: {
          create: [
            { role: Role.VOLUNTEER, minRequired: 2, maxAllowed: 6 },
          ],
        },
      },
    }),
    prisma.shiftTypeConfig.create({
      data: {
        id: 'shift-type-collection',
        name: 'Collection',
        slug: 'COLLECTION',
        description: 'Intelligence collection and monitoring shifts',
        color: '#a855f7',  // Purple
        defaultMinVolunteers: 1,
        defaultIdealVolunteers: 2,
        defaultMaxVolunteers: 3,
        sortOrder: 2,
        roleRequirements: {
          create: [
            { role: Role.VOLUNTEER, minRequired: 1, maxAllowed: 3 },
          ],
        },
      },
    }),
    prisma.shiftTypeConfig.create({
      data: {
        id: 'shift-type-on-call',
        name: 'On-Call Field Support',
        slug: 'ON_CALL_FIELD_SUPPORT',
        description: 'On-call shifts for rapid response and field support',
        color: '#f97316',  // Orange
        defaultMinVolunteers: 2,
        defaultIdealVolunteers: 3,
        defaultMaxVolunteers: 4,
        sortOrder: 3,
        roleRequirements: {
          create: [
            { role: Role.DISPATCHER, minRequired: 1, maxAllowed: 1 },
            { role: Role.VOLUNTEER, minRequired: 1, maxAllowed: 3 },
          ],
        },
      },
    }),
  ]);
  console.log(`✓ Created ${shiftTypeConfigs.length} shift type configurations`);

  const shiftTypeMap = Object.fromEntries(shiftTypeConfigs.map(st => [st.slug, st]));

  // ============================================
  // TRAINING TYPES (for schedulable training sessions)
  // ============================================
  console.log('Creating training types...');
  const trainingTypes = await Promise.all([
    prisma.trainingType.create({
      data: {
        id: 'training-type-verifier',
        name: 'Verifier',
        slug: 'VERIFIER',
        description: 'Learn to verify and document incidents accurately. Verifiers ensure all field reports are complete and properly documented.',
        color: '#10b981',  // Green
        defaultDuration: 90,
        defaultCapacity: 15,
        sortOrder: 1,
      },
    }),
    prisma.trainingType.create({
      data: {
        id: 'training-type-zone-lead',
        name: 'Zone Lead',
        slug: 'ZONE_LEAD',
        description: 'Leadership training for coordinating zone activities. Zone leads manage volunteer teams and coordinate field operations.',
        color: '#f59e0b',  // Amber
        defaultDuration: 120,
        defaultCapacity: 10,
        grantsRole: Role.COORDINATOR,
        sortOrder: 2,
      },
    }),
    prisma.trainingType.create({
      data: {
        id: 'training-type-dispatcher',
        name: 'Dispatcher',
        slug: 'DISPATCHER',
        description: 'Training for dispatch operations and communication. Dispatchers coordinate real-time response and manage incoming reports.',
        color: '#6366f1',  // Indigo
        defaultDuration: 150,
        defaultCapacity: 8,
        grantsRole: Role.DISPATCHER,
        sortOrder: 3,
      },
    }),
  ]);
  console.log(`✓ Created ${trainingTypes.length} training types`);

  // ============================================
  // ZONES (13 zones across 3 counties)
  // ============================================
  console.log('Creating zones...');
  const zones = await Promise.all([
    // Durham County (5 zones)
    prisma.zone.create({ data: {
      name: 'Durham 1',
      county: 'Durham',
      description: 'Hillside High School area',
      signalGroup: 'https://signal.group/#CjQKIL6Qi3T-IJ_MzLkNHrq6jBvCYg-zh6IfNXjGLsP_ohckEhC16Jxu5FMRe0kGJtJkV9_E',
    } }),
    prisma.zone.create({ data: {
      name: 'Durham 2',
      county: 'Durham',
      description: 'Jordan High School area',
      signalGroup: 'https://signal.group/#CjQKIPsm6G8KkCmTtoaX-AgiL391N9mzX6v6MDr_lAlycErGEhD_v2jOKjrtjvYjhmaaDV1D',
    } }),
    prisma.zone.create({ data: {
      name: 'Durham 3',
      county: 'Durham',
      description: 'Northern High School area',
      signalGroup: 'https://signal.group/#CjQKIDsTQ_XQQQ-UpFtaPehSw-yxaOhPrtAmKnUsrTwx6JedEhBqjh-8tB9CpRDPgPEbh_6H',
    } }),
    prisma.zone.create({ data: {
      name: 'Durham 4',
      county: 'Durham',
      description: 'Riverside High School area',
      signalGroup: 'https://signal.group/#CjQKIO7OocZMmleFxtHC-Xb_Gm2oK6R7HdeZrYrA6ACwYUxYEhCjLJZuNv4FE80cfmcx8U1b',
    } }),
    prisma.zone.create({ data: {
      name: 'Durham 5',
      county: 'Durham',
      description: 'Southern High School area',
      signalGroup: 'https://signal.group/#CjQKIAroMWnMelx2Q_D6Gth76Ip-h_zuFRuqghX7-X0SFGoqEhDPoxBiph2G179Cz5GcZh_o',
    } }),
    // Wake County (6 zones)
    prisma.zone.create({ data: {
      name: 'Wake 1',
      county: 'Wake',
      description: 'West Raleigh - Broughton, Athens Drive',
      signalGroup: 'https://signal.group/#CjQKICWRKySj9eXJk5G4M34uKFaLMHAxjAtVznyLDixjnSqZEhApBC6k0YRy40CkodWqnVfi',
    } }),
    prisma.zone.create({ data: {
      name: 'Wake 2',
      county: 'Wake',
      description: 'East Raleigh - Enloe, Southeast Raleigh',
      signalGroup: 'https://signal.group/#CjQKIG-4pNSOjdliF8VZhJfmfwBuXUWtw0yB4vDfrxbpu5YsEhAAWHHtYE03KTMdl_jYsZZt',
    } }),
    prisma.zone.create({ data: {
      name: 'Wake 3',
      county: 'Wake',
      description: 'Garner, South Garner',
      signalGroup: 'https://signal.group/#CjQKIFrPdEzMJMeVNnA-bGJXiEF273ASWMMhhqi8UTx2YI3CEhAO_4IAl_atkfV00H5s0Tb5',
    } }),
    prisma.zone.create({ data: {
      name: 'Wake 4',
      county: 'Wake',
      description: 'North East - Sanderson, Millbrook, Leesville',
      signalGroup: 'https://signal.group/#CjQKIBjxHa1Zx1FNMYP0V9WG9M4qDzGR8j0Q890uVKLlAsF2EhCe74UJXKDRVAzSVzwc192e',
    } }),
    prisma.zone.create({ data: {
      name: 'Wake 5',
      county: 'Wake',
      description: 'Cary - Green Hope, Green Level, Panther Creek',
      signalGroup: 'https://signal.group/#CjQKIKfyY2Ev5KRMsuL-xYjfpPZfiSewLQ2J2nvwI5hqHnUGEhAj-p34oiXyoIQn1mbEeyN_',
    } }),
    prisma.zone.create({ data: {
      name: 'Wake 6',
      county: 'Wake',
      description: 'South Wake - Holly Springs, Fuquay Varina',
      signalGroup: 'https://signal.group/#CjQKIO3SuiiaBu8wpe3l81xxU88PjlYB4w5tora6paVS3gKBEhDaQc23YJa2tZNTBqlto5zn',
    } }),
    // Orange County (2 zones)
    prisma.zone.create({ data: {
      name: 'Orange 1',
      county: 'Orange',
      description: 'Chapel Hill/Carrboro',
      signalGroup: 'https://signal.group/#CjQKINw_8ao7_hTI0MxDlqVLUCI0-rsZEiKbYgFMtXTC8IfiEhDElrpKqJdbjt4P6vbI3D6E',
    } }),
    prisma.zone.create({ data: {
      name: 'Orange 2',
      county: 'Orange',
      description: 'Hillsborough and surrounding areas',
      signalGroup: 'https://signal.group/#CjQKIEUWYGlBd_kcAdYp-lFnjF1farLZC5A8-NisFiGzoDQ-EhCm9CUpQvnRWQPy8rbdleBk',
    } }),
  ]);
  console.log(`✓ Created ${zones.length} zones`);

  const zoneMap = Object.fromEntries(zones.map(z => [z.name, z]));

  // ============================================
  // TRAINING MODULES
  // ============================================
  console.log('Creating training modules...');
  const trainings = await Promise.all([
    prisma.training.create({
      data: {
        name: 'Volunteer Orientation',
        description: 'Introduction to Siembra NC mission, policies, procedures, and volunteer expectations',
        duration: 45,
        isRequired: true,
        requiredForRoles: [Role.VOLUNTEER, Role.COORDINATOR, Role.DISPATCHER],
      },
    }),
    prisma.training.create({
      data: {
        name: 'Safety & De-escalation',
        description: 'Personal safety protocols, situational awareness, and de-escalation techniques for field work',
        duration: 60,
        isRequired: true,
        requiredForRoles: [Role.VOLUNTEER],
        requiredForShiftTypes: [ShiftType.PATROL, ShiftType.ON_CALL_FIELD_SUPPORT],
      },
    }),
    prisma.training.create({
      data: {
        name: 'Documentation & Reporting',
        description: 'How to properly document and report incidents, use the VMS system, and maintain records',
        duration: 30,
        isRequired: true,
        requiredForRoles: [Role.VOLUNTEER, Role.COORDINATOR, Role.DISPATCHER],
      },
    }),
    prisma.training.create({
      data: {
        name: 'Know Your Rights',
        description: 'Legal rights of community members during encounters, resources available, and how to provide know-your-rights information',
        duration: 45,
        isRequired: true,
        requiredForRoles: [Role.VOLUNTEER],
      },
    }),
    prisma.training.create({
      data: {
        name: 'Intel Collection',
        description: 'Social media monitoring, source verification, OSINT techniques, and information management',
        duration: 60,
        isRequired: false,
        requiredForShiftTypes: [ShiftType.COLLECTION],
      },
    }),
    prisma.training.create({
      data: {
        name: 'Advanced Field Operations',
        description: 'Advanced techniques for experienced volunteers including team coordination and complex scenarios',
        duration: 90,
        isRequired: false,
        expiresAfterDays: 365,
      },
    }),
    prisma.training.create({
      data: {
        name: 'Coordinator Training',
        description: 'Zone management, volunteer scheduling, and shift coordination',
        duration: 120,
        isRequired: true,
        requiredForRoles: [Role.COORDINATOR],
      },
    }),
    prisma.training.create({
      data: {
        name: 'Dispatcher Training',
        description: 'Incident intake, dispatch protocols, and communication management',
        duration: 90,
        isRequired: true,
        requiredForRoles: [Role.DISPATCHER],
      },
    }),
  ]);
  console.log(`✓ Created ${trainings.length} training modules`);

  const trainingMap = Object.fromEntries(trainings.map(t => [t.name, t]));

  // ============================================
  // USERS
  // ============================================
  console.log('Creating users...');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: 'admin-1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: Role.ADMINISTRATOR,
        qualifiedRoles: [Role.ADMINISTRATOR],
        phone: '(919) 555-0100',
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'coord-1',
        email: 'coord@test.com',
        name: 'Coordinator User',
        role: Role.COORDINATOR,
        qualifiedRoles: [Role.COORDINATOR, Role.VOLUNTEER],  // Coordinators can also fill volunteer slots
        phone: '(919) 555-0101',
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'disp-1',
        email: 'disp@test.com',
        name: 'Dispatcher User',
        role: Role.DISPATCHER,
        qualifiedRoles: [Role.DISPATCHER, Role.VOLUNTEER],  // Dispatchers can also fill volunteer slots
        phone: '(919) 555-0102',
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'vol-1',
        email: 'maria@test.com',
        name: 'Maria Rodriguez',
        role: Role.VOLUNTEER,
        qualifiedRoles: [Role.VOLUNTEER],
        phone: '(919) 555-0123',
        primaryLanguage: 'Spanish',
        otherLanguages: ['English'],
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'vol-2',
        email: 'james@test.com',
        name: 'James Kim',
        role: Role.VOLUNTEER,
        qualifiedRoles: [Role.VOLUNTEER, Role.DISPATCHER],  // James is also qualified as dispatcher
        phone: '(919) 555-0124',
        primaryLanguage: 'English',
        otherLanguages: ['Korean'],
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'vol-3',
        email: 'ana@test.com',
        name: 'Ana Lopez',
        role: Role.VOLUNTEER,
        qualifiedRoles: [Role.VOLUNTEER],
        phone: '(919) 555-0125',
        primaryLanguage: 'Spanish',
        otherLanguages: ['English'],
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'vol-4',
        email: 'david@test.com',
        name: 'David Chen',
        role: Role.VOLUNTEER,
        qualifiedRoles: [Role.VOLUNTEER],
        phone: '(919) 555-0126',
        primaryLanguage: 'English',
        otherLanguages: ['Mandarin'],
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        id: 'vol-5',
        email: 'patricia@test.com',
        name: 'Patricia Williams',
        role: Role.VOLUNTEER,
        qualifiedRoles: [Role.VOLUNTEER],
        phone: '(919) 555-0127',
        primaryLanguage: 'English',
        isVerified: true,
      },
    }),
  ]);
  console.log(`✓ Created ${users.length} users`);

  // ============================================
  // USER-ZONE ASSIGNMENTS
  // ============================================
  console.log('Assigning users to zones...');
  await Promise.all([
    prisma.userZone.create({ data: { userId: 'vol-1', zoneId: zoneMap['Durham 1'].id, isPrimary: true } }),
    prisma.userZone.create({ data: { userId: 'vol-1', zoneId: zoneMap['Durham 2'].id } }),
    prisma.userZone.create({ data: { userId: 'vol-2', zoneId: zoneMap['Durham 2'].id, isPrimary: true } }),
    prisma.userZone.create({ data: { userId: 'vol-3', zoneId: zoneMap['Orange 1'].id, isPrimary: true } }),
    prisma.userZone.create({ data: { userId: 'vol-3', zoneId: zoneMap['Orange 2'].id } }),
    prisma.userZone.create({ data: { userId: 'vol-4', zoneId: zoneMap['Wake 1'].id, isPrimary: true } }),
    prisma.userZone.create({ data: { userId: 'vol-4', zoneId: zoneMap['Wake 3'].id } }),
    prisma.userZone.create({ data: { userId: 'vol-5', zoneId: zoneMap['Wake 3'].id, isPrimary: true } }),
    prisma.userZone.create({ data: { userId: 'coord-1', zoneId: zoneMap['Durham 1'].id, isPrimary: true } }),
    prisma.userZone.create({ data: { userId: 'coord-1', zoneId: zoneMap['Durham 2'].id } }),
    prisma.userZone.create({ data: { userId: 'coord-1', zoneId: zoneMap['Durham 3'].id } }),
  ]);
  console.log('✓ Assigned users to zones');

  // ============================================
  // USER TRAINING COMPLETIONS
  // ============================================
  console.log('Recording training completions...');
  const completedAt = new Date('2025-11-15');
  await Promise.all([
    ...['vol-1', 'vol-2', 'vol-3', 'vol-4', 'vol-5'].flatMap(userId => [
      prisma.userTraining.create({
        data: { userId, trainingId: trainingMap['Volunteer Orientation'].id, status: TrainingStatus.COMPLETED, completedAt },
      }),
      prisma.userTraining.create({
        data: { userId, trainingId: trainingMap['Safety & De-escalation'].id, status: TrainingStatus.COMPLETED, completedAt },
      }),
      prisma.userTraining.create({
        data: { userId, trainingId: trainingMap['Documentation & Reporting'].id, status: TrainingStatus.COMPLETED, completedAt },
      }),
      prisma.userTraining.create({
        data: { userId, trainingId: trainingMap['Know Your Rights'].id, status: TrainingStatus.COMPLETED, completedAt },
      }),
    ]),
    prisma.userTraining.create({ data: { userId: 'coord-1', trainingId: trainingMap['Volunteer Orientation'].id, status: TrainingStatus.COMPLETED, completedAt } }),
    prisma.userTraining.create({ data: { userId: 'coord-1', trainingId: trainingMap['Documentation & Reporting'].id, status: TrainingStatus.COMPLETED, completedAt } }),
    prisma.userTraining.create({ data: { userId: 'coord-1', trainingId: trainingMap['Coordinator Training'].id, status: TrainingStatus.COMPLETED, completedAt } }),
    prisma.userTraining.create({ data: { userId: 'disp-1', trainingId: trainingMap['Volunteer Orientation'].id, status: TrainingStatus.COMPLETED, completedAt } }),
    prisma.userTraining.create({ data: { userId: 'disp-1', trainingId: trainingMap['Documentation & Reporting'].id, status: TrainingStatus.COMPLETED, completedAt } }),
    prisma.userTraining.create({ data: { userId: 'disp-1', trainingId: trainingMap['Dispatcher Training'].id, status: TrainingStatus.COMPLETED, completedAt } }),
  ]);
  console.log('✓ Recorded training completions');

  // ============================================
  // SAMPLE SHIFTS (current week Dec 1-7, 2025 + next week)
  // ============================================
  console.log('Creating sample shifts...');

  // Helper to create a specific date at a specific hour (EST)
  const makeSpecificDate = (year: number, month: number, day: number, hour: number) => {
    const d = new Date(year, month - 1, day, hour, 0, 0, 0);
    return d;
  };

  // Helper for relative dates (for future-proof shifts)
  const makeDate = (daysFromNow: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // Current week: Dec 1-7, 2025 (Mon-Sun)
  const currentWeekShifts = [
    // Monday Dec 1 - Durham
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 1], start: 11, end: 15, desc: 'Hillside HS area - midday patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 2', date: [2025, 12, 1], start: 11, end: 15, desc: 'Jordan HS area patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 3', date: [2025, 12, 1], start: 11, end: 15, desc: 'Northern HS area patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 4', date: [2025, 12, 1], start: 11, end: 15, desc: 'Riverside HS area patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 5', date: [2025, 12, 1], start: 11, end: 15, desc: 'Southern HS area patrol' },
    { type: ShiftType.COLLECTION, title: 'Intel Collection', zone: 'Durham 1', date: [2025, 12, 1], start: 13, end: 17, desc: 'Durham County intel monitoring' },
    // Monday Dec 1 - Wake
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Wake 1', date: [2025, 12, 1], start: 11, end: 15, desc: 'West Raleigh patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 2', date: [2025, 12, 1], start: 13, end: 17, desc: 'East Raleigh patrol' },
    // Monday Dec 1 - Orange
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Orange 1', date: [2025, 12, 1], start: 11, end: 15, desc: 'Chapel Hill patrol' },

    // Tuesday Dec 2 - Durham
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 2], start: 11, end: 15, desc: 'Hillside HS area patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 2', date: [2025, 12, 2], start: 11, end: 15, desc: 'Jordan HS area patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 3', date: [2025, 12, 2], start: 11, end: 15, desc: 'Northern HS area patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 4', date: [2025, 12, 2], start: 11, end: 15, desc: 'Riverside HS area patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 5', date: [2025, 12, 2], start: 11, end: 15, desc: 'Southern HS area patrol' },
    { type: ShiftType.ON_CALL_FIELD_SUPPORT, title: 'On-Call Support', zone: 'Durham 1', date: [2025, 12, 2], start: 13, end: 17, desc: 'Durham rapid response' },
    // Tuesday Dec 2 - Wake
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Wake 1', date: [2025, 12, 2], start: 11, end: 15, desc: 'West Raleigh patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 3', date: [2025, 12, 2], start: 13, end: 17, desc: 'Garner area patrol' },

    // Wednesday Dec 3 - Durham
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 3], start: 11, end: 15, desc: 'Hillside HS area patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 2', date: [2025, 12, 3], start: 11, end: 15, desc: 'Jordan HS area patrol' },
    { type: ShiftType.COLLECTION, title: 'Intel Collection', zone: 'Durham 1', date: [2025, 12, 3], start: 13, end: 17, desc: 'Midweek intel monitoring' },
    // Wednesday Dec 3 - Wake
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 4', date: [2025, 12, 3], start: 13, end: 17, desc: 'North Wake patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 5', date: [2025, 12, 3], start: 13, end: 17, desc: 'Cary area patrol' },
    // Wednesday Dec 3 - Orange
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Orange 1', date: [2025, 12, 3], start: 11, end: 15, desc: 'Chapel Hill patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Orange 2', date: [2025, 12, 3], start: 13, end: 17, desc: 'Hillsborough patrol' },

    // Thursday Dec 4 - Durham
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 4], start: 11, end: 15, desc: 'Hillside HS area patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 3', date: [2025, 12, 4], start: 11, end: 15, desc: 'Northern HS area patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 5', date: [2025, 12, 4], start: 13, end: 17, desc: 'Southern HS area patrol' },
    // Thursday Dec 4 - Wake
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Wake 2', date: [2025, 12, 4], start: 11, end: 15, desc: 'East Raleigh patrol' },
    { type: ShiftType.ON_CALL_FIELD_SUPPORT, title: 'On-Call Support', zone: 'Wake 1', date: [2025, 12, 4], start: 13, end: 17, desc: 'Wake rapid response' },

    // Friday Dec 5 - Durham
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 5], start: 11, end: 15, desc: 'Hillside HS area patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 2', date: [2025, 12, 5], start: 11, end: 15, desc: 'Jordan HS area patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 4', date: [2025, 12, 5], start: 13, end: 17, desc: 'Riverside HS area patrol' },
    { type: ShiftType.ON_CALL_FIELD_SUPPORT, title: 'On-Call Support', zone: 'Durham 1', date: [2025, 12, 5], start: 13, end: 21, desc: 'Extended Friday on-call' },
    // Friday Dec 5 - Wake
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 6', date: [2025, 12, 5], start: 13, end: 17, desc: 'South Wake patrol' },
    // Friday Dec 5 - Orange
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Orange 1', date: [2025, 12, 5], start: 11, end: 15, desc: 'Chapel Hill patrol' },

    // Saturday Dec 6 - Durham (heavier coverage)
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 6], start: 11, end: 15, desc: 'Weekend Hillside patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 2', date: [2025, 12, 6], start: 11, end: 15, desc: 'Weekend Jordan patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 3', date: [2025, 12, 6], start: 11, end: 15, desc: 'Weekend Northern patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 1', date: [2025, 12, 6], start: 13, end: 17, desc: 'Weekend afternoon patrol' },
    { type: ShiftType.PATROL, title: 'Evening Patrol', zone: 'Durham 1', date: [2025, 12, 6], start: 13, end: 21, desc: 'Weekend extended patrol' },
    { type: ShiftType.ON_CALL_FIELD_SUPPORT, title: 'Weekend On-Call', zone: 'Durham 1', date: [2025, 12, 6], start: 11, end: 21, desc: 'Full day weekend on-call' },
    // Saturday Dec 6 - Wake
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Wake 1', date: [2025, 12, 6], start: 11, end: 15, desc: 'Weekend Raleigh patrol' },
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Wake 5', date: [2025, 12, 6], start: 11, end: 15, desc: 'Weekend Cary patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 3', date: [2025, 12, 6], start: 13, end: 17, desc: 'Weekend Garner patrol' },
    // Saturday Dec 6 - Orange
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Orange 1', date: [2025, 12, 6], start: 11, end: 15, desc: 'Weekend Chapel Hill patrol' },

    // Sunday Dec 7 - Durham
    { type: ShiftType.PATROL, title: 'Morning Patrol', zone: 'Durham 1', date: [2025, 12, 7], start: 11, end: 15, desc: 'Sunday Hillside patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Durham 2', date: [2025, 12, 7], start: 13, end: 17, desc: 'Sunday Jordan patrol' },
    { type: ShiftType.COLLECTION, title: 'Weekend Intel', zone: 'Durham 1', date: [2025, 12, 7], start: 13, end: 17, desc: 'Weekend intel wrap-up' },
    // Sunday Dec 7 - Wake
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 2', date: [2025, 12, 7], start: 13, end: 17, desc: 'Sunday East Raleigh patrol' },
    { type: ShiftType.PATROL, title: 'Afternoon Patrol', zone: 'Wake 4', date: [2025, 12, 7], start: 13, end: 17, desc: 'Sunday North Wake patrol' },
  ];

  // Convert current week shifts to standard format
  const shiftsData = currentWeekShifts.map(s => ({
    type: s.type,
    title: s.title,
    zone: s.zone,
    date: s.date as [number, number, number],
    start: s.start,
    end: s.end,
    desc: s.desc,
  }));

  const createdShifts = await Promise.all(
    shiftsData.map(s => {
      const [year, month, day] = s.date;
      const startDate = makeSpecificDate(year, month, day, s.start);
      const endDate = makeSpecificDate(year, month, day, s.end);
      // Map enum to slug for typeConfigId lookup
      const typeSlug = s.type as string;  // PATROL, COLLECTION, ON_CALL_FIELD_SUPPORT
      return prisma.shift.create({
        data: {
          type: s.type,
          typeConfigId: shiftTypeMap[typeSlug]?.id,  // Link to dynamic config
          title: s.title,
          description: s.desc,
          date: startDate,
          startTime: startDate,
          endTime: endDate,
          zoneId: zoneMap[s.zone].id,
          minVolunteers: s.type === ShiftType.COLLECTION ? 1 : 2,
          idealVolunteers: s.type === ShiftType.COLLECTION ? 2 : 4,
          maxVolunteers: s.type === ShiftType.COLLECTION ? 3 : 6,
          status: 'PUBLISHED',
          createdById: 'coord-1',
        },
      });
    })
  );
  console.log(`✓ Created ${createdShifts.length} sample shifts for week of Dec 1-7, 2025`);

  // ============================================
  // SAMPLE TRAINING SESSIONS (next 14 days)
  // ============================================
  console.log('Creating sample training sessions...');

  const trainingTypeMap = Object.fromEntries(trainingTypes.map(tt => [tt.slug, tt]));

  const trainingSessionsData = [
    // Verifier trainings
    { typeSlug: 'VERIFIER', title: 'Verifier Training - December Session', day: 3, start: 10, duration: 90, location: 'Durham Community Center', zone: 'Durham 1' },
    { typeSlug: 'VERIFIER', title: 'Verifier Training - Chapel Hill', day: 7, start: 14, duration: 90, location: 'Chapel Hill Library', zone: 'Orange 1' },
    { typeSlug: 'VERIFIER', title: 'Verifier Training - Raleigh', day: 10, start: 18, duration: 90, meetingLink: 'https://zoom.us/j/example1', zone: null },

    // Zone Lead trainings
    { typeSlug: 'ZONE_LEAD', title: 'Zone Lead Training - December', day: 5, start: 9, duration: 120, location: 'Siembra NC Office', zone: null },
    { typeSlug: 'ZONE_LEAD', title: 'Zone Lead Training - Wake County', day: 12, start: 10, duration: 120, location: 'Raleigh Community Center', zone: 'Wake 1' },

    // Dispatcher trainings
    { typeSlug: 'DISPATCHER', title: 'Dispatcher Training - December Cohort', day: 8, start: 9, duration: 150, meetingLink: 'https://zoom.us/j/example2', zone: null },
    { typeSlug: 'DISPATCHER', title: 'Dispatcher Training - January Prep', day: 14, start: 13, duration: 150, location: 'Durham Training Center', zone: 'Durham 1' },
  ];

  const createdTrainingSessions = await Promise.all(
    trainingSessionsData.map(ts => {
      const startDate = makeDate(ts.day, ts.start);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + ts.duration);

      return prisma.trainingSession.create({
        data: {
          trainingTypeId: trainingTypeMap[ts.typeSlug].id,
          title: ts.title,
          date: startDate,
          startTime: startDate,
          endTime: endDate,
          location: ts.location || null,
          meetingLink: ts.meetingLink || null,
          zoneId: ts.zone ? zoneMap[ts.zone].id : null,
          minAttendees: 1,
          maxAttendees: trainingTypeMap[ts.typeSlug].defaultCapacity,
          status: 'PUBLISHED',
          createdById: 'coord-1',
        },
      });
    })
  );
  console.log(`✓ Created ${createdTrainingSessions.length} sample training sessions`);

  console.log('\n✅ Seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - 1 organization settings`);
  console.log(`  - ${shiftTypeConfigs.length} shift type configurations`);
  console.log(`  - ${trainingTypes.length} training types`);
  console.log(`  - ${zones.length} zones`);
  console.log(`  - ${trainings.length} training modules`);
  console.log(`  - ${users.length} users`);
  console.log(`  - ${createdShifts.length} sample shifts (next 7 days)`);
  console.log(`  - ${createdTrainingSessions.length} sample training sessions (next 14 days)`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
