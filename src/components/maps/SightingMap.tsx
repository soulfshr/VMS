'use client';

import dynamic from 'next/dynamic';

interface SightingMapProps {
  latitude: number;
  longitude: number;
}

const SightingMapClient = dynamic(
  () => import('./SightingMapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[200px] bg-gray-100 rounded-lg animate-pulse" />
    ),
  }
);

export default function SightingMap(props: SightingMapProps) {
  return <SightingMapClient {...props} />;
}
