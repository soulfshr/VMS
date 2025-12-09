'use client';

import { useState, useCallback } from 'react';
import { Marker, InfoWindow } from '@react-google-maps/api';

export interface POICategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  count: number;
}

export interface POI {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
    color: string;
    icon: string | null;
  };
  zone: {
    id: string;
    name: string;
  } | null;
}

interface POIMapLayerProps {
  pois: POI[];
  visibleCategories: Set<string>;
}

// Create a colored SVG marker path
function getMarkerIcon(color: string): google.maps.Symbol {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
    anchor: new google.maps.Point(12, 22),
  };
}

export default function POIMapLayer({ pois, visibleCategories }: POIMapLayerProps) {
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  const handleMarkerClick = useCallback((poi: POI) => {
    setSelectedPOI(poi);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedPOI(null);
  }, []);

  // Filter POIs by visible categories
  const visiblePOIs = pois.filter(poi => visibleCategories.has(poi.category.id));

  return (
    <>
      {visiblePOIs.map(poi => (
        <Marker
          key={poi.id}
          position={{ lat: poi.latitude, lng: poi.longitude }}
          icon={getMarkerIcon(poi.category.color)}
          onClick={() => handleMarkerClick(poi)}
          title={poi.name}
        />
      ))}

      {selectedPOI && (
        <InfoWindow
          position={{ lat: selectedPOI.latitude, lng: selectedPOI.longitude }}
          onCloseClick={handleInfoWindowClose}
          options={{
            pixelOffset: new google.maps.Size(0, -30),
          }}
        >
          <div className="p-2 max-w-[250px]">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedPOI.category.color }}
              />
              <span className="text-xs font-medium text-gray-500">
                {selectedPOI.category.name}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">{selectedPOI.name}</h3>
            {selectedPOI.address && (
              <p className="text-sm text-gray-600 mt-1">{selectedPOI.address}</p>
            )}
            {selectedPOI.description && (
              <p className="text-xs text-gray-500 mt-1">{selectedPOI.description}</p>
            )}
            {selectedPOI.zone && (
              <p className="text-xs text-gray-400 mt-1">Zone: {selectedPOI.zone.name}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedPOI.phone && (
                <a
                  href={`tel:${selectedPOI.phone}`}
                  className="text-xs text-cyan-600 hover:text-cyan-700"
                >
                  {selectedPOI.phone}
                </a>
              )}
              {selectedPOI.website && (
                <a
                  href={selectedPOI.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-600 hover:text-cyan-700"
                >
                  Website
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// POI Legend component for category toggles
interface POILegendProps {
  categories: POICategory[];
  visibleCategories: Set<string>;
  onToggleCategory: (categoryId: string) => void;
}

export function POILegend({ categories, visibleCategories, onToggleCategory }: POILegendProps) {
  if (categories.length === 0) return null;

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Points of Interest</h4>
      <div className="flex flex-wrap gap-2">
        {categories.map(category => {
          const isVisible = visibleCategories.has(category.id);
          return (
            <button
              key={category.id}
              onClick={() => onToggleCategory(category.id)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                isVisible
                  ? 'bg-gray-100 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full ${!isVisible && 'opacity-40'}`}
                style={{ backgroundColor: category.color }}
              />
              {category.name}
              <span className="text-gray-400">({category.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
