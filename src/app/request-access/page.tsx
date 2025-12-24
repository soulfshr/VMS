'use client';

import { Suspense } from 'react';
import RequestAccessClient from './RequestAccessClient';

export default function RequestAccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    }>
      <RequestAccessClient />
    </Suspense>
  );
}
