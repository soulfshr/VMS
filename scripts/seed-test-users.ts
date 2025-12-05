import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, Qualification } from '../src/generated/prisma/client';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Adding test users to database...\n');

  const testUsers = [
    {
      email: 'coordinator@coordinator.com',
      name: 'Test Coordinator',
      role: Role.COORDINATOR,
      password: 'password123',
      qualifications: [] as Qualification[],
    },
    {
      email: 'admin@admin.com',
      name: 'Test Admin',
      role: Role.ADMINISTRATOR,
      password: 'password123',
      qualifications: [] as Qualification[],
    },
    {
      email: 'dispatcher@dispatcher.com',
      name: 'Test Dispatcher',
      role: Role.DISPATCHER,
      password: 'password123',
      qualifications: [Qualification.DISPATCHER],
    },
  ];

  for (const user of testUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existing) {
      // Update password if user exists
      await prisma.user.update({
        where: { email: user.email },
        data: {
          passwordHash,
          passwordSetAt: new Date(),
          role: user.role,
          qualifications: user.qualifications,
        },
      });
      console.log(`Updated: ${user.email} (${user.role})`);
    } else {
      // Create new user
      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash,
          passwordSetAt: new Date(),
          isActive: true,
          isVerified: true,
          qualifications: user.qualifications,
        },
      });
      console.log(`Created: ${user.email} (${user.role})`);
    }
  }

  console.log('\nDone! Test users ready.');
  console.log('\nCredentials:');
  console.log('  coordinator@coordinator.com / password123');
  console.log('  admin@admin.com / password123');
  console.log('  dispatcher@dispatcher.com / password123');
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
