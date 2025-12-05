import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

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
  const roleSlug = process.argv[3]; // e.g., 'VERIFIER', 'ZONE_LEAD', 'DISPATCHER'

  if (!email) {
    console.error('Usage: npx tsx scripts/assign-qualifications.ts <email> [role_slug]');
    console.error('If no role_slug provided, shows current qualifications');
    process.exit(1);
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userQualifications: {
        include: {
          qualifiedRole: true,
        },
      },
    },
  });

  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('\nUser:', user.name, '(' + user.email + ')');
  console.log('Current qualifications:', user.userQualifications.map(uq => uq.qualifiedRole.name).join(', ') || 'None');

  // If role slug provided, add it
  if (roleSlug) {
    const qualifiedRole = await prisma.qualifiedRole.findUnique({
      where: { slug: roleSlug.toUpperCase() },
    });

    if (!qualifiedRole) {
      console.error('\nQualified role not found:', roleSlug);
      console.log('\nAvailable roles:');
      const allRoles = await prisma.qualifiedRole.findMany({ where: { isActive: true } });
      allRoles.forEach(r => console.log(`  - ${r.slug} (${r.name})`));
      process.exit(1);
    }

    // Check if already assigned
    const existing = user.userQualifications.find(uq => uq.qualifiedRoleId === qualifiedRole.id);
    if (existing) {
      console.log('\nUser already has this qualification');
    } else {
      await prisma.userQualification.create({
        data: {
          userId: user.id,
          qualifiedRoleId: qualifiedRole.id,
        },
      });
      console.log('\nAdded qualification:', qualifiedRole.name);
    }
  } else {
    // Just show available roles
    console.log('\nAvailable roles to assign:');
    const allRoles = await prisma.qualifiedRole.findMany({ where: { isActive: true } });
    allRoles.forEach(r => console.log(`  - ${r.slug} (${r.name})`));
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
