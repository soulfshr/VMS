/**
 * Seed Rally Points for each zone
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-rally-points.ts
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

const rallyPoints = [
  { zone: 'Durham 1', address: "Lowe's, 4402 Fayetteville Rd, Durham, NC 27713", lat: 35.9189, lng: -78.9395 },
  { zone: 'Durham 2', address: 'Durham Solidarity Hub, 1803 B Chapel Hill Rd, Durham, NC 27707', lat: 35.9836, lng: -78.9377 },
  { zone: 'Durham 3', address: 'Compare Foods parking lot, near bus stop', lat: 35.9765, lng: -78.8982 },
  { zone: 'Durham 4', address: 'Trinity Ave Presbyterian parking lot off of Gregson St.', lat: 36.0043, lng: -78.8995 },
  { zone: 'Durham 5', address: "Shepherd's House United Methodist Church, 107 N. Driver St.", lat: 36.0558, lng: -78.8772 },
  { zone: 'Wake 1', address: 'Home Depot, 2031 Walnut St, Cary, NC 27518', lat: 35.7721, lng: -78.7803 },
  { zone: 'Wake 2', address: 'Walmart- 1725 n. New Hope church Road, Raleigh', lat: 35.8621, lng: -78.5723 },
  { zone: 'Wake 3', address: 'Sheetz: 40 Cabela Dr, Garner, NC 27529', lat: 35.6617, lng: -78.6258 },
];

async function main() {
  console.log('Fetching zones, categories, and admin user...\n');

  // Get all zones
  const zones = await prisma.zone.findMany();
  console.log('Zones found:', zones.map(z => z.name).join(', '));

  // Get an admin user for createdById
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMINISTRATOR' }
  });
  if (!adminUser) {
    throw new Error('No administrator user found');
  }
  console.log('Admin user:', adminUser.email);

  // Get or create Rally Point category
  let category = await prisma.pOICategory.findFirst({
    where: { name: 'Rally Point' }
  });

  if (!category) {
    console.log('\nCreating Rally Point category...');
    category = await prisma.pOICategory.create({
      data: {
        name: 'Rally Point',
        slug: 'RALLY_POINT',
        color: '#10b981', // Green color
        icon: 'flag',
        description: 'Meeting points for zone volunteers at start of shifts',
        sortOrder: 4,
      }
    });
    console.log(`✓ Created category: ${category.name}`);
  } else {
    console.log(`\n✓ Category already exists: ${category.name}`);
  }

  // Create POIs for each zone
  console.log('\nCreating Rally Points...\n');

  for (const rp of rallyPoints) {
    const zone = zones.find(z => z.name === rp.zone);
    if (!zone) {
      console.log(`⚠ Zone not found: ${rp.zone}`);
      continue;
    }

    // Check if POI already exists
    const existing = await prisma.pointOfInterest.findFirst({
      where: {
        name: `${rp.zone} Rally Point`,
        zoneId: zone.id,
      }
    });

    if (existing) {
      console.log(`↺ Updating Rally Point for ${rp.zone}...`);
      await prisma.pointOfInterest.update({
        where: { id: existing.id },
        data: {
          address: rp.address,
          latitude: rp.lat,
          longitude: rp.lng,
          categoryId: category.id,
        }
      });
    } else {
      console.log(`✓ Creating Rally Point for ${rp.zone}...`);
      await prisma.pointOfInterest.create({
        data: {
          name: `${rp.zone} Rally Point`,
          address: rp.address,
          latitude: rp.lat,
          longitude: rp.lng,
          zoneId: zone.id,
          categoryId: category.id,
          createdById: adminUser.id,
          isActive: true,
        }
      });
    }
  }

  // List all Rally Point POIs
  const pois = await prisma.pointOfInterest.findMany({
    where: { categoryId: category.id },
    include: { zone: true, category: true },
    orderBy: { name: 'asc' }
  });

  console.log('\n✅ Rally Points created:\n');
  pois.forEach(poi => {
    console.log(`  • ${poi.name}`);
    console.log(`    ${poi.address}`);
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error('Error seeding Rally Points:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
