import { NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/org-context';

/**
 * GET /api/org/current
 * Returns the current organization context (from subdomain or default)
 */
export async function GET() {
  try {
    const org = await getCurrentOrganization();

    if (!org) {
      return NextResponse.json({ slug: null, name: null, id: null });
    }

    return NextResponse.json({
      id: org.id,
      slug: org.slug,
      name: org.name,
    });
  } catch (error) {
    console.error('Error fetching current org:', error);
    return NextResponse.json({ slug: null, name: null, id: null });
  }
}
