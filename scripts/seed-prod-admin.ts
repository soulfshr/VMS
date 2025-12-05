#!/usr/bin/env tsx
/**
 * Production Admin Seed Script
 * Creates the admin user (joshcottrell@gmail.com) in production database.
 * This script is safe to run multiple times - it only creates users that don't exist.
 *
 * Usage:
 *   DATABASE_URL="your-prod-connection-string" npx tsx scripts/seed-prod-admin.ts
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';

// Load environment variables
dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

  // Create pool with standard pg driver
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Creating production admin user...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'joshcottrell@gmail.com' },
  });

  if (existingAdmin) {
    console.log('Admin user already exists:', existingAdmin.email);
    console.log('  Role:', existingAdmin.role);
    console.log('  Name:', existingAdmin.name);

    // Ensure they have ADMINISTRATOR role
    if (existingAdmin.role !== Role.ADMINISTRATOR) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: Role.ADMINISTRATOR },
      });
      console.log('  Updated role to ADMINISTRATOR');
    }
  } else {
    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'joshcottrell@gmail.com',
        name: 'Josh Cottrell',
        role: Role.ADMINISTRATOR,
        isActive: true,
        isVerified: true,
        // No password set - they'll use forgot password flow to set it
      },
    });
    console.log('Created admin user:', admin.email);
    console.log('  ID:', admin.id);
    console.log('  Role:', admin.role);
  }

  console.log('\nAdmin user setup complete!');
  console.log('\nNext steps:');
  console.log('1. Go to the login page and click "Forgot Password"');
  console.log('2. Enter joshcottrell@gmail.com');
  console.log('3. Check email for password reset link');
  console.log('4. Set your password and login');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
