/**
 * Fix Coverage Colors
 * Ensures proper variety of cell colors in schedule:
 * - Green: Dispatcher + all zones have leads
 * - Yellow: Some coverage but missing dispatcher or some leads
 * - Gray: No shifts/coverage
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/fix-coverage-colors.ts
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

const TIME_SLOTS = [
  { label: '6am-10am', startHour: 6, endHour: 10 },
  { label: '10am-2pm', startHour: 10, endHour: 14 },
  { label: '2pm-6pm', startHour: 14, endHour: 18 },
];

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDates(start: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

async function main() {
  console.log('🎨 Fixing Coverage Colors\n');

  const weekStart = getWeekStart();
  const weekDates = getWeekDates(weekStart);

  // Get zones grouped by county
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const counties = [...new Set(zones.map(z => z.county).filter(Boolean))] as string[];
  console.log(`Counties: ${counties.join(', ')}`);

  // Get qualified dispatchers and zone leads
  const qualifiedDispatchers = await prisma.user.findMany({
    where: {
      isActive: true,
      userQualifications: { some: { qualifiedRole: { slug: 'DISPATCHER' } } },
    },
  });

  const qualifiedZoneLeads = await prisma.user.findMany({
    where: {
      isActive: true,
      userQualifications: { some: { qualifiedRole: { slug: 'ZONE_LEAD' } } },
    },
  });

  console.log(`${qualifiedDispatchers.length} qualified dispatchers`);
  console.log(`${qualifiedZoneLeads.length} qualified zone leads\n`);

  // Get admin for creating assignments
  const admin = await prisma.user.findFirst({ where: { role: 'ADMINISTRATOR' } });
  if (!admin) throw new Error('No admin found');

  let greenCells = 0;
  let yellowCells = 0;
  let grayCells = 0;

  for (const date of weekDates) {
    for (const county of counties) {
      const countyZones = zones.filter(z => z.county === county);

      for (const slot of TIME_SLOTS) {
        const random = Math.random();
        const dateOnly = new Date(date);
        dateOnly.setUTCHours(0, 0, 0, 0);

        const startTime = new Date(date);
        startTime.setUTCHours(slot.startHour + 5, 0, 0, 0);

        const endTime = new Date(date);
        endTime.setUTCHours(slot.endHour + 5, 0, 0, 0);

        // Get shifts for this county/time block
        const shifts = await prisma.shift.findMany({
          where: {
            zone: { county },
            date: dateOnly,
            startTime,
            endTime,
          },
          include: { volunteers: true, zone: true },
        });

        if (shifts.length === 0) continue;

        if (random < 0.33) {
          // GREEN: Ensure dispatcher AND all zones have leads
          console.log(`✅ GREEN: ${county} ${date.toDateString()} ${slot.label}`);

          // Ensure dispatcher exists
          let dispatcher = await prisma.dispatcherAssignment.findFirst({
            where: { county, date: dateOnly, startTime, endTime },
          });

          if (!dispatcher && qualifiedDispatchers.length > 0) {
            const user = qualifiedDispatchers[Math.floor(Math.random() * qualifiedDispatchers.length)];
            await prisma.dispatcherAssignment.create({
              data: {
                userId: user.id,
                county,
                date: dateOnly,
                startTime,
                endTime,
                createdById: admin.id,
              },
            });
          }

          // Ensure ALL zones have zone leads
          for (const shift of shifts) {
            const hasLead = shift.volunteers.some(v => v.isZoneLead);
            if (!hasLead) {
              // Add a volunteer and make them zone lead
              if (shift.volunteers.length > 0) {
                await prisma.shiftVolunteer.update({
                  where: { id: shift.volunteers[0].id },
                  data: { isZoneLead: true },
                });
              } else if (qualifiedZoneLeads.length > 0) {
                const user = qualifiedZoneLeads[Math.floor(Math.random() * qualifiedZoneLeads.length)];
                await prisma.shiftVolunteer.create({
                  data: {
                    shiftId: shift.id,
                    userId: user.id,
                    status: 'CONFIRMED',
                    isZoneLead: true,
                    confirmedAt: new Date(),
                  },
                });
              }
            }
          }
          greenCells++;

        } else if (random < 0.66) {
          // YELLOW: Has shifts but missing dispatcher OR some leads
          console.log(`🟡 YELLOW: ${county} ${date.toDateString()} ${slot.label}`);

          // Remove dispatcher if exists
          await prisma.dispatcherAssignment.deleteMany({
            where: { county, date: dateOnly, startTime, endTime },
          });

          // Keep some volunteers but remove some zone leads
          for (const shift of shifts) {
            if (Math.random() > 0.5) {
              await prisma.shiftVolunteer.updateMany({
                where: { shiftId: shift.id },
                data: { isZoneLead: false },
              });
            }
          }
          yellowCells++;

        } else {
          // GRAY: Remove all coverage
          console.log(`⬜ GRAY: ${county} ${date.toDateString()} ${slot.label}`);

          // Remove dispatcher
          await prisma.dispatcherAssignment.deleteMany({
            where: { county, date: dateOnly, startTime, endTime },
          });

          // Remove all volunteers from shifts
          for (const shift of shifts) {
            await prisma.shiftVolunteer.deleteMany({
              where: { shiftId: shift.id },
            });
          }
          grayCells++;
        }
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Green (full): ${greenCells}`);
  console.log(`   Yellow (partial): ${yellowCells}`);
  console.log(`   Gray (none): ${grayCells}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
