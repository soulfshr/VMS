#!/usr/bin/env tsx
/**
 * Shift Seed Script
 * Creates shifts for the week of December 8-14, 2024 (Monday-Sunday)
 *
 * Schedule per county (screenshot):
 * - Wake (zones 1-6): 6am-10am, 10am-2pm, 2pm-6pm
 * - Durham (zones 1-5): 6am-10am, 10am-2pm, 2pm-6pm
 * - Orange (zones 1-2): 6am-10am, 10am-2pm, 2pm-6pm
 *
 * Usage:
 *   DATABASE_URL="your-prod-connection-string" npx tsx scripts/seed-shifts.ts
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ShiftType, ShiftStatus } from '../src/generated/prisma/client';

// Load environment variables
dotenv.config();

interface ShiftSlot {
  startHour: number;
  endHour: number;
  label: string;
}

// Shift times for all counties
const SHIFT_SLOTS: ShiftSlot[] = [
  { startHour: 6, endHour: 10, label: '6am-10am' },
  { startHour: 10, endHour: 14, label: '10am-2pm' },
  { startHour: 14, endHour: 18, label: '2pm-6pm' },
];

// Days of the week starting Monday Dec 8, 2024
const WEEK_START = new Date('2024-12-08T00:00:00');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

  // Create pool with standard pg driver
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Fetching zones...');

  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: [{ county: 'asc' }, { name: 'asc' }],
  });

  console.log(`Found ${zones.length} zones:`);
  zones.forEach(z => console.log(`  - ${z.name} (${z.county})`));

  // Get the Patrol shift type config if it exists
  const patrolConfig = await prisma.shiftTypeConfig.findFirst({
    where: { slug: 'PATROL' },
  });

  // Get an admin user to be the creator
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMINISTRATOR' },
  });

  if (!adminUser) {
    console.error('No administrator user found! Cannot create shifts.');
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  }

  console.log(`\nUsing admin user: ${adminUser.name} (${adminUser.email})`);
  console.log(`Patrol config ID: ${patrolConfig?.id || 'none'}`);

  let created = 0;
  let skipped = 0;

  // For each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(WEEK_START);
    date.setDate(date.getDate() + dayOffset);
    const dayName = DAYS[dayOffset];

    console.log(`\n--- ${dayName}, ${date.toLocaleDateString()} ---`);

    // For each zone
    for (const zone of zones) {
      // For each shift slot
      for (const slot of SHIFT_SLOTS) {
        // Create start and end times for this shift
        const startTime = new Date(date);
        startTime.setHours(slot.startHour, 0, 0, 0);

        const endTime = new Date(date);
        endTime.setHours(slot.endHour, 0, 0, 0);

        const title = `${zone.name} Patrol - ${slot.label}`;

        // Check if shift already exists
        const existing = await prisma.shift.findFirst({
          where: {
            zoneId: zone.id,
            date: date,
            startTime: startTime,
            endTime: endTime,
          },
        });

        if (existing) {
          console.log(`  [SKIP] ${title} (already exists)`);
          skipped++;
          continue;
        }

        // Create the shift
        await prisma.shift.create({
          data: {
            type: ShiftType.PATROL,
            typeConfigId: patrolConfig?.id,
            title,
            description: `Patrol shift for ${zone.name}`,
            date,
            startTime,
            endTime,
            zoneId: zone.id,
            minVolunteers: 2,
            idealVolunteers: 4,
            maxVolunteers: 6,
            status: ShiftStatus.PUBLISHED,
            createdById: adminUser.id,
          },
        });

        console.log(`  [CREATE] ${title}`);
        created++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created: ${created} shifts`);
  console.log(`Skipped: ${skipped} (already existed)`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
