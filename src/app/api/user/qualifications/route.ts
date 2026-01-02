import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/user/qualifications - Get current user's qualifications for the current org
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getCurrentOrgId();

    // Fetch user's qualifications scoped to current org
    const userQualifications = await prisma.userQualification.findMany({
      where: {
        userId: user.id,
        // Multi-org: Only return qualifications from current org's qualified roles
        qualifiedRole: orgId ? { organizationId: orgId } : {},
      },
      include: {
        qualifiedRole: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            description: true,
          },
        },
      },
    });

    // Return the qualified roles (with slug for easy checking)
    const qualifications = userQualifications.map(uq => ({
      id: uq.qualifiedRole.id,
      name: uq.qualifiedRole.name,
      slug: uq.qualifiedRole.slug,
      color: uq.qualifiedRole.color,
      description: uq.qualifiedRole.description,
    }));

    return NextResponse.json(qualifications);
  } catch (error) {
    console.error('Error fetching user qualifications:', error);
    return NextResponse.json({ error: 'Failed to fetch qualifications' }, { status: 500 });
  }
}
