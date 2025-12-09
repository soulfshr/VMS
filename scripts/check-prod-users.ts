#!/usr/bin/env tsx
/**
 * Check Production Users Script
 * Lists all users in the production database and searches for specific users.
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

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

  const prisma = new PrismaClient({ adapter } as never);

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    console.log('\n=== Recent users in production ===');
    users.forEach(u => {
      const name = u.name || 'No name';
      const created = u.createdAt.toISOString().split('T')[0];
      console.log('- ' + name + ' (' + u.email + ') - ' + u.role + ' - ' + created);
    });

    // Search for anyone named Ana
    const ana = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Ana', mode: 'insensitive' } },
          { email: { contains: 'ana', mode: 'insensitive' } }
        ]
      }
    });

    console.log('\n=== All users with "Ana" in name/email ===');
    if (ana.length === 0) {
      console.log('No users found');
    } else {
      ana.forEach(u => console.log('  - ' + u.name + ' (' + u.email + ') - ' + u.role));
    }

    const totalUsers = await prisma.user.count();
    console.log('\nTotal users in database: ' + totalUsers);

    // Check Regional Lead assignments
    console.log('\n=== Regional Lead Assignments ===');
    const rlAssignments = await prisma.regionalLeadAssignment.findMany({
      include: { user: true }
    });
    if (rlAssignments.length === 0) {
      console.log('No Regional Lead assignments found');
    } else {
      rlAssignments.forEach(a => {
        const userName = a.user ? a.user.name : 'USER DELETED (orphan record)';
        console.log('  - ' + a.date.toISOString().split('T')[0] + ': ' + userName);
      });
    }

    // Check for any recent deletions - look at users created today
    console.log('\n=== Users created in last 3 days ===');
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    recentUsers.forEach(u => {
      console.log('  - ' + u.createdAt.toISOString() + ': ' + u.name + ' (' + u.email + ')');
    });

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
