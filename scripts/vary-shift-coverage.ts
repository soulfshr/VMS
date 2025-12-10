/**
 * Vary Shift Coverage
 * Adjusts shifts to create visual variety in schedule coverage:
 * - Some shifts with full coverage (green)
 * - Some with partial coverage (yellow)
 * - Some with no coverage (red)
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/vary-shift-coverage.ts
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

// Get current week's Monday
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function main() {
  console.log('🎨 Varying Shift Coverage\n');

  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Get all shifts for this week with their volunteers
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      volunteers: true,
      zone: true,
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  console.log(`Found ${shifts.length} shifts this week\n`);

  let cleared = 0;
  let partial = 0;
  let full = 0;

  for (const shift of shifts) {
    const random = Math.random();
    const volunteerCount = shift.volunteers.length;

    if (random < 0.25) {
      // 25% - Clear all volunteers (RED - no coverage)
      if (volunteerCount > 0) {
        await prisma.shiftVolunteer.deleteMany({
          where: { shiftId: shift.id },
        });
        console.log(`❌ ${shift.zone?.name} ${shift.startTime.toISOString().slice(11, 16)} - Cleared (was ${volunteerCount})`);
        cleared++;
      }
    } else if (random < 0.50) {
      // 25% - Keep 1 volunteer, remove zone lead (YELLOW - partial)
      if (volunteerCount > 1) {
        // Keep first volunteer, remove rest
        const toRemove = shift.volunteers.slice(1);
        await prisma.shiftVolunteer.deleteMany({
          where: { id: { in: toRemove.map(v => v.id) } },
        });
        // Remove zone lead status from remaining
        await prisma.shiftVolunteer.updateMany({
          where: { shiftId: shift.id },
          data: { isZoneLead: false },
        });
        console.log(`🟡 ${shift.zone?.name} ${shift.startTime.toISOString().slice(11, 16)} - Partial (1 vol, no lead)`);
        partial++;
      } else if (volunteerCount === 1) {
        // Just remove zone lead
        await prisma.shiftVolunteer.updateMany({
          where: { shiftId: shift.id },
          data: { isZoneLead: false },
        });
        partial++;
      }
    } else {
      // 50% - Ensure has zone lead and 2+ volunteers (GREEN - full)
      if (volunteerCount >= 2) {
        // Make sure at least one is zone lead
        const hasZoneLead = shift.volunteers.some(v => v.isZoneLead);
        if (!hasZoneLead) {
          await prisma.shiftVolunteer.update({
            where: { id: shift.volunteers[0].id },
            data: { isZoneLead: true },
          });
        }
        console.log(`✅ ${shift.zone?.name} ${shift.startTime.toISOString().slice(11, 16)} - Full (${volunteerCount} vols + lead)`);
        full++;
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Red (no coverage): ${cleared}`);
  console.log(`   Yellow (partial): ${partial}`);
  console.log(`   Green (full): ${full}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
