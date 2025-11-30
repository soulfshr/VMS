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
  await prisma.shift.deleteMany();
  await prisma.userTraining.deleteMany();
  await prisma.training.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.userZone.deleteMany();
  await prisma.user.deleteMany();
  await prisma.zone.deleteMany();

  // ============================================
  // ZONES (13 zones across 3 counties)
  // ============================================
  console.log('Creating zones...');
  const zones = await Promise.all([
    // Durham County (5 zones)
    prisma.zone.create({ data: { name: 'Durham 1', county: 'Durham', description: 'Downtown Durham and Duke University area' } }),
    prisma.zone.create({ data: { name: 'Durham 2', county: 'Durham', description: 'North Durham and Northgate area' } }),
    prisma.zone.create({ data: { name: 'Durham 3', county: 'Durham', description: 'East Durham and Research Triangle Park' } }),
    prisma.zone.create({ data: { name: 'Durham 4', county: 'Durham', description: 'South Durham and Southpoint area' } }),
    prisma.zone.create({ data: { name: 'Durham 5', county: 'Durham', description: 'West Durham and Hope Valley area' } }),
    // Orange County (2 zones)
    prisma.zone.create({ data: { name: 'Orange 1', county: 'Orange', description: 'Chapel Hill and UNC area' } }),
    prisma.zone.create({ data: { name: 'Orange 2', county: 'Orange', description: 'Hillsborough and northern Orange County' } }),
    // Wake County (6 zones)
    prisma.zone.create({ data: { name: 'Wake 1', county: 'Wake', description: 'Downtown Raleigh' } }),
    prisma.zone.create({ data: { name: 'Wake 2', county: 'Wake', description: 'North Raleigh' } }),
    prisma.zone.create({ data: { name: 'Wake 3', county: 'Wake', description: 'Cary and Morrisville' } }),
    prisma.zone.create({ data: { name: 'Wake 4', county: 'Wake', description: 'Apex and Holly Springs' } }),
    prisma.zone.create({ data: { name: 'Wake 5', county: 'Wake', description: 'Garner and Southeast Raleigh' } }),
    prisma.zone.create({ data: { name: 'Wake 6', county: 'Wake', description: 'Wake Forest and Northeast Wake' } }),
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
  // SAMPLE SHIFTS
  // ============================================
  console.log('Creating sample shifts...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(13, 0, 0, 0);

  const weekend = new Date();
  weekend.setDate(weekend.getDate() + (6 - weekend.getDay() + 7) % 7 + 1);
  weekend.setHours(8, 0, 0, 0);

  await Promise.all([
    prisma.shift.create({
      data: {
        type: ShiftType.PATROL,
        title: 'Morning Patrol - Durham 1',
        description: 'Regular morning patrol of downtown Durham area',
        date: tomorrow,
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000),
        zoneId: zoneMap['Durham 1'].id,
        minVolunteers: 2,
        idealVolunteers: 4,
        maxVolunteers: 6,
        status: 'PUBLISHED',
        createdById: 'coord-1',
      },
    }),
    prisma.shift.create({
      data: {
        type: ShiftType.PATROL,
        title: 'Afternoon Patrol - Durham 2',
        description: 'Regular afternoon patrol of North Durham',
        date: dayAfter,
        startTime: dayAfter,
        endTime: new Date(dayAfter.getTime() + 4 * 60 * 60 * 1000),
        zoneId: zoneMap['Durham 2'].id,
        minVolunteers: 2,
        idealVolunteers: 3,
        maxVolunteers: 4,
        status: 'PUBLISHED',
        createdById: 'coord-1',
      },
    }),
    prisma.shift.create({
      data: {
        type: ShiftType.COLLECTION,
        title: 'Evening Intel Collection',
        description: 'Monitor social media channels and community networks for Triangle area',
        date: tomorrow,
        startTime: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000),
        endTime: new Date(tomorrow.getTime() + 13 * 60 * 60 * 1000),
        zoneId: zoneMap['Durham 1'].id,
        minVolunteers: 1,
        idealVolunteers: 2,
        maxVolunteers: 3,
        status: 'PUBLISHED',
        createdById: 'coord-1',
      },
    }),
    prisma.shift.create({
      data: {
        type: ShiftType.ON_CALL_FIELD_SUPPORT,
        title: 'Weekend On-Call - Wake County',
        description: 'On-call for rapid response in Wake County area',
        date: weekend,
        startTime: weekend,
        endTime: new Date(weekend.getTime() + 4 * 60 * 60 * 1000),
        zoneId: zoneMap['Wake 3'].id,
        minVolunteers: 2,
        idealVolunteers: 4,
        maxVolunteers: 6,
        status: 'PUBLISHED',
        createdById: 'coord-1',
      },
    }),
  ]);
  console.log('✓ Created sample shifts');

  console.log('\n✅ Seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - ${zones.length} zones`);
  console.log(`  - ${trainings.length} training modules`);
  console.log(`  - ${users.length} users`);
  console.log('  - 4 sample shifts');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
