import type { NextAuthConfig } from 'next-auth';

// Base auth config without database imports (for Edge runtime/middleware)
// Multi-tenant subdomain architecture: {org-slug}.ripple-vms.com
// Cookie domain is set in auth.ts to enable cross-subdomain session sharing
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [], // Will be populated in auth.ts
  callbacks: {
    // Session callback to expose JWT data to the auth object
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.currentOrgId = (token.currentOrgId as string | null) ?? null;
        session.user.role = token.role as 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
        session.user.zone = token.zone as string | undefined;
        session.user.qualifications = (token.qualifications || []) as ('VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER')[];
        session.user.accountStatus = token.accountStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
        session.user.memberships = (token.memberships || []) as Array<{
          organizationId: string;
          organizationSlug: string;
          organizationName: string;
          role: 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
          accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
        }>;
      }
      return session;
    },
    // Simple authorized check - just verify user is logged in for protected routes
    // All org-specific logic is handled in middleware.ts
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

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
        '/select-org',
        '/join',
      ];

      // Check if current path starts with any public route
      const isPublicRoute = publicRoutes.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
      );

      // API routes that should be public
      const isPublicApi = pathname.startsWith('/api/public/') ||
                          pathname.startsWith('/api/auth/');

      if (isPublicRoute || isPublicApi) {
        return true;
      }

      // Protected routes require authentication
      // Middleware handles org selection and account status checks
      return isLoggedIn;
    },
  },
};
