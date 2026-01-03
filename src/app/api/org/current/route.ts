import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentOrganization, getCurrentOrgId } from '@/lib/org-context';

/**
 * GET /api/org/current
 * Returns the current organization context (from subdomain or default)
 * Includes branding settings like logo
 */
export async function GET() {
  try {
    const org = await getCurrentOrganization();

    if (!org) {
      return NextResponse.json({ slug: null, name: null, id: null, logoUrl: null });
    }

    // Fetch organization settings to get logo
    const orgId = await getCurrentOrgId();
    const settings = orgId ? await prisma.organizationSettings.findFirst({
      where: { organizationId: orgId },
      select: { logoUrl: true },
    }) : null;

    return NextResponse.json({
      id: org.id,
      slug: org.slug,
      name: org.name,
      logoUrl: settings?.logoUrl || null,
    });
  } catch (error) {
    console.error('Error fetching current org:', error);
    return NextResponse.json({ slug: null, name: null, id: null, logoUrl: null });
  }
}
