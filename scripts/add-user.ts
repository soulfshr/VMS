import * as dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || email.split('@')[0];
  const role = (process.argv[5] as Role) || 'VOLUNTEER';

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/add-user.ts <email> <password> [name] [role]');
    process.exit(1);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Update password
    const user = await prisma.user.update({
      where: { email },
      data: { passwordHash },
      select: { id: true, email: true, name: true, role: true }
    });
    console.log('Updated user password:', user);
  } else {
    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        isActive: true,
        isVerified: true,
      },
      select: { id: true, email: true, name: true, role: true }
    });
    console.log('Created user:', user);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
