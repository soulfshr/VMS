import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

/**
 * POST /api/developer/migrate-org-ids
 * Backfill organizationId on all legacy records with null organizationId
 * Assigns them to the specified organization (defaults to Siembra NC)
 * Requires DEVELOPER role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetSlug = body.targetSlug || 'nc'; // Default to Siembra NC

    // Find the target organization
    const targetOrg = await prisma.organization.findFirst({
      where: { slug: targetSlug },
    });

    if (!targetOrg) {
      return NextResponse.json(
        { error: `Organization with slug "${targetSlug}" not found` },
        { status: 404 }
      );
    }

    console.log(`Migrating legacy data to organization: ${targetOrg.name} (${targetOrg.id})`);

    // Track migration results
    const results: Record<string, number> = {};

    // Migrate Users (exclude DEVELOPER accounts - they should have no org)
    const usersResult = await prisma.user.updateMany({
      where: {
        organizationId: null,
        role: { not: 'DEVELOPER' },
      },
      data: { organizationId: targetOrg.id },
    });
    results.users = usersResult.count;

    // Clear organizationId from any DEVELOPER accounts (they should not belong to any org)
    const devClearResult = await prisma.user.updateMany({
      where: {
        role: 'DEVELOPER',
        organizationId: { not: null },
      },
      data: { organizationId: null },
    });
    results.developersCleared = devClearResult.count;

    // Migrate Zones
    const zonesResult = await prisma.zone.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.zones = zonesResult.count;

    // Migrate CoverageConfigs
    const coverageConfigsResult = await prisma.coverageConfig.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.coverageConfigs = coverageConfigsResult.count;

    // Migrate CoverageSignups (via zone relation - skip if zone handles it)
    // CoverageSignup doesn't have direct organizationId, it goes through Zone

    // Migrate Shifts
    const shiftsResult = await prisma.shift.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.shifts = shiftsResult.count;

    // Migrate TrainingSessions
    const trainingSessionsResult = await prisma.trainingSession.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.trainingSessions = trainingSessionsResult.count;

    // Migrate IceSightings
    const sightingsResult = await prisma.iceSighting.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.iceSightings = sightingsResult.count;

    // Migrate QualifiedRoles
    const qualifiedRolesResult = await prisma.qualifiedRole.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.qualifiedRoles = qualifiedRolesResult.count;

    // Migrate ShiftTypeConfigs
    const shiftTypeConfigsResult = await prisma.shiftTypeConfig.updateMany({
      where: { organizationId: null },
      data: { organizationId: targetOrg.id },
    });
    results.shiftTypeConfigs = shiftTypeConfigsResult.count;

    // Calculate total
    const totalMigrated = Object.values(results).reduce((sum, count) => sum + count, 0);

    console.log('Migration results:', results);
    console.log(`Total records migrated: ${totalMigrated}`);

    return NextResponse.json({
      success: true,
      message: `Migrated ${totalMigrated} records to organization "${targetOrg.name}"`,
      organization: {
        id: targetOrg.id,
        name: targetOrg.name,
        slug: targetOrg.slug,
      },
      results,
      totalMigrated,
    });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developer/migrate-org-ids
 * Check status - count records with null organizationId
 * Requires DEVELOPER role
 */
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count records with null organizationId
    const counts: Record<string, number> = {};

    counts.users = await prisma.user.count({
      where: {
        organizationId: null,
        role: { not: 'DEVELOPER' },
      },
    });
    counts.developersWithOrg = await prisma.user.count({
      where: {
        role: 'DEVELOPER',
        organizationId: { not: null },
      },
    });
    counts.zones = await prisma.zone.count({ where: { organizationId: null } });
    counts.coverageConfigs = await prisma.coverageConfig.count({ where: { organizationId: null } });
    counts.shifts = await prisma.shift.count({ where: { organizationId: null } });
    counts.trainingSessions = await prisma.trainingSession.count({ where: { organizationId: null } });
    counts.iceSightings = await prisma.iceSighting.count({ where: { organizationId: null } });
    counts.qualifiedRoles = await prisma.qualifiedRole.count({ where: { organizationId: null } });
    counts.shiftTypeConfigs = await prisma.shiftTypeConfig.count({ where: { organizationId: null } });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      recordsWithNullOrgId: counts,
      total,
      migrationNeeded: total > 0,
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json(
      { error: 'Failed to check status', details: String(error) },
      { status: 500 }
    );
  }
}
