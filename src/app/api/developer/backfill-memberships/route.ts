import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

/**
 * POST /api/developer/backfill-memberships
 *
 * Backfills OrganizationMember records from existing User data.
 * Creates a membership for each user that has an organizationId set.
 *
 * This is a one-time migration endpoint for the multi-org transition.
 * Only accessible by DEVELOPER role.
 */
export async function POST() {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
  }

  try {
    // Find all users with an organizationId but no corresponding OrganizationMember
    const usersToMigrate = await prisma.user.findMany({
      where: {
        organizationId: { not: null },
        memberships: {
          none: {}  // No existing memberships
        }
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

    if (usersToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to migrate - all users already have memberships or no organizationId',
        migrated: 0
      });
    }

    // Create OrganizationMember records for each user
    const memberships = await prisma.organizationMember.createMany({
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

    console.log(`[Backfill] Created ${memberships.count} OrganizationMember records`);

    return NextResponse.json({
      success: true,
      message: `Migrated ${memberships.count} users to OrganizationMember`,
      migrated: memberships.count,
      users: usersToMigrate.map(u => u.id)
    });

  } catch (error) {
    console.error('[Backfill] Error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill memberships' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developer/backfill-memberships
 *
 * Check the current state of the migration.
 */
export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
  }

  try {
    const [
      totalUsers,
      usersWithOrg,
      usersWithMembership,
      usersNeedingMigration
    ] = await Promise.all([
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

    return NextResponse.json({
      totalUsers,
      usersWithOrganization: usersWithOrg,
      usersWithMembership,
      usersNeedingMigration,
      migrationComplete: usersNeedingMigration === 0
    });

  } catch (error) {
    console.error('[Backfill] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
