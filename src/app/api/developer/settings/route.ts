import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';

/**
 * GET /api/developer/settings - Get developer-only settings
 */
export async function GET() {
  const user = await getDbUser();

  if (!user || user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getCurrentOrgId();

  const settings = await prisma.organizationSettings.findFirst({
    where: orgId ? { organizationId: orgId } : {},
    select: {
      feedbackEmail: true,
    }
  });

  return NextResponse.json({
    feedbackEmail: settings?.feedbackEmail || '',
  });
}

/**
 * PATCH /api/developer/settings - Update developer-only settings
 */
export async function PATCH(request: NextRequest) {
  const user = await getDbUser();

  if (!user || user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { feedbackEmail } = body;

    // Validate email format if provided
    if (feedbackEmail && feedbackEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(feedbackEmail.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    const orgId = await getCurrentOrgId();

    // Get or create the settings record (scoped to org)
    const existingSettings = await prisma.organizationSettings.findFirst({
      where: orgId ? { organizationId: orgId } : {},
    });

    if (existingSettings) {
      await prisma.organizationSettings.update({
        where: { id: existingSettings.id },
        data: {
          feedbackEmail: feedbackEmail?.trim() || null,
        }
      });
    } else {
      const createOrgId = await getOrgIdForCreate();
      await prisma.organizationSettings.create({
        data: {
          organizationId: createOrgId,
          feedbackEmail: feedbackEmail?.trim() || null,
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Developer Settings] Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
