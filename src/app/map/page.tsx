'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CoverageMap from '@/components/maps/CoverageMap';

export default function MapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coverage Map</h1>
        <p className="text-gray-600 mt-1">
          View zone boundaries and points of interest across our coverage area
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <CoverageMap height="calc(100vh - 280px)" isAuthenticated={true} />
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Map Legend</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Zone Boundaries:</strong> Colored polygons show coverage areas for each zone</p>
          <p><strong>Points of Interest:</strong> Markers show important locations (toggle categories in the map legend)</p>
        </div>
      </div>
    </div>
  );
}
