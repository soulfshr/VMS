import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use globals so we don't need to import describe, it, expect everywhere
    globals: true,

    // Use happy-dom for faster DOM operations (lighter than jsdom)
    environment: 'happy-dom',

    // Setup files run before each test file
    setupFiles: ['./vitest.setup.ts'],

    // Test file patterns
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'e2e', '.next', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules',
        '__tests__',
        'e2e',
        '**/*.d.ts',
        '**/*.config.*',
        '**/generated/**',
        '.next/**',
        'prisma/**',
        'public/**',
      ],
      // Minimum coverage thresholds
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },

    // Test timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter options
    reporters: ['default', 'html'],

    // Pool configuration for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Watch mode configuration
    watch: false,

    // Retry failed tests
    retry: process.env.CI ? 2 : 0,

    // Bail on first failure in CI
    bail: process.env.CI ? 1 : 0,
  },

  // Path aliases matching tsconfig
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
});
