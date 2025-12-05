'use client';

import dynamic from 'next/dynamic';

interface LocationData {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface LocationPickerProps {
  value: LocationData;
  onChange: (location: LocationData) => void;
  placeholder?: string;
}

const LocationPickerClient = dynamic(
  () => import('./LocationPickerClient'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2">
        <div className="w-full h-12 bg-gray-100 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    ),
  }
);

export default function LocationPicker(props: LocationPickerProps) {
  return <LocationPickerClient {...props} />;
}
