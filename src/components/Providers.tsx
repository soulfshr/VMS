'use client';

import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <GoogleMapsProvider>
        {children}
      </GoogleMapsProvider>
    </SessionProvider>
  );
}
