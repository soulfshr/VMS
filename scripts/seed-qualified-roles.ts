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

// Default qualified roles to seed
const defaultQualifiedRoles = [
  {
    name: 'Verifier',
    slug: 'VERIFIER',
    description: 'Can verify people at patrols and collection events',
    color: '#22c55e', // Green
    sortOrder: 1,
  },
  {
    name: 'Zone Lead',
    slug: 'ZONE_LEAD',
    description: 'Can lead a zone during a shift, coordinate volunteers',
    color: '#3b82f6', // Blue
    sortOrder: 2,
  },
  {
    name: 'Dispatcher',
    slug: 'DISPATCHER',
    description: 'Can handle dispatch calls and coordinate field response',
    color: '#f59e0b', // Amber
    sortOrder: 3,
  },
];

async function main() {
  console.log('Seeding Qualified Roles...\n');

  // 1. Create the default qualified roles
  const qualifiedRoleMap: Record<string, string> = {};

  for (const role of defaultQualifiedRoles) {
    const existing = await prisma.qualifiedRole.findUnique({
      where: { slug: role.slug },
    });

    if (existing) {
      console.log(`✓ Qualified Role already exists: ${role.name} (${role.slug})`);
      qualifiedRoleMap[role.slug] = existing.id;
    } else {
      const created = await prisma.qualifiedRole.create({
        data: role,
      });
      console.log(`✓ Created Qualified Role: ${role.name} (${role.slug})`);
      qualifiedRoleMap[role.slug] = created.id;
    }
  }

  console.log('\n--- Migrating existing data ---\n');

  // 2. Migrate User.qualifications (enum array) to UserQualification records
  const usersWithQualifications = await prisma.user.findMany({
    where: {
      qualifications: {
        isEmpty: false,
      },
    },
    select: {
      id: true,
      name: true,
      qualifications: true,
    },
  });

  console.log(`Found ${usersWithQualifications.length} users with qualifications to migrate`);

  for (const user of usersWithQualifications) {
    for (const qual of user.qualifications) {
      const qualifiedRoleId = qualifiedRoleMap[qual];
      if (!qualifiedRoleId) {
        console.log(`  ⚠ Unknown qualification ${qual} for user ${user.name}`);
        continue;
      }

      // Check if already migrated
      const existing = await prisma.userQualification.findUnique({
        where: {
          userId_qualifiedRoleId: {
            userId: user.id,
            qualifiedRoleId,
          },
        },
      });

      if (!existing) {
        await prisma.userQualification.create({
          data: {
            userId: user.id,
            qualifiedRoleId,
          },
        });
        console.log(`  ✓ Migrated ${qual} for ${user.name}`);
      }
    }
  }

  // 3. Migrate TrainingType.grantsQualification to grantsQualifiedRoleId
  const trainingTypesWithGrants = await prisma.trainingType.findMany({
    where: {
      grantsQualification: {
        not: null,
      },
    },
  });

  console.log(`\nFound ${trainingTypesWithGrants.length} training types with grantsQualification to migrate`);

  for (const tt of trainingTypesWithGrants) {
    if (tt.grantsQualification && !tt.grantsQualifiedRoleId) {
      const qualifiedRoleId = qualifiedRoleMap[tt.grantsQualification];
      if (qualifiedRoleId) {
        await prisma.trainingType.update({
          where: { id: tt.id },
          data: { grantsQualifiedRoleId: qualifiedRoleId },
        });
        console.log(`  ✓ Migrated ${tt.name} -> ${tt.grantsQualification}`);
      }
    }
  }

  // 4. Migrate ShiftVolunteer.qualification to qualifiedRoleId
  const shiftVolunteersWithQual = await prisma.shiftVolunteer.findMany({
    where: {
      qualification: {
        not: null,
      },
    },
  });

  console.log(`\nFound ${shiftVolunteersWithQual.length} shift volunteers with qualification to migrate`);

  for (const sv of shiftVolunteersWithQual) {
    if (sv.qualification && !sv.qualifiedRoleId) {
      const qualifiedRoleId = qualifiedRoleMap[sv.qualification];
      if (qualifiedRoleId) {
        await prisma.shiftVolunteer.update({
          where: { id: sv.id },
          data: { qualifiedRoleId },
        });
        console.log(`  ✓ Migrated shift volunteer ${sv.id}`);
      }
    }
  }

  // 5. Migrate ShiftTypeQualificationRequirement to ShiftTypeQualifiedRoleRequirement
  const oldReqs = await prisma.shiftTypeQualificationRequirement.findMany({
    include: {
      shiftType: true,
    },
  });

  console.log(`\nFound ${oldReqs.length} shift type qualification requirements to migrate`);

  for (const req of oldReqs) {
    const qualifiedRoleId = qualifiedRoleMap[req.qualification];
    if (!qualifiedRoleId) continue;

    const existing = await prisma.shiftTypeQualifiedRoleRequirement.findUnique({
      where: {
        shiftTypeId_qualifiedRoleId: {
          shiftTypeId: req.shiftTypeId,
          qualifiedRoleId,
        },
      },
    });

    if (!existing) {
      await prisma.shiftTypeQualifiedRoleRequirement.create({
        data: {
          shiftTypeId: req.shiftTypeId,
          qualifiedRoleId,
          minRequired: req.minRequired,
          maxAllowed: req.maxAllowed,
        },
      });
      console.log(`  ✓ Migrated ${req.shiftType.name} - ${req.qualification}`);
    }
  }

  console.log('\n✅ Migration complete!');
  console.log('\nQualified Roles created:');
  for (const [slug, id] of Object.entries(qualifiedRoleMap)) {
    console.log(`  ${slug}: ${id}`);
  }
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
