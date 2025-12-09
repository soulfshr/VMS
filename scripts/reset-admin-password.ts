import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';

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
  const email = process.argv[2] || 'admin@admin.com';
  const password = process.argv[3] || 'Password123!';

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
    select: { id: true, email: true, name: true }
  });

  console.log('Password reset for:', user);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
