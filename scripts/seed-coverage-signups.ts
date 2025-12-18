/**
 * Seed Coverage Signups
 *
 * Populates the coverage grid with sample signups for demo purposes.
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-coverage-signups.ts
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';
import { AccountStatus, Role } from '../src/generated/prisma/enums';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// Sample volunteer names for realistic data
const sampleNames = [
  'Maria Santos', 'Bob Kim', 'Jane Doe', 'Tom Rodriguez', 'Sarah Chen',
  'Mike Johnson', 'Lisa Park', 'David Lee', 'Emily Brown', 'Chris Wilson',
  'Amanda Garcia', 'James Taylor', 'Rachel Martinez', 'Kevin Anderson', 'Nicole Thomas'
];

async function main() {
  console.log('Seeding coverage signups for this week...\n');

  // Get current week's Monday
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  console.log(`Week starting: ${weekStart.toISOString().split('T')[0]}\n`);

  // Get all active zones
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${zones.length} zones\n`);

  // Get users to assign (or create test users if needed)
  let users = await prisma.user.findMany({
    where: {
      accountStatus: AccountStatus.ACTIVE,
      role: { in: [Role.VOLUNTEER, Role.COORDINATOR, Role.DISPATCHER] }
    },
    take: 15,
  });

  if (users.length < 5) {
    console.log('Not enough users found. Creating test users...');
    // Create test users for demo
    for (let i = 0; i < 15; i++) {
      const name = sampleNames[i];
      const email = `test.volunteer${i + 1}@example.com`;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email,
            name,
            passwordHash: 'demo-hash-not-for-login',
            role: Role.VOLUNTEER,
            accountStatus: AccountStatus.ACTIVE,
          },
        });
      }
    }
    users = await prisma.user.findMany({
      where: { accountStatus: AccountStatus.ACTIVE },
      take: 15,
    });
  }

  console.log(`Using ${users.length} users for signups\n`);

  // Clear existing signups for this week (to avoid duplicates)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  await prisma.coverageSignup.deleteMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });
  console.log('Cleared existing signups for this week\n');

  // Time slots
  const timeSlots = [
    { start: 6, end: 8 },
    { start: 8, end: 10 },
    { start: 10, end: 12 },
    { start: 12, end: 14 },
  ];

  let signupsCreated = 0;

  // Create signups for Mon-Sat (not Sunday)
  for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOffset];

    console.log(`\n${dayName} ${dateStr}:`);

    for (const slot of timeSlots) {
      // Determine how many zones to fill for this slot (vary coverage)
      // More coverage on weekdays, less on Saturday
      const coveragePercent = dayOffset < 5 ? 0.6 + Math.random() * 0.3 : 0.3 + Math.random() * 0.3;
      const zonesToFill = Math.floor(zones.length * coveragePercent);

      // Shuffle zones and pick some
      const shuffledZones = [...zones].sort(() => Math.random() - 0.5);
      const selectedZones = shuffledZones.slice(0, zonesToFill);

      for (const zone of selectedZones) {
        // Randomly decide what roles to fill
        const fillDispatcher = Math.random() > 0.3;
        const fillZoneLead = Math.random() > 0.2;
        const numVerifiers = Math.floor(Math.random() * 3); // 0-2 verifiers

        const usedUserIds = new Set<string>();

        // Add dispatcher
        if (fillDispatcher) {
          const user = users.find(u => !usedUserIds.has(u.id));
          if (user) {
            usedUserIds.add(user.id);
            await prisma.coverageSignup.create({
              data: {
                date,
                zoneId: zone.id,
                startHour: slot.start,
                endHour: slot.end,
                userId: user.id,
                roleType: 'DISPATCHER',
                status: 'CONFIRMED',
                confirmedAt: new Date(),
              },
            });
            signupsCreated++;
          }
        }

        // Add zone lead
        if (fillZoneLead) {
          const user = users.find(u => !usedUserIds.has(u.id));
          if (user) {
            usedUserIds.add(user.id);
            await prisma.coverageSignup.create({
              data: {
                date,
                zoneId: zone.id,
                startHour: slot.start,
                endHour: slot.end,
                userId: user.id,
                roleType: 'ZONE_LEAD',
                status: 'CONFIRMED',
                confirmedAt: new Date(),
              },
            });
            signupsCreated++;
          }
        }

        // Add verifiers
        for (let v = 0; v < numVerifiers; v++) {
          const user = users.find(u => !usedUserIds.has(u.id));
          if (user) {
            usedUserIds.add(user.id);
            await prisma.coverageSignup.create({
              data: {
                date,
                zoneId: zone.id,
                startHour: slot.start,
                endHour: slot.end,
                userId: user.id,
                roleType: 'VERIFIER',
                status: 'CONFIRMED',
                confirmedAt: new Date(),
              },
            });
            signupsCreated++;
          }
        }
      }

      const slotLabel = `${slot.start}:00-${slot.end}:00`;
      console.log(`  ${slotLabel}: ${selectedZones.length}/${zones.length} zones with coverage`);
    }
  }

  console.log(`\n\nDone! Created ${signupsCreated} signups.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
