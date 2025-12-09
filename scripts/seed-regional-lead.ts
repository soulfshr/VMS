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

async function main() {
  console.log('Seeding Regional Lead Qualified Role...\n');

  const existing = await prisma.qualifiedRole.findUnique({
    where: { slug: 'REGIONAL_LEAD' },
  });

  if (existing) {
    console.log('✓ Regional Lead role already exists:', existing.id);
    return;
  }

  const role = await prisma.qualifiedRole.create({
    data: {
      name: 'Regional Lead',
      slug: 'REGIONAL_LEAD',
      description: 'Coordinates all Triangle zones for an entire day',
      color: '#8b5cf6', // Purple
      sortOrder: 4,
      countsTowardMinimum: false, // Not tied to specific shifts
      isActive: true,
    },
  });

  console.log('✓ Created Regional Lead role:', role.id);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
