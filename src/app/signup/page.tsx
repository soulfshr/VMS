'use client';

import { Suspense } from 'react';
import SignupClient from './SignupClient';

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    }>
      <SignupClient />
    </Suspense>
  );
}
