import type { NextAuthConfig } from 'next-auth';

// Extended user type for middleware access
interface ExtendedUser {
  id?: string;
  email?: string;
  name?: string;
  currentOrganizationId?: string;
  currentOrganizationSlug?: string;
  role?: string;
  zone?: string;
  qualifications?: string[];
  accountStatus?: string;
  memberships?: Array<{
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    role: string;
    accountStatus: string;
  }>;
}

// Base auth config without database imports (for Edge runtime/middleware)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [], // Will be populated in auth.ts
  callbacks: {
    // Session callback to expose JWT data to the auth object
    // This is needed for the middleware to access accountStatus and membership data
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.currentOrganizationId = token.currentOrganizationId as string | undefined;
        session.user.currentOrganizationSlug = token.currentOrganizationSlug as string | undefined;
        session.user.role = token.role as 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
        session.user.zone = token.zone as string | undefined;
        session.user.qualifications = (token.qualifications || []) as ('VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER')[];
        session.user.accountStatus = token.accountStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
        session.user.memberships = token.memberships as Array<{
          organizationId: string;
          organizationSlug: string;
          organizationName: string;
          role: 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
          accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
        }> | undefined;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const user = auth?.user as ExtendedUser | undefined;

      // Debug logging for auth issues
      if (isLoggedIn) {
        console.log('[Middleware Auth]', {
          pathname,
          userId: user?.id,
          userEmail: user?.email,
          currentOrgId: user?.currentOrganizationId,
          accountStatus: user?.accountStatus,
          hasMemberships: !!user?.memberships?.length,
        });
      }

      // Public routes that don't require authentication
      const publicRoutes = [
        '/',
        '/login',
        '/about',
        '/privacy',
        '/terms',
        '/forgot-password',
        '/reset-password',
        '/signup',
        '/set-password',
        '/pending',
        '/request-access',  // NEW: Page for users without org membership
      ];

      // Check if current path starts with any public route
      const isPublicRoute = publicRoutes.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
      );

      // API routes that should be public
      const isPublicApi = pathname.startsWith('/api/public/') ||
                          pathname.startsWith('/api/auth/');

      if (isPublicRoute || isPublicApi) {
        // If logged in with PENDING/REJECTED status and trying to access login/signup,
        // redirect to pending page
        if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
          const accountStatus = user?.accountStatus;
          if (accountStatus === 'PENDING' || accountStatus === 'REJECTED') {
            return Response.redirect(new URL('/pending', nextUrl));
          }
        }
        return true;
      }

      // Protected routes require authentication
      if (!isLoggedIn) {
        return false; // Redirect to login
      }

      // Check if user has memberships but no current org context
      // This means they're accessing a subdomain they're not a member of
      const hasMemberships = user?.memberships && user.memberships.length > 0;
      const hasCurrentOrg = !!user?.currentOrganizationId;

      if (hasMemberships && !hasCurrentOrg) {
        // User is logged in, has memberships in other orgs, but not this one
        // Redirect to request-access page
        if (pathname !== '/request-access') {
          return Response.redirect(new URL('/request-access', nextUrl));
        }
        return true;
      }

      // Check account status for logged-in users accessing protected routes
      // This uses the per-org accountStatus from the membership
      const accountStatus = user?.accountStatus;
      if (accountStatus === 'PENDING' || accountStatus === 'REJECTED') {
        // Redirect PENDING/REJECTED users to /pending page
        return Response.redirect(new URL('/pending', nextUrl));
      }

      return true;
    },
  },
};
