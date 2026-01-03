import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role, Qualification } from '@/generated/prisma/enums';
import { getCurrentOrgId } from '@/lib/org-context';
import { canSendEmailBlast, createPermissionContext } from '@/lib/permissions';

export interface EmailBlastFilters {
  roles?: string[];
  qualifications?: string[];
  zones?: string[];
  languages?: string[];
  hasQualifications?: 'any' | 'yes' | 'no';
}

// POST /api/admin/email-blast/preview - Get recipient count based on filters
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only coordinators and admins can preview email blasts
    const ctx = createPermissionContext(user.role);
    if (!canSendEmailBlast(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const filters: EmailBlastFilters = body.filters || {};

    // Multi-org: Get org context for scoping
    const orgId = await getCurrentOrgId();

    let count: number;
    let sample: Array<{ id: string; name: string; email: string; role: string }>;

    if (orgId) {
      // Build membership where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberWhere: any = {
        organizationId: orgId,
        isActive: true,
        user: {
          isActive: true,
          emailNotifications: true,
        },
      };

      // Filter by roles - always exclude DEVELOPER users from email blasts
      if (filters.roles && filters.roles.length > 0) {
        const filteredRoles = filters.roles.filter(r => r !== 'DEVELOPER');
        if (filteredRoles.length > 0) {
          memberWhere.role = { in: filteredRoles as Role[] };
        } else {
          memberWhere.role = { in: [] };
        }
      } else {
        memberWhere.role = { not: 'DEVELOPER' };
      }

      // Filter by qualifications via user's userQualifications
      if (filters.hasQualifications === 'yes') {
        memberWhere.user.userQualifications = { some: {} };
      } else if (filters.hasQualifications === 'no') {
        memberWhere.user.userQualifications = { none: {} };
      } else if (filters.qualifications && filters.qualifications.length > 0) {
        memberWhere.user.userQualifications = {
          some: {
            qualifiedRole: {
              slug: { in: filters.qualifications.map((q: string) => q.toUpperCase()) },
              organizationId: orgId,
            },
          },
        };
      }

      if (filters.zones && filters.zones.length > 0) {
        memberWhere.user.zones = {
          some: {
            zoneId: { in: filters.zones },
          },
        };
      }

      if (filters.languages && filters.languages.length > 0) {
        memberWhere.user.OR = filters.languages.map((lang: string) => ({
          OR: [
            { primaryLanguage: lang },
            { otherLanguages: { has: lang } },
          ],
        }));
      }

      const [memberCount, memberSample] = await Promise.all([
        prisma.organizationMember.count({ where: memberWhere }),
        prisma.organizationMember.findMany({
          where: memberWhere,
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          take: 5,
          orderBy: { user: { name: 'asc' } },
        }),
      ]);

      count = memberCount;
      sample = memberSample.map(m => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      }));
    } else {
      // Legacy fallback: Query User directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        isActive: true,
        emailNotifications: true,
      };

      if (filters.roles && filters.roles.length > 0) {
        const filteredRoles = filters.roles.filter(r => r !== 'DEVELOPER');
        if (filteredRoles.length > 0) {
          where.role = { in: filteredRoles as Role[] };
        } else {
          where.role = { in: [] };
        }
      } else {
        where.role = { not: 'DEVELOPER' };
      }

      if (filters.hasQualifications === 'yes') {
        where.qualifications = { isEmpty: false };
      } else if (filters.hasQualifications === 'no') {
        where.qualifications = { isEmpty: true };
      } else if (filters.qualifications && filters.qualifications.length > 0) {
        where.qualifications = { hasSome: filters.qualifications as Qualification[] };
      }

      if (filters.zones && filters.zones.length > 0) {
        where.zones = {
          some: {
            zoneId: { in: filters.zones },
          },
        };
      }

      if (filters.languages && filters.languages.length > 0) {
        where.OR = filters.languages.map((lang: string) => ({
          OR: [
            { primaryLanguage: lang },
            { otherLanguages: { has: lang } },
          ],
        }));
      }

      [count, sample] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
          take: 5,
          orderBy: { name: 'asc' },
        }),
      ]);
    }

    return NextResponse.json({
      count,
      sample,
      filters,
    });
  } catch (error) {
    console.error('Error previewing email blast:', error);
    return NextResponse.json(
      { error: 'Failed to preview recipients' },
      { status: 500 }
    );
  }
}
