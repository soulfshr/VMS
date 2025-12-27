import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude packages from server-side bundling
  serverExternalPackages: ['react-big-calendar', '@react-google-maps/api', 'driver.js'],

  // Transpile packages for compatibility
  transpilePackages: [],

  // Experimental settings
  experimental: {
    optimizePackageImports: ['date-fns'],
  },

  // Redirects for consolidated settings
  async redirects() {
    return [
      {
        source: '/profile',
        destination: '/settings/profile',
        permanent: true,
      },
      {
        source: '/coordinator/settings',
        destination: '/settings/scheduling',
        permanent: true,
      },
      {
        source: '/developer/feature-flags',
        destination: '/settings/features',
        permanent: true,
      },
      // Mapping pages consolidated to /map
      {
        source: '/coordinator/mapping',
        destination: '/map',
        permanent: true,
      },
      {
        source: '/admin/mapping',
        destination: '/map',
        permanent: true,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.s3.amazonaws.com https://*.s3.us-east-2.amazonaws.com",
              "media-src 'self' https://*.s3.amazonaws.com https://*.s3.us-east-2.amazonaws.com",
              "connect-src 'self' https://maps.googleapis.com https://*.amazonaws.com https://vercel.live",
              "frame-src 'self' https://www.google.com https://vercel.live",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
