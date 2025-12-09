'use client';

import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';
import Link from 'next/link';
import { useGoogleMaps } from './GoogleMapsProvider';

interface Sighting {
  id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  activity: string;
  observedAt: string;
  status: 'NEW' | 'REVIEWING' | 'VERIFIED' | 'RESPONDED' | 'CLOSED';
}

interface SightingsListMapClientProps {
  sightings: Sighting[];
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

const defaultCenter = {
  lat: 35.9940,
  lng: -78.8986,
}; // Durham, NC area

const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800',
  REVIEWING: 'bg-yellow-100 text-yellow-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  RESPONDED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  VERIFIED: 'Verified',
  RESPONDED: 'Responded',
  CLOSED: 'Closed',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SightingsListMapClient({ sightings }: SightingsListMapClientProps) {
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  // Filter sightings that have coordinates
  const sightingsWithCoords = sightings.filter(
    (s) => s.latitude !== null && s.longitude !== null
  );

  // Calculate map center from sightings or use default
  const getMapCenter = () => {
    if (sightingsWithCoords.length === 0) return defaultCenter;
    const avgLat = sightingsWithCoords.reduce((sum, s) => sum + (s.latitude || 0), 0) / sightingsWithCoords.length;
    const avgLng = sightingsWithCoords.reduce((sum, s) => sum + (s.longitude || 0), 0) / sightingsWithCoords.length;
    return { lat: avgLat, lng: avgLng };
  };

  if (loadError) {
    return (
      <div className="w-full h-[500px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
        Map unavailable
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] bg-gray-100 rounded-xl animate-pulse" />
    );
  }

  if (sightingsWithCoords.length === 0) {
    return (
      <div className="w-full h-[500px] bg-white rounded-xl border border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500">No sightings with location data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={getMapCenter()}
        zoom={11}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {sightingsWithCoords.map((sighting) => (
          <Marker
            key={sighting.id}
            position={{ lat: sighting.latitude!, lng: sighting.longitude! }}
            onClick={() => setSelectedSighting(sighting)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: sighting.status === 'NEW' ? '#ef4444' :
                        sighting.status === 'REVIEWING' ? '#eab308' :
                        sighting.status === 'VERIFIED' ? '#3b82f6' :
                        sighting.status === 'RESPONDED' ? '#22c55e' : '#6b7280',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        ))}

        {selectedSighting && selectedSighting.latitude && selectedSighting.longitude && (
          <InfoWindow
            position={{ lat: selectedSighting.latitude, lng: selectedSighting.longitude }}
            onCloseClick={() => setSelectedSighting(null)}
          >
            <div className="p-2 max-w-[250px]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedSighting.status]}`}>
                  {statusLabels[selectedSighting.status]}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(selectedSighting.observedAt)}
                </span>
              </div>
              <p className="font-medium text-gray-900 text-sm mb-1">{selectedSighting.location}</p>
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{selectedSighting.activity}</p>
              <Link
                href={`/sightings/${selectedSighting.id}`}
                className="text-xs text-cyan-600 hover:underline font-medium"
              >
                View Details →
              </Link>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="bg-white border-t border-gray-200 p-3 flex flex-wrap gap-4 text-xs">
        <span className="font-medium text-gray-700">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span> New
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span> Reviewing
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span> Verified
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500"></span> Responded
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-500"></span> Closed
        </span>
      </div>
    </div>
  );
}
