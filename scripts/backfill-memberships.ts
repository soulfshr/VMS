import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set. Check .env.local exists.');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking migration status...');

  const [totalUsers, usersWithOrg, usersWithMembership, usersNeedingMigration] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { organizationId: { not: null } } }),
    prisma.user.count({ where: { memberships: { some: {} } } }),
    prisma.user.count({
      where: {
        organizationId: { not: null },
        memberships: { none: {} }
      }
    })
  ]);

  console.log({
    totalUsers,
    usersWithOrganization: usersWithOrg,
    usersWithMembership,
    usersNeedingMigration
  });

  if (usersNeedingMigration === 0) {
    console.log('\nNo users need migration - all done!');
    return;
  }

  console.log(`\nMigrating ${usersNeedingMigration} users...`);

  // Find users to migrate
  const usersToMigrate = await prisma.user.findMany({
    where: {
      organizationId: { not: null },
      memberships: { none: {} }
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      accountStatus: true,
      applicationDate: true,
      approvedById: true,
      approvedAt: true,
      rejectionReason: true,
      intakeResponses: true,
      notes: true,
    }
  });

  // Create memberships
  const result = await prisma.organizationMember.createMany({
    data: usersToMigrate.map(u => ({
      userId: u.id,
      organizationId: u.organizationId!,
      role: u.role,
      accountStatus: u.accountStatus,
      applicationDate: u.applicationDate,
      approvedById: u.approvedById,
      approvedAt: u.approvedAt,
      rejectionReason: u.rejectionReason,
      intakeResponses: u.intakeResponses ?? undefined,
      notes: u.notes,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  console.log(`\nCreated ${result.count} OrganizationMember records`);

  // Verify
  const finalCount = await prisma.user.count({
    where: {
      organizationId: { not: null },
      memberships: { none: {} }
    }
  });

  console.log(`Users still needing migration: ${finalCount}`);
  console.log('\nMigration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
