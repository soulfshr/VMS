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

  // Check Acme org data
  const acmeOrg = await prisma.organization.findFirst({
    where: { slug: 'acme' }
  });

  if (acmeOrg) {
    console.log('\n=== Acme Org Data ===');

    const qualifiedRoles = await prisma.qualifiedRole.findMany({
      where: { organizationId: acmeOrg.id }
    });
    console.log('Qualified roles:', qualifiedRoles.map(r => r.name));

    const shifts = await prisma.shift.findMany({
      where: { organizationId: acmeOrg.id },
      take: 5,
      include: { zone: true }
    });
    console.log('Shifts count:', shifts.length);
    shifts.forEach(s => {
      console.log(`  - ${s.title}: date=${s.date.toISOString().split('T')[0]}, status=${s.status}, max=${s.maxVolunteers}, zone=${s.zone?.name || 'none'}`);
    });

    // Check user qualifications
    if (user) {
      const userQuals = await prisma.userQualification.findMany({
        where: { userId: user.id },
        include: { qualifiedRole: true }
      });
      console.log('User qualifications:', userQuals.map(q => q.qualifiedRole.name));
    }

    // Check org settings
    const settings = await prisma.organizationSettings.findFirst({
      where: { organizationId: acmeOrg.id }
    });
    console.log('Scheduling model:', settings?.primarySchedulingModel || 'not set');

    // Check coverage slots
    const coverageSlots = await prisma.coverageSignup.count({
      where: { organizationId: acmeOrg.id }
    });
    console.log('Coverage signups:', coverageSlots);

    // Check zones
    const zones = await prisma.zone.findMany({
      where: { organizationId: acmeOrg.id }
    });
    console.log('Zones:', zones.map(z => z.name));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
