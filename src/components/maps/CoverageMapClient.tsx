'use client';

import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Polygon, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import POIMapLayer, { POILegend, type POI, type POICategory } from './POIMapLayer';

interface ZoneBoundary {
  lat: number;
  lng: number;
}

interface Zone {
  id: string;
  name: string;
  county: string | null;
  description: string | null;
  boundaries: ZoneBoundary[] | null;
  color: string;
  fillOpacity: number;
  strokeWeight: number;
}

interface CoverageMapClientProps {
  height?: string;
  isAuthenticated?: boolean;
}

const mapContainerStyle = {
  width: '100%',
};

const defaultCenter = {
  lat: 35.9940,
  lng: -78.8986,
}; // Durham, NC area

// County colors for zones without custom colors
const countyColors: Record<string, string> = {
  'Durham': '#3b82f6',  // Blue
  'Orange': '#f97316',  // Orange
  'Wake': '#22c55e',    // Green
};

export default function CoverageMapClient({ height = '480px', isAuthenticated = false }: CoverageMapClientProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [infoWindowPosition, setInfoWindowPosition] = useState<google.maps.LatLng | null>(null);

  // POI state (only used when authenticated)
  const [pois, setPois] = useState<POI[]>([]);
  const [poiCategories, setPoiCategories] = useState<POICategory[]>([]);
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set());

  const { isLoaded, loadError } = useGoogleMaps();

  useEffect(() => {
    fetchZones();
  }, []);

  // Fetch POIs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchPOIs();
    }
  }, [isAuthenticated]);

  const fetchZones = async () => {
    try {
      const response = await fetch('/api/zones/public');
      if (response.ok) {
        const data = await response.json();
        setZones(data);
      }
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPOIs = async () => {
    try {
      const response = await fetch('/api/pois');
      if (response.ok) {
        const data = await response.json();
        setPois(data.pois || []);
        setPoiCategories(data.categories || []);
        // Initialize all categories as visible
        const categoryIds = (data.categories || []).map((c: POICategory) => c.id);
        setVisibleCategories(new Set(categoryIds));
      }
    } catch (error) {
      console.error('Error fetching POIs:', error);
    }
  };

  const handleToggleCategory = useCallback((categoryId: string) => {
    setVisibleCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const getZoneCenter = useCallback((boundaries: ZoneBoundary[]): google.maps.LatLngLiteral => {
    const lat = boundaries.reduce((sum, b) => sum + b.lat, 0) / boundaries.length;
    const lng = boundaries.reduce((sum, b) => sum + b.lng, 0) / boundaries.length;
    return { lat, lng };
  }, []);

  const handlePolygonClick = useCallback((zone: Zone, event: google.maps.MapMouseEvent) => {
    if (zone.boundaries && zone.boundaries.length > 0) {
      setSelectedZone(zone);
      setInfoWindowPosition(event.latLng);
    }
  }, []);

  if (loadError) {
    return (
      <div
        className="bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"
        style={{ height }}
      >
        Map unavailable
      </div>
    );
  }

  if (!isLoaded || loading) {
    return (
      <div
        className="bg-gray-100 rounded-xl animate-pulse"
        style={{ height }}
      />
    );
  }

  // Filter zones that have valid boundaries
  const zonesWithBoundaries = zones.filter(
    (z) => z.boundaries && Array.isArray(z.boundaries) && z.boundaries.length >= 3
  );

  // Group zones by county for the legend
  const zonesByCounty = zones.reduce((acc, zone) => {
    const county = zone.county || 'Other';
    if (!acc[county]) acc[county] = [];
    acc[county].push(zone);
    return acc;
  }, {} as Record<string, Zone[]>);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <GoogleMap
        mapContainerStyle={{ ...mapContainerStyle, height }}
        center={defaultCenter}
        zoom={10}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        }}
      >
        {zonesWithBoundaries.map((zone) => {
          const zoneColor = zone.color || countyColors[zone.county || ''] || '#6b7280';
          return (
            <Polygon
              key={zone.id}
              paths={zone.boundaries as ZoneBoundary[]}
              options={{
                fillColor: zoneColor,
                fillOpacity: zone.fillOpacity,
                strokeColor: zoneColor,
                strokeOpacity: 1,
                strokeWeight: zone.strokeWeight,
              }}
              onClick={(e) => handlePolygonClick(zone, e)}
            />
          );
        })}

        {selectedZone && infoWindowPosition && (
          <InfoWindow
            position={infoWindowPosition}
            onCloseClick={() => {
              setSelectedZone(null);
              setInfoWindowPosition(null);
            }}
          >
            <div className="p-2 max-w-[200px]">
              <h3 className="font-semibold text-gray-900">{selectedZone.name}</h3>
              {selectedZone.county && (
                <p className="text-sm text-gray-600">{selectedZone.county} County</p>
              )}
              {selectedZone.description && (
                <p className="text-xs text-gray-500 mt-1">{selectedZone.description}</p>
              )}
            </div>
          </InfoWindow>
        )}

        {/* POI markers for authenticated users */}
        {isAuthenticated && pois.length > 0 && (
          <POIMapLayer pois={pois} visibleCategories={visibleCategories} />
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex flex-wrap gap-6">
          {Object.entries(zonesByCounty).map(([county, countyZones]) => (
            <div key={county}>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {county} County ({countyZones.length} zones)
              </h4>
              <div className="flex flex-wrap gap-2">
                {countyZones.map((zone) => {
                  const zoneColor = zone.color || countyColors[county] || '#6b7280';
                  return (
                    <button
                      key={zone.id}
                      onClick={() => {
                        if (zone.boundaries && zone.boundaries.length > 0) {
                          const center = getZoneCenter(zone.boundaries);
                          setSelectedZone(zone);
                          setInfoWindowPosition(new google.maps.LatLng(center.lat, center.lng));
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: zoneColor }}
                      />
                      {zone.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {zonesWithBoundaries.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No zone boundaries have been configured yet.
          </p>
        )}

        {/* POI Legend for authenticated users */}
        {isAuthenticated && poiCategories.length > 0 && (
          <POILegend
            categories={poiCategories}
            visibleCategories={visibleCategories}
            onToggleCategory={handleToggleCategory}
          />
        )}
      </div>
    </div>
  );
}
