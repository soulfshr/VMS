import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check shifts for this week
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: new Date('2025-12-01'),
        lte: new Date('2025-12-07'),
      },
    },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      zone: { select: { name: true } },
    },
  });
  console.log('Shifts for Dec 1-7:', JSON.stringify(shifts, null, 2));

  // Check dispatcher assignments
  const dispatchers = await prisma.dispatcherAssignment.findMany({
    where: {
      date: {
        gte: new Date('2025-12-01'),
        lte: new Date('2025-12-07'),
      },
    },
  });
  console.log('\nDispatcher assignments:', dispatchers.length);

  // Check all shift statuses
  const allShifts = await prisma.shift.groupBy({
    by: ['status'],
    _count: true,
  });
  console.log('\nAll shift statuses:', allShifts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
