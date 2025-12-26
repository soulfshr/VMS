import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Create Edge-compatible auth instance (no database imports)
const { auth } = NextAuth(authConfig);

// Session user type for middleware
interface SessionUser {
  id: string;
  email: string;
  currentOrgId: string | null;
  accountStatus?: string;
  memberships: Array<{
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    role: string;
    accountStatus: string;
  }>;
}

export default auth(async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip auth for upload routes (they handle their own auth)
  if (pathname.startsWith('/api/training-center/upload')) {
    return NextResponse.next();
  }

  // Get auth from the request (populated by NextAuth wrapper)
  const session = (request as any).auth;
  const isLoggedIn = !!session?.user;
  const user = session?.user as SessionUser | undefined;

  // Public routes that don't need auth or org check
  const publicRoutes = ['/', '/login', '/signup', '/about', '/privacy', '/terms', '/forgot-password', '/reset-password', '/set-password', '/pending', '/select-org', '/join'];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const isPublicApi = pathname.startsWith('/api/public/') || pathname.startsWith('/api/auth/');

  if (isPublicRoute || isPublicApi) {
    return NextResponse.next();
  }

  // Handle unauthenticated users
  if (!isLoggedIn || !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const memberships = user.memberships || [];

  // Check if user needs to select an org
  if (!user.currentOrgId) {
    // No org selected - redirect based on membership count
    if (memberships.length === 0) {
      // No memberships at all - redirect to join page
      if (pathname !== '/join') {
        const url = request.nextUrl.clone();
        url.pathname = '/join';
        return NextResponse.redirect(url);
      }
    } else {
      // Has memberships but none selected - redirect to org picker
      if (pathname !== '/select-org') {
        const url = request.nextUrl.clone();
        url.pathname = '/select-org';
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // User has an org selected - check account status for that org
  const currentMembership = memberships.find(
    m => m.organizationId === user.currentOrgId
  );

  if (currentMembership) {
    const accountStatus = currentMembership.accountStatus;
    if (accountStatus === 'PENDING' || accountStatus === 'REJECTED') {
      if (pathname !== '/pending') {
        const url = request.nextUrl.clone();
        url.pathname = '/pending';
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  // Match all routes except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
