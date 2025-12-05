#!/usr/bin/env tsx
/**
 * Sync Zones and Email Branding to Production
 * This script copies zones and settings from dev to production database.
 *
 * Usage:
 *   DEV_DATABASE_URL="your-dev-connection" PROD_DATABASE_URL="your-prod-connection" npx tsx scripts/sync-to-prod.ts
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

dotenv.config();

async function main() {
  const devUrl = process.env.DEV_DATABASE_URL;
  const prodUrl = process.env.PROD_DATABASE_URL;

  if (!devUrl || !prodUrl) {
    console.error('Both DEV_DATABASE_URL and PROD_DATABASE_URL must be set');
    process.exit(1);
  }

  console.log('Connecting to DEV:', devUrl.replace(/:[^:@]+@/, ':***@'));
  console.log('Connecting to PROD:', prodUrl.replace(/:[^:@]+@/, ':***@'));

  // Create DEV connection
  const devPool = new pg.Pool({ connectionString: devUrl });
  const devAdapter = new PrismaPg(devPool);
  const devPrisma = new PrismaClient({ adapter: devAdapter });

  // Create PROD connection
  const prodPool = new pg.Pool({ connectionString: prodUrl });
  const prodAdapter = new PrismaPg(prodPool);
  const prodPrisma = new PrismaClient({ adapter: prodAdapter });

  try {
    // ===== SYNC ZONES =====
    console.log('\nSyncing zones...');
    const devZones = await devPrisma.zone.findMany({
      orderBy: { name: 'asc' },
    });
    console.log(`Found ${devZones.length} zones in dev`);

    for (const zone of devZones) {
      const existingZone = await prodPrisma.zone.findFirst({
        where: { name: zone.name },
      });

      if (existingZone) {
        await prodPrisma.zone.update({
          where: { id: existingZone.id },
          data: {
            county: zone.county,
            description: zone.description,
            isActive: zone.isActive,
            signalGroup: zone.signalGroup,
          },
        });
        console.log(`  Updated: ${zone.name}`);
      } else {
        await prodPrisma.zone.create({
          data: {
            name: zone.name,
            county: zone.county,
            description: zone.description,
            isActive: zone.isActive,
            signalGroup: zone.signalGroup,
          },
        });
        console.log(`  Created: ${zone.name}`);
      }
    }

    // ===== SYNC ORGANIZATION SETTINGS =====
    console.log('\nSyncing organization settings...');
    const devSettings = await devPrisma.organizationSettings.findFirst();

    if (devSettings) {
      const prodSettings = await prodPrisma.organizationSettings.findFirst();

      if (prodSettings) {
        await prodPrisma.organizationSettings.update({
          where: { id: prodSettings.id },
          data: {
            orgName: devSettings.orgName,
            emailFromName: devSettings.emailFromName,
            emailFromAddress: devSettings.emailFromAddress,
            emailReplyTo: devSettings.emailReplyTo,
            emailFooter: devSettings.emailFooter,
            autoConfirmRsvp: devSettings.autoConfirmRsvp,
            timezone: devSettings.timezone,
          },
        });
        console.log('  Updated organization settings');
      } else {
        await prodPrisma.organizationSettings.create({
          data: {
            orgName: devSettings.orgName,
            emailFromName: devSettings.emailFromName,
            emailFromAddress: devSettings.emailFromAddress,
            emailReplyTo: devSettings.emailReplyTo,
            emailFooter: devSettings.emailFooter,
            autoConfirmRsvp: devSettings.autoConfirmRsvp,
            timezone: devSettings.timezone,
          },
        });
        console.log('  Created organization settings');
      }
      console.log(`    - Organization Name: ${devSettings.orgName}`);
      console.log(`    - Email From Name: ${devSettings.emailFromName}`);
      console.log(`    - Email Reply To: ${devSettings.emailReplyTo}`);
    } else {
      console.log('  No organization settings found in dev');
    }

    // ===== SYNC SHIFT TYPE CONFIGS =====
    console.log('\nSyncing shift type configurations...');
    const devShiftTypes = await devPrisma.shiftTypeConfig.findMany({
      include: { qualificationRequirements: true },
      orderBy: { sortOrder: 'asc' },
    });
    console.log(`Found ${devShiftTypes.length} shift types in dev`);

    for (const shiftType of devShiftTypes) {
      const existingType = await prodPrisma.shiftTypeConfig.findFirst({
        where: { slug: shiftType.slug },
      });

      if (existingType) {
        await prodPrisma.shiftTypeConfig.update({
          where: { id: existingType.id },
          data: {
            name: shiftType.name,
            description: shiftType.description,
            color: shiftType.color,
            isActive: shiftType.isActive,
            defaultMinVolunteers: shiftType.defaultMinVolunteers,
            defaultIdealVolunteers: shiftType.defaultIdealVolunteers,
            defaultMaxVolunteers: shiftType.defaultMaxVolunteers,
            sortOrder: shiftType.sortOrder,
          },
        });
        console.log(`  Updated: ${shiftType.name}`);
      } else {
        await prodPrisma.shiftTypeConfig.create({
          data: {
            name: shiftType.name,
            slug: shiftType.slug,
            description: shiftType.description,
            color: shiftType.color,
            isActive: shiftType.isActive,
            defaultMinVolunteers: shiftType.defaultMinVolunteers,
            defaultIdealVolunteers: shiftType.defaultIdealVolunteers,
            defaultMaxVolunteers: shiftType.defaultMaxVolunteers,
            sortOrder: shiftType.sortOrder,
          },
        });
        console.log(`  Created: ${shiftType.name}`);
      }
    }

    // ===== SYNC TRAINING TYPES =====
    console.log('\nSyncing training types...');
    const devTrainingTypes = await devPrisma.trainingType.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    console.log(`Found ${devTrainingTypes.length} training types in dev`);

    for (const trainingType of devTrainingTypes) {
      const existingType = await prodPrisma.trainingType.findFirst({
        where: { slug: trainingType.slug },
      });

      if (existingType) {
        await prodPrisma.trainingType.update({
          where: { id: existingType.id },
          data: {
            name: trainingType.name,
            description: trainingType.description,
            color: trainingType.color,
            isActive: trainingType.isActive,
            defaultDuration: trainingType.defaultDuration,
            defaultCapacity: trainingType.defaultCapacity,
            grantsQualification: trainingType.grantsQualification,
            sortOrder: trainingType.sortOrder,
          },
        });
        console.log(`  Updated: ${trainingType.name}`);
      } else {
        await prodPrisma.trainingType.create({
          data: {
            name: trainingType.name,
            slug: trainingType.slug,
            description: trainingType.description,
            color: trainingType.color,
            isActive: trainingType.isActive,
            defaultDuration: trainingType.defaultDuration,
            defaultCapacity: trainingType.defaultCapacity,
            grantsQualification: trainingType.grantsQualification,
            sortOrder: trainingType.sortOrder,
          },
        });
        console.log(`  Created: ${trainingType.name}`);
      }
    }

    console.log('\n✅ Sync completed successfully!');

  } finally {
    await devPrisma.$disconnect();
    await prodPrisma.$disconnect();
    await devPool.end();
    await prodPool.end();
  }
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
