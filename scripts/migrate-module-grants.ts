/**
 * Migration script: Migrate grantsQualifiedRoleId to ModuleQualifiedRoleGrant junction table
 *
 * This script migrates existing TrainingModule.grantsQualifiedRoleId values to the new
 * many-to-many junction table ModuleQualifiedRoleGrant.
 *
 * Run with: npx tsx scripts/migrate-module-grants.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

// Use DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function migrateModuleGrants() {
  console.log('Starting migration of module qualified role grants...\n');

  // Find all modules with the deprecated grantsQualifiedRoleId set
  const modulesWithGrants = await prisma.trainingModule.findMany({
    where: {
      grantsQualifiedRoleId: { not: null },
    },
    select: {
      id: true,
      title: true,
      grantsQualifiedRoleId: true,
    },
  });

  console.log(`Found ${modulesWithGrants.length} modules with grantsQualifiedRoleId to migrate.\n`);

  if (modulesWithGrants.length === 0) {
    console.log('No modules to migrate. Exiting.');
    return;
  }

  let migratedCount = 0;
  let skippedCount = 0;

  for (const module of modulesWithGrants) {
    console.log(`Processing module: "${module.title}" (${module.id})`);
    console.log(`  - grantsQualifiedRoleId: ${module.grantsQualifiedRoleId}`);

    // Check if this module already has entries in the new junction table
    const existingGrant = await prisma.moduleQualifiedRoleGrant.findUnique({
      where: {
        moduleId_qualifiedRoleId: {
          moduleId: module.id,
          qualifiedRoleId: module.grantsQualifiedRoleId!,
        },
      },
    });

    if (existingGrant) {
      console.log('  - Already migrated, skipping.\n');
      skippedCount++;
      continue;
    }

    // Create the new junction table entry
    try {
      await prisma.moduleQualifiedRoleGrant.create({
        data: {
          moduleId: module.id,
          qualifiedRoleId: module.grantsQualifiedRoleId!,
        },
      });
      console.log('  - Successfully migrated!\n');
      migratedCount++;
    } catch (error) {
      console.error(`  - Error migrating: ${error}\n`);
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total modules processed: ${modulesWithGrants.length}`);
  console.log(`Successfully migrated: ${migratedCount}`);
  console.log(`Skipped (already migrated): ${skippedCount}`);
  console.log('\nNote: The deprecated grantsQualifiedRoleId field has been preserved for backward compatibility.');
  console.log('You can remove it in a future migration once all clients are updated.');
}

async function main() {
  try {
    await prisma.$connect();
    console.log('Connected to database.\n');
    await migrateModuleGrants();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\nDisconnected from database.');
  }
}

main();
