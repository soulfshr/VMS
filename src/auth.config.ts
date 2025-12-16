import type { NextAuthConfig } from 'next-auth';

// Base auth config without database imports (for Edge runtime/middleware)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [], // Will be populated in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

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
