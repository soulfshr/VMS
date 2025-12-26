import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'josh@cottrellconsulting.us' },
    include: {
      organization: true,
      memberships: {
        include: { organization: true }
      }
    }
  });
  
  console.log('\n=== User Details ===');
  console.log('Email:', user?.email);
  console.log('Name:', user?.name);
  console.log('ID:', user?.id);
  console.log('Legacy OrganizationId:', user?.organizationId);
  console.log('Legacy Org Name:', user?.organization?.name || '(none)');
  console.log('\n=== OrganizationMember Records ===');
  console.log('Count:', user?.memberships.length || 0);
  user?.memberships.forEach(m => {
    console.log(`  - ${m.organization.slug} (${m.organization.name}): role=${m.role}, status=${m.accountStatus}, active=${m.isActive}`);
  });
  
  // Check all orgs
  const allOrgs = await prisma.organization.findMany({
    select: { id: true, slug: true, name: true }
  });
  console.log('\n=== All Organizations ===');
  allOrgs.forEach(o => console.log(`  - ${o.slug}: ${o.name} (${o.id})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
