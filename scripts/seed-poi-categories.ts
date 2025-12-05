/**
 * Seed script for default POI categories
 * Run with: npx tsx scripts/seed-poi-categories.ts
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

const defaultCategories = [
  {
    name: 'ICE/Enforcement',
    slug: 'ICE_ENFORCEMENT',
    color: '#ef4444', // Red
    description: 'Immigration enforcement locations including field offices, detention centers, and checkpoints',
    icon: 'shield',
    sortOrder: 1,
  },
  {
    name: 'Schools',
    slug: 'SCHOOLS',
    color: '#3b82f6', // Blue
    description: 'Educational institutions including K-12 schools and colleges',
    icon: 'school',
    sortOrder: 2,
  },
  {
    name: 'Safe Spaces',
    slug: 'SAFE_SPACES',
    color: '#22c55e', // Green
    description: 'Churches, community centers, and other support locations',
    icon: 'heart',
    sortOrder: 3,
  },
];

async function main() {
  console.log('Seeding POI categories...\n');

  for (const category of defaultCategories) {
    const existing = await prisma.pOICategory.findUnique({
      where: { slug: category.slug },
    });

    if (existing) {
      console.log(`✓ Category "${category.name}" already exists (${existing.id})`);
    } else {
      const created = await prisma.pOICategory.create({
        data: category,
      });
      console.log(`✓ Created category "${category.name}" (${created.id})`);
    }
  }

  // Show summary
  const total = await prisma.pOICategory.count();
  console.log(`\n✅ Done! Total POI categories: ${total}`);
}

main()
  .catch((e) => {
    console.error('Error seeding POI categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
