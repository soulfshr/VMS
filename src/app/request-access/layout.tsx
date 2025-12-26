'use client';

import { ReactNode } from 'react';
import { Providers } from '@/components/Providers';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Minimal layout for /request-access page.
 * Does NOT include Header to avoid:
 * 1. Fetching org-specific API data (user doesn't have access)
 * 2. Prefetching protected routes (which would be blocked)
 */
export default function RequestAccessLayout({ children }: LayoutProps) {
  return (
    <Providers>
      <main className="flex-grow">
        {children}
      </main>
    </Providers>
  );
}
