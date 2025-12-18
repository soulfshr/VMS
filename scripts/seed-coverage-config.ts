/**
 * Seed Coverage Config
 *
 * Seeds default time slots for all active zones.
 * Default slots: 6-8am, 8-10am, 10-12pm, 12-2pm (Monday-Saturday)
 * Sunday is off by default.
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-coverage-config.ts
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// Default slot configuration (same for all zones)
const defaultSlots = [
  { start: 6, end: 8, minVols: 2, needsLead: true, needsDispatcher: true },
  { start: 8, end: 10, minVols: 3, needsLead: true, needsDispatcher: true },
  { start: 10, end: 12, minVols: 3, needsLead: true, needsDispatcher: true },
  { start: 12, end: 14, minVols: 2, needsLead: true, needsDispatcher: true },
];

// Days of week (0=Sunday, 1=Monday, etc.)
// Sunday (0) is not included by default
const activeDays = [1, 2, 3, 4, 5, 6]; // Monday through Saturday

async function main() {
  console.log('Seeding coverage configurations...\n');

  // Get all active zones
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${zones.length} active zones:\n`);
  zones.forEach(z => console.log(`  - ${z.name} (${z.county || 'no county'})`));
  console.log('');

  let created = 0;
  let skipped = 0;

  for (const zone of zones) {
    for (const dayOfWeek of activeDays) {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];

      // Check if config already exists
      const existing = await prisma.coverageConfig.findUnique({
        where: {
          zoneId_dayOfWeek: {
            zoneId: zone.id,
            dayOfWeek,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the config
      await prisma.coverageConfig.create({
        data: {
          zoneId: zone.id,
          dayOfWeek,
          slots: defaultSlots,
          isActive: true,
        },
      });

      console.log(`  Created: ${zone.name} - ${dayName}`);
      created++;
    }
  }

  console.log(`\nDone! Created ${created} configs, skipped ${skipped} existing.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
