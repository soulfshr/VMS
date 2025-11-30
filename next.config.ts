import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude react-big-calendar from server-side bundling
  serverExternalPackages: ['react-big-calendar'],

  // Experimental settings
  experimental: {
    optimizePackageImports: ['date-fns'],
  },
};

export default nextConfig;
