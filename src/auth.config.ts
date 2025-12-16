import type { NextAuthConfig } from 'next-auth';

// Base auth config without database imports (for Edge runtime/middleware)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [], // Will be populated in auth.ts
  callbacks: {
    // Session callback to expose JWT data to the auth object
    // This is needed for the middleware to access accountStatus
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR';
        session.user.zone = token.zone as string | undefined;
        session.user.qualifications = (token.qualifications || []) as ('VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER')[];
        session.user.accountStatus = token.accountStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Debug logging for accountStatus issue
      if (isLoggedIn) {
        console.log('[Middleware Auth]', {
          pathname,
          userId: auth?.user?.id,
          userEmail: auth?.user?.email,
          accountStatus: (auth?.user as { accountStatus?: string })?.accountStatus,
          authKeys: auth ? Object.keys(auth) : [],
          userKeys: auth?.user ? Object.keys(auth.user) : [],
        });
      }

      // Public routes that don't require authentication
      const publicRoutes = [
        '/',
        '/login',
        '/about',
        '/forgot-password',
        '/reset-password',
        '/signup',
        '/set-password',
        '/pending',
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
          const accountStatus = (auth?.user as { accountStatus?: string })?.accountStatus;
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

      // Check account status for logged-in users accessing protected routes
      const accountStatus = (auth?.user as { accountStatus?: string })?.accountStatus;
      if (accountStatus === 'PENDING' || accountStatus === 'REJECTED') {
        // Redirect PENDING/REJECTED users to /pending page
        return Response.redirect(new URL('/pending', nextUrl));
      }

      return true;
    },
  },
};
