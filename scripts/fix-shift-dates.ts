#!/usr/bin/env tsx
/**
 * Fix shift dates - update from 2024 to 2025
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Fixing shift dates (2024 -> 2025)...');

  // Get all shifts from December 2024
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: new Date('2024-12-01'),
        lt: new Date('2025-01-01'),
      },
    },
  });

  console.log(`Found ${shifts.length} shifts to update`);

  let updated = 0;
  for (const shift of shifts) {
    // Add 1 year to all date fields
    const newDate = new Date(shift.date);
    newDate.setFullYear(newDate.getFullYear() + 1);

    const newStartTime = new Date(shift.startTime);
    newStartTime.setFullYear(newStartTime.getFullYear() + 1);

    const newEndTime = new Date(shift.endTime);
    newEndTime.setFullYear(newEndTime.getFullYear() + 1);

    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
      },
    });

    updated++;
    if (updated % 50 === 0) {
      console.log(`Updated ${updated}/${shifts.length} shifts...`);
    }
  }

  console.log(`\nDone! Updated ${updated} shifts to 2025.`);

  // Verify
  const futureShifts = await prisma.shift.count({
    where: {
      date: { gte: new Date() },
      status: 'PUBLISHED',
    },
  });
  console.log(`Future published shifts: ${futureShifts}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
