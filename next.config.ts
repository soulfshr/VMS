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
};

export default nextConfig;
