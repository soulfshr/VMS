import { Suspense } from 'react';
import CoverageClient from './CoverageClient';

export const metadata = {
  title: 'Coverage Schedule | RippleVMS',
  description: 'Sign up for coverage slots',
};

export default function CoveragePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        </div>
      }
    >
      <CoverageClient />
    </Suspense>
  );
}
