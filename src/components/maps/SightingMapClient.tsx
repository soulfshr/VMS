'use client';

import { GoogleMap, Marker } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';

interface SightingMapClientProps {
  latitude: number;
  longitude: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '200px',
};

export default function SightingMapClient({ latitude, longitude }: SightingMapClientProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  if (loadError) {
    return (
      <div className="w-full h-[200px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm">
        Map unavailable
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[200px] bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={{ lat: latitude, lng: longitude }}
      zoom={15}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative',
      }}
    >
      <Marker position={{ lat: latitude, lng: longitude }} />
    </GoogleMap>
  );
}
