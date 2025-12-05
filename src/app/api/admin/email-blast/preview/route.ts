import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { Role, Qualification } from '@/generated/prisma/enums';

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
    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const filters: EmailBlastFilters = body.filters || {};

    // Build where clause based on filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true,
      emailNotifications: true, // Respect opt-out preference
    };

    // Filter by roles
    if (filters.roles && filters.roles.length > 0) {
      where.role = { in: filters.roles as Role[] };
    }

    // Filter by qualifications
    if (filters.hasQualifications === 'yes') {
      where.qualifications = { isEmpty: false };
    } else if (filters.hasQualifications === 'no') {
      where.qualifications = { isEmpty: true };
    } else if (filters.qualifications && filters.qualifications.length > 0) {
      where.qualifications = { hasSome: filters.qualifications as Qualification[] };
    }

    // Filter by zones
    if (filters.zones && filters.zones.length > 0) {
      where.zones = {
        some: {
          zoneId: { in: filters.zones },
        },
      };
    }

    // Filter by languages
    if (filters.languages && filters.languages.length > 0) {
      where.OR = filters.languages.map(lang => ({
        OR: [
          { primaryLanguage: lang },
          { otherLanguages: { has: lang } },
        ],
      }));
    }

    // Get count and sample of recipients
    const [count, sample] = await Promise.all([
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
