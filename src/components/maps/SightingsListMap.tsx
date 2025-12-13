'use client';

import dynamic from 'next/dynamic';

interface Sighting {
  id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  activity: string;
  observedAt: string;
  status: 'NEW' | 'REVIEWING' | 'DISPATCHED' | 'CLOSED';
  disposition?: 'CONFIRMED' | 'UNVERIFIED' | 'FALSE_ALARM' | null;
}

interface SightingsListMapProps {
  sightings: Sighting[];
}

const SightingsListMapClient = dynamic(
  () => import('./SightingsListMapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-gray-100 rounded-xl animate-pulse" />
    ),
  }
);

export default function SightingsListMap(props: SightingsListMapProps) {
  return <SightingsListMapClient {...props} />;
}
