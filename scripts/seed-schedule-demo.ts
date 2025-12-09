/**
 * Seed Schedule Demo Data
 * Creates shifts, RSVPs, zone leads, dispatchers, and regional leads
 * for the current week to populate the schedule view
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-schedule-demo.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RSVPStatus, ShiftStatus, ShiftType } from '../src/generated/prisma/client';
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
const TIME_SLOTS = [
  { label: '6am-10am', startHour: 6, endHour: 10 },
  { label: '10am-2pm', startHour: 10, endHour: 14 },
  { label: '2pm-6pm', startHour: 14, endHour: 18 },
];

// Get current week's Monday
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Get 7 days starting from a date
function getWeekDates(start: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function main() {
  console.log('🗓️  Schedule Demo Seeder\n');
  console.log('Connecting to:', DATABASE_URL!.replace(/:[^:@]+@/, ':***@'));

  const weekStart = getWeekStart();
  const weekDates = getWeekDates(weekStart);
  console.log(`\nSeeding week: ${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}\n`);

  // Fetch zones
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: [{ county: 'asc' }, { name: 'asc' }],
  });
  console.log(`Found ${zones.length} zones`);

  // Fetch all users
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    include: { userQualifications: { include: { qualifiedRole: true } } },
  });
  console.log(`Found ${allUsers.length} active users`);

  // Categorize users
  const admins = allUsers.filter(u => u.role === 'ADMINISTRATOR');
  const coordinators = allUsers.filter(u => u.role === 'COORDINATOR');
  const dispatchers = allUsers.filter(u => u.role === 'DISPATCHER');
  const volunteers = allUsers.filter(u => u.role === 'VOLUNTEER');

  // Users qualified as dispatchers (have DISPATCHER qualified role)
  const qualifiedDispatchers = allUsers.filter(u =>
    u.userQualifications.some(q => q.qualifiedRole?.slug === 'DISPATCHER')
  );

  // Users qualified as zone leads
  const qualifiedZoneLeads = allUsers.filter(u =>
    u.userQualifications.some(q => q.qualifiedRole?.slug === 'ZONE_LEAD')
  );

  console.log(`  - ${admins.length} admins`);
  console.log(`  - ${coordinators.length} coordinators`);
  console.log(`  - ${dispatchers.length} dispatchers`);
  console.log(`  - ${volunteers.length} volunteers`);
  console.log(`  - ${qualifiedDispatchers.length} users qualified as dispatchers`);
  console.log(`  - ${qualifiedZoneLeads.length} users qualified as zone leads`);

  const creator = admins[0] || coordinators[0];
  if (!creator) {
    throw new Error('No admin or coordinator found to create shifts');
  }
  console.log(`\nCreator: ${creator.name} (${creator.email})`);

  // Get shift type config
  const shiftTypeConfig = await prisma.shiftTypeConfig.findFirst({
    where: { slug: 'PATROL' },
  }) || await prisma.shiftTypeConfig.findFirst();

  if (!shiftTypeConfig) {
    throw new Error('No shift type config found');
  }
  console.log(`Shift type: ${shiftTypeConfig.name}`);

  // Counties from zones
  const counties = [...new Set(zones.map(z => z.county).filter(Boolean))] as string[];
  console.log(`Counties: ${counties.join(', ')}`);

  // Stats
  let shiftsCreated = 0;
  let shiftsSkipped = 0;
  let rsvpsCreated = 0;
  let zoneLeadsAssigned = 0;
  let dispatchersAssigned = 0;
  let regionalLeadsAssigned = 0;

  // 1. Create/find shifts for each zone, each day, each time slot
  console.log('\n📋 Creating shifts...');

  const shiftsByKey: Map<string, string> = new Map(); // key -> shiftId

  for (const date of weekDates) {
    for (const zone of zones) {
      for (const slot of TIME_SLOTS) {
        const shiftDate = new Date(date);
        shiftDate.setUTCHours(0, 0, 0, 0);

        const startTime = new Date(date);
        startTime.setUTCHours(slot.startHour + 5, 0, 0, 0); // ET to UTC

        const endTime = new Date(date);
        endTime.setUTCHours(slot.endHour + 5, 0, 0, 0);

        const title = `${zone.name} - ${slot.label}`;

        // Check existing
        let shift = await prisma.shift.findFirst({
          where: {
            zoneId: zone.id,
            date: shiftDate,
            startTime,
            endTime,
          },
        });

        if (!shift) {
          shift = await prisma.shift.create({
            data: {
              title,
              description: `Patrol shift for ${zone.name}`,
              date: shiftDate,
              startTime,
              endTime,
              zoneId: zone.id,
              type: ShiftType.PATROL,
              typeConfigId: shiftTypeConfig.id,
              minVolunteers: 1,
              maxVolunteers: 4,
              status: ShiftStatus.PUBLISHED,
              createdById: creator.id,
            },
          });
          shiftsCreated++;
        } else {
          shiftsSkipped++;
        }

        const key = `${zone.county}-${date.toISOString().split('T')[0]}-${slot.label}`;
        shiftsByKey.set(key, shift.id);
      }
    }
  }

  console.log(`  Created: ${shiftsCreated}, Skipped: ${shiftsSkipped}`);

  // 2. Add volunteer RSVPs to some shifts
  console.log('\n👥 Adding volunteer RSVPs...');

  const allVolunteers = [...volunteers, ...coordinators, ...dispatchers].filter(u => u.id !== creator.id);

  // Get all shifts for this week
  const weekShifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: weekDates[0],
        lte: weekDates[6],
      },
    },
    include: { volunteers: true },
  });

  // Add 1-3 volunteers to ~60% of shifts
  for (const shift of weekShifts) {
    if (Math.random() > 0.6) continue; // Skip 40% of shifts
    if (shift.volunteers.length >= 3) continue; // Already has volunteers

    const numToAdd = Math.min(Math.floor(Math.random() * 3) + 1, 3 - shift.volunteers.length);
    const available = allVolunteers.filter(v => !shift.volunteers.some(sv => sv.userId === v.id));

    for (let i = 0; i < Math.min(numToAdd, available.length); i++) {
      const volunteer = available[Math.floor(Math.random() * available.length)];
      available.splice(available.indexOf(volunteer), 1);

      // 70% confirmed, 30% pending
      const status = Math.random() > 0.3 ? RSVPStatus.CONFIRMED : RSVPStatus.PENDING;

      try {
        await prisma.shiftVolunteer.create({
          data: {
            shiftId: shift.id,
            userId: volunteer.id,
            status,
            confirmedAt: status === RSVPStatus.CONFIRMED ? new Date() : null,
          },
        });
        rsvpsCreated++;
      } catch {
        // Skip duplicates
      }
    }
  }

  console.log(`  Created: ${rsvpsCreated} RSVPs`);

  // 3. Assign zone leads to confirmed volunteers on ~40% of shifts
  console.log('\n👑 Assigning zone leads...');

  const shiftsWithConfirmed = await prisma.shift.findMany({
    where: {
      date: { gte: weekDates[0], lte: weekDates[6] },
    },
    include: {
      volunteers: {
        where: { status: RSVPStatus.CONFIRMED },
      },
    },
  });

  for (const shift of shiftsWithConfirmed) {
    if (Math.random() > 0.4) continue; // 40% of shifts
    if (shift.volunteers.length === 0) continue;

    // Find a confirmed volunteer who is zone lead qualified
    const qualifiedVol = shift.volunteers.find(sv =>
      qualifiedZoneLeads.some(zl => zl.id === sv.userId)
    );

    const volunteerToPromote = qualifiedVol || shift.volunteers[0];

    if (!volunteerToPromote.isZoneLead) {
      await prisma.shiftVolunteer.update({
        where: { id: volunteerToPromote.id },
        data: { isZoneLead: true },
      });
      zoneLeadsAssigned++;
    }
  }

  console.log(`  Assigned: ${zoneLeadsAssigned} zone leads`);

  // 4. Assign dispatchers to time blocks
  console.log('\n🎧 Assigning dispatchers...');

  const dispatcherCandidates = qualifiedDispatchers.length > 0
    ? qualifiedDispatchers
    : [...dispatchers, ...coordinators];

  if (dispatcherCandidates.length > 0) {
    for (const date of weekDates) {
      for (const county of counties) {
        for (const slot of TIME_SLOTS) {
          if (Math.random() > 0.7) continue; // 70% coverage

          const dateOnly = new Date(date);
          dateOnly.setUTCHours(0, 0, 0, 0);

          const startTime = new Date(date);
          startTime.setUTCHours(slot.startHour + 5, 0, 0, 0);

          const endTime = new Date(date);
          endTime.setUTCHours(slot.endHour + 5, 0, 0, 0);

          // Check if already assigned
          const existing = await prisma.dispatcherAssignment.findFirst({
            where: {
              county,
              date: dateOnly,
              startTime,
              endTime,
            },
          });

          if (existing) continue;

          const dispatcher = dispatcherCandidates[Math.floor(Math.random() * dispatcherCandidates.length)];

          try {
            await prisma.dispatcherAssignment.create({
              data: {
                userId: dispatcher.id,
                county,
                date: dateOnly,
                startTime,
                endTime,
                createdById: creator.id,
              },
            });
            dispatchersAssigned++;
          } catch {
            // Skip errors
          }
        }
      }
    }
  }

  console.log(`  Assigned: ${dispatchersAssigned} dispatcher slots`);

  // 5. Assign regional leads
  console.log('\n🌐 Assigning regional leads...');

  const regionalLeadCandidates = [...admins, ...coordinators];

  if (regionalLeadCandidates.length > 0) {
    for (const date of weekDates) {
      if (Math.random() > 0.8) continue; // 80% of days have regional lead

      const dateOnly = new Date(date);
      dateOnly.setUTCHours(0, 0, 0, 0);

      // Check if already assigned
      const existing = await prisma.regionalLeadAssignment.findFirst({
        where: { date: dateOnly },
      });

      if (existing) continue;

      const lead = regionalLeadCandidates[Math.floor(Math.random() * regionalLeadCandidates.length)];

      try {
        await prisma.regionalLeadAssignment.create({
          data: {
            userId: lead.id,
            date: dateOnly,
            isPrimary: true,
            createdById: creator.id,
          },
        });
        regionalLeadsAssigned++;
      } catch {
        // Skip errors
      }
    }
  }

  console.log(`  Assigned: ${regionalLeadsAssigned} regional leads`);

  // Summary
  console.log('\n✅ Summary:');
  console.log(`   Shifts created: ${shiftsCreated}`);
  console.log(`   Shifts skipped: ${shiftsSkipped}`);
  console.log(`   RSVPs created: ${rsvpsCreated}`);
  console.log(`   Zone leads assigned: ${zoneLeadsAssigned}`);
  console.log(`   Dispatcher assignments: ${dispatchersAssigned}`);
  console.log(`   Regional leads assigned: ${regionalLeadsAssigned}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
