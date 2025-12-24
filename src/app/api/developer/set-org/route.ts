import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

/**
 * POST /api/developer/set-org
 *
 * Sets the active organization for a developer user.
 * Stores the org ID in a cookie that overrides subdomain-based org detection.
 *
 * Body: { orgId: string } - The organization ID to switch to, or '__none__' for orphaned records
 */
export async function POST(request: Request) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only DEVELOPER role can use org override
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
    }

    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Validate org exists (unless __none__ for orphaned records)
    let orgName = 'No Organization';
    if (orgId !== '__none__') {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, isActive: true },
      });

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      if (!org.isActive) {
        return NextResponse.json({ error: 'Organization is inactive' }, { status: 400 });
      }

      orgName = org.name;
    }

    // Set the cookie
    const response = NextResponse.json({
      success: true,
      orgId,
      orgName,
    });

    // Security: Improved cookie settings
    response.cookies.set('dev-org-override', orgId, {
      httpOnly: true,
      secure: true, // Always use secure, even in development
      sameSite: 'strict', // Strict to prevent CSRF
      maxAge: 60 * 60 * 8, // 8 hours (developer session only)
      path: '/',
    });

    // Log the org override for security audit
    console.log(`[Developer] User ${user.email} switched to org: ${orgName} (${orgId})`);

    return response;
  } catch (error) {
    console.error('Error setting developer org override:', error);
    return NextResponse.json({ error: 'Failed to set organization' }, { status: 500 });
  }
}

/**
 * GET /api/developer/set-org
 *
 * Returns the current developer org override (if any)
 */
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
    }

    // Read the cookie from the request
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const devOverride = cookieStore.get('dev-org-override')?.value;

    if (!devOverride) {
      return NextResponse.json({ orgId: null, orgName: null });
    }

    if (devOverride === '__none__') {
      return NextResponse.json({ orgId: '__none__', orgName: 'No Organization (Orphaned)' });
    }

    // Look up the org name
    const org = await prisma.organization.findUnique({
      where: { id: devOverride },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      orgId: devOverride,
      orgName: org?.name || 'Unknown Organization',
    });
  } catch (error) {
    console.error('Error getting developer org override:', error);
    return NextResponse.json({ error: 'Failed to get organization' }, { status: 500 });
  }
}
