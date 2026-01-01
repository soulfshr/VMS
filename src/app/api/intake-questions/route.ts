import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentOrgId } from '@/lib/org-context';

// GET /api/intake-questions - Public endpoint to get active intake questions for signup form
// Scoped to current organization (from subdomain)
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const orgFilter = orgId
      ? { organizationId: orgId }
      : { organizationId: '__NO_ORG_SELECTED__' };

    const questions = await prisma.intakeQuestion.findMany({
      where: {
        isActive: true,
        // Multi-tenant: scope to current org
        ...orgFilter,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        question: true,
        type: true,
        options: true,
        required: true,
      },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching intake questions:', error);
    return NextResponse.json({ error: 'Failed to fetch intake questions' }, { status: 500 });
  }
}
