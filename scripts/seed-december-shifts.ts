/**
 * Seed December shifts for all zones
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-december-shifts.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Time slots (in Eastern Time)
const timeSlots = [
  { name: 'Morning', start: 6, end: 10 },   // 6am-10am
  { name: 'Midday', start: 10, end: 14 },   // 10am-2pm
  { name: 'Afternoon', start: 14, end: 18 }, // 2pm-6pm
];

// Date range: December 8-22, 2024
const startDate = new Date('2024-12-08');
const endDate = new Date('2024-12-22');

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

async function main() {
  console.log('Fetching zones and shift type...\n');

  // Get all zones
  const zones = await prisma.zone.findMany({
    orderBy: { name: 'asc' }
  });
  console.log(`Found ${zones.length} zones:`, zones.map(z => z.name).join(', '));

  // Get default shift type config (Patrol or first available)
  let shiftTypeConfig = await prisma.shiftTypeConfig.findFirst({
    where: { name: 'Patrol' }
  });
  if (!shiftTypeConfig) {
    shiftTypeConfig = await prisma.shiftTypeConfig.findFirst();
  }
  if (!shiftTypeConfig) {
    throw new Error('No shift type config found. Please create one first.');
  }
  console.log(`Using shift type: ${shiftTypeConfig.name}`);

  // Get an admin/coordinator for createdById
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['ADMINISTRATOR', 'COORDINATOR'] } }
  });
  if (!adminUser) {
    throw new Error('No administrator or coordinator user found');
  }
  console.log(`Created by: ${adminUser.email}\n`);

  // Generate dates
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  console.log(`Creating shifts for ${dates.length} days (${formatDate(startDate)} - ${formatDate(endDate)})`);
  console.log(`${zones.length} zones × ${dates.length} days × ${timeSlots.length} time slots = ${zones.length * dates.length * timeSlots.length} shifts\n`);

  let created = 0;
  let skipped = 0;

  for (const zone of zones) {
    console.log(`\n📍 ${zone.name}:`);

    for (const date of dates) {
      for (const slot of timeSlots) {
        // Create date at midnight UTC, then set time
        const shiftDate = new Date(date);
        shiftDate.setUTCHours(0, 0, 0, 0);

        // Create start time (in Eastern Time - UTC-5)
        const startTime = new Date(date);
        startTime.setUTCHours(slot.start + 5, 0, 0, 0); // Add 5 hours to convert ET to UTC

        const endTime = new Date(date);
        endTime.setUTCHours(slot.end + 5, 0, 0, 0);

        const title = `${zone.name} ${slot.name}`;

        // Check if shift already exists
        const existing = await prisma.shift.findFirst({
          where: {
            zoneId: zone.id,
            date: shiftDate,
            startTime: startTime,
            endTime: endTime,
          }
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.shift.create({
          data: {
            title,
            description: `${formatTime(slot.start)}-${formatTime(slot.end)} patrol shift in ${zone.name}`,
            date: shiftDate,
            startTime: startTime,
            endTime: endTime,
            zoneId: zone.id,
            type: 'PATROL',
            typeConfigId: shiftTypeConfig.id,
            minVolunteers: 1,
            maxVolunteers: 4,
            status: 'PUBLISHED',
            createdById: adminUser.id,
          }
        });
        created++;
      }
    }
    console.log(`   ✓ ${dates.length * timeSlots.length} shifts`);
  }

  console.log(`\n✅ Done!`);
  console.log(`   Created: ${created} shifts`);
  console.log(`   Skipped (already exist): ${skipped} shifts`);

  // Show summary
  const totalShifts = await prisma.shift.count({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      }
    }
  });
  console.log(`\n   Total shifts in date range: ${totalShifts}`);
}

main()
  .catch((e) => {
    console.error('Error seeding shifts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
