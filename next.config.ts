import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Exclude react-big-calendar from server-side bundling
  serverExternalPackages: ['react-big-calendar'],

  // Experimental settings
  experimental: {
    optimizePackageImports: ['date-fns'],
  },

  // Set turbopack root to fix iCloud path issues
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
