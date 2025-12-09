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

  console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as never);

  try {
    // Check ShiftTypeConfig
    const shiftTypeConfigs = await prisma.shiftTypeConfig.findMany({
      orderBy: { name: 'asc' }
    });

    console.log('\n=== Shift Type Configs ===');
    shiftTypeConfigs.forEach(st => {
      console.log('  - ' + st.name + ' (slug: ' + st.slug + ', active: ' + st.isActive + ')');
    });

    // Check a sample of shifts to see what type they have
    const shifts = await prisma.shift.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: { typeConfig: true }
    });

    console.log('\n=== Recent Shifts (type field) ===');
    shifts.forEach(s => {
      const typeConfigName = s.typeConfig?.name || 'No typeConfig';
      console.log('  - ' + s.title + ' | enum type: ' + s.type + ' | typeConfig: ' + typeConfigName);
    });

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
