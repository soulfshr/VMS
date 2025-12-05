'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Marker, Autocomplete, useJsApiLoader, Libraries } from '@react-google-maps/api';

interface LocationData {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface LocationPickerClientProps {
  value: LocationData;
  onChange: (location: LocationData) => void;
  placeholder?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const defaultCenter = {
  lat: 35.9940,
  lng: -78.8986,
}; // Durham, NC area

const libraries: Libraries = ['places'];

export default function LocationPickerClient({
  value,
  onChange,
  placeholder = 'Enter location (e.g., "parked in front of Wendy\'s in Methuen")',
}: LocationPickerClientProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showMap, setShowMap] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Google Maps API directly in this component
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  // Get current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get address
        if (isLoaded && window.google) {
          const geocoder = new google.maps.Geocoder();
          try {
            const response = await geocoder.geocode({
              location: { lat: latitude, lng: longitude },
            });
            if (response.results[0]) {
              onChange({
                address: response.results[0].formatted_address,
                latitude,
                longitude,
              });
              setShowMap(true);
            }
          } catch (error) {
            console.error('Geocoding error:', error);
            onChange({
              address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              latitude,
              longitude,
            });
            setShowMap(true);
          }
        } else {
          onChange({
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            latitude,
            longitude,
          });
          setShowMap(true);
        }

        if (map) {
          map.panTo({ lat: latitude, lng: longitude });
          map.setZoom(16);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location. Please enter it manually.');
      },
      { enableHighAccuracy: true }
    );
  }, [isLoaded, map, onChange]);

  // Handle autocomplete place selection
  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onChange({
          address: place.formatted_address || place.name || '',
          latitude: lat,
          longitude: lng,
        });
        setShowMap(true);
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(16);
        }
      }
    }
  }, [map, onChange]);

  // Handle map click
  const onMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Reverse geocode
        if (window.google) {
          const geocoder = new google.maps.Geocoder();
          try {
            const response = await geocoder.geocode({
              location: { lat, lng },
            });
            if (response.results[0]) {
              onChange({
                address: response.results[0].formatted_address,
                latitude: lat,
                longitude: lng,
              });
            }
          } catch (error) {
            console.error('Geocoding error:', error);
            onChange({
              address: value.address,
              latitude: lat,
              longitude: lng,
            });
          }
        }
      }
    },
    [onChange, value.address]
  );

  // Handle text input change (free text entry)
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...value,
        address: e.target.value,
      });
    },
    [onChange, value]
  );

  // Center map when coordinates change
  useEffect(() => {
    if (map && value.latitude && value.longitude) {
      map.panTo({ lat: value.latitude, lng: value.longitude });
    }
  }, [map, value.latitude, value.longitude]);

  if (loadError) {
    // Fallback to simple text input if Google Maps fails to load
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={value.address}
          onChange={handleAddressChange}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500">
          Map unavailable. Please describe the location as specifically as possible.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <div className="w-full h-12 bg-gray-100 rounded-lg animate-pulse" />
        <div className="w-full h-[300px] bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Address input with autocomplete */}
      <div className="relative">
        <Autocomplete
          onLoad={(autocomplete) => {
            autocompleteRef.current = autocomplete;
          }}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: 'us' },
            types: ['geocode', 'establishment'],
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={value.address}
            onChange={handleAddressChange}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
          />
        </Autocomplete>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={getCurrentLocation}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Use my location
        </button>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {showMap ? 'Hide map' : 'Show map'}
        </button>
      </div>

      {/* Map */}
      {showMap && (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={
              value.latitude && value.longitude
                ? { lat: value.latitude, lng: value.longitude }
                : defaultCenter
            }
            zoom={value.latitude ? 16 : 10}
            onClick={onMapClick}
            onLoad={(map) => setMap(map)}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {value.latitude && value.longitude && (
              <Marker
                position={{ lat: value.latitude, lng: value.longitude }}
                draggable
                onDragEnd={(e) => {
                  if (e.latLng) {
                    onMapClick(e as google.maps.MapMouseEvent);
                  }
                }}
              />
            )}
          </GoogleMap>
          <p className="text-xs text-gray-500 p-2 bg-gray-50">
            Click on the map to set location, or drag the marker to adjust
          </p>
        </div>
      )}

      {/* Coordinates display */}
      {value.latitude && value.longitude && (
        <p className="text-xs text-gray-500">
          Coordinates: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}
