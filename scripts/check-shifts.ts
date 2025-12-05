#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Checking shifts in database...');
  console.log('Current server time:', new Date().toISOString());
  console.log('');

  const shifts = await prisma.shift.findMany({
    take: 20,
    orderBy: { date: 'asc' },
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      status: true,
    },
  });

  console.log(`Found ${shifts.length} shifts (showing first 20):`);
  shifts.forEach(s => {
    console.log(`  ${s.title}`);
    console.log(`    date: ${s.date.toISOString()}`);
    console.log(`    startTime: ${s.startTime.toISOString()}`);
    console.log(`    status: ${s.status}`);
    console.log('');
  });

  // Count total
  const total = await prisma.shift.count();
  console.log(`Total shifts in database: ${total}`);

  // Count by status
  const published = await prisma.shift.count({ where: { status: 'PUBLISHED' } });
  const draft = await prisma.shift.count({ where: { status: 'DRAFT' } });
  console.log(`Published: ${published}, Draft: ${draft}`);

  // Count future
  const future = await prisma.shift.count({
    where: {
      date: { gte: new Date() },
      status: 'PUBLISHED',
    },
  });
  console.log(`Future published shifts: ${future}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
