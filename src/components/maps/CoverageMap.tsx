'use client';

import dynamic from 'next/dynamic';

interface CoverageMapProps {
  height?: string;
  isAuthenticated?: boolean;
}

const CoverageMapClient = dynamic(
  () => import('./CoverageMapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-gray-100 rounded-xl animate-pulse h-[480px]" />
    ),
  }
);

export default function CoverageMap(props: CoverageMapProps) {
  return <CoverageMapClient {...props} />;
}
