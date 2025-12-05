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
      if (!isLoggedIn) {
        return false; // Redirect to login
      }

      return true;
    },
  },
};
