'use client';

import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider
      // Re-fetch session every 5 minutes to keep it fresh
      refetchInterval={5 * 60}
      // Re-fetch when user returns to the tab/window
      refetchOnWindowFocus={true}
    >
      <GoogleMapsProvider>
        {children}
      </GoogleMapsProvider>
    </SessionProvider>
  );
}
