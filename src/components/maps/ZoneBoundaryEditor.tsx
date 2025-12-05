'use client';

import { GoogleMap, Polygon, DrawingManager } from '@react-google-maps/api';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';

interface Coordinate {
  lat: number;
  lng: number;
}

interface OtherZone {
  id: string;
  name: string;
  color: string;
  boundaries: Coordinate[] | null;
}

interface ZoneBoundaryEditorProps {
  boundaries: Coordinate[] | null;
  color: string;
  onBoundariesChange: (boundaries: Coordinate[] | null) => void;
  otherZones?: OtherZone[];
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

// Triangle area center
const defaultCenter = {
  lat: 35.9132,
  lng: -79.0558,
};

export default function ZoneBoundaryEditor({
  boundaries,
  color,
  onBoundariesChange,
  otherZones = [],
}: ZoneBoundaryEditorProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  // Get polygon path as array of coordinates
  const getPolygonPath = useCallback((polygon: google.maps.Polygon): Coordinate[] => {
    const path = polygon.getPath();
    const coordinates: Coordinate[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push({ lat: point.lat(), lng: point.lng() });
    }
    return coordinates;
  }, []);

  // Handle polygon complete from drawing manager
  const onPolygonComplete = useCallback(
    (polygon: google.maps.Polygon) => {
      // Remove the drawn polygon (we'll use our controlled Polygon component instead)
      const path = getPolygonPath(polygon);
      polygon.setMap(null);
      onBoundariesChange(path);
    },
    [getPolygonPath, onBoundariesChange]
  );

  // Handle polygon edits
  const onPolygonEdit = useCallback(() => {
    if (polygonRef.current) {
      const path = getPolygonPath(polygonRef.current);
      onBoundariesChange(path);
    }
  }, [getPolygonPath, onBoundariesChange]);

  // Bind polygon ref
  const onPolygonLoad = useCallback((polygon: google.maps.Polygon) => {
    polygonRef.current = polygon;
  }, []);

  // Center map on boundaries if they exist
  useEffect(() => {
    if (map && boundaries && boundaries.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      boundaries.forEach((coord) => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      map.fitBounds(bounds, 50);
    }
  }, [map, boundaries]);

  if (loadError) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        Map unavailable - please check your Google Maps API key
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-500">Loading map...</span>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={defaultCenter}
      zoom={10}
      onLoad={setMap}
      options={{
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
      }}
    >
      {/* Other zones' boundaries (read-only, for reference) */}
      {otherZones.map((zone) =>
        zone.boundaries && zone.boundaries.length > 2 ? (
          <Polygon
            key={zone.id}
            paths={zone.boundaries}
            options={{
              fillColor: zone.color,
              fillOpacity: 0.15,
              strokeColor: zone.color,
              strokeWeight: 1,
              strokeOpacity: 0.5,
              editable: false,
              draggable: false,
              clickable: false,
            }}
          />
        ) : null
      )}

      {/* Drawing Manager - only show if no boundaries yet */}
      {(!boundaries || boundaries.length === 0) && (
        <DrawingManager
          onLoad={(dm) => {
            drawingManagerRef.current = dm;
          }}
          onPolygonComplete={onPolygonComplete}
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: google.maps.ControlPosition.TOP_RIGHT,
              drawingModes: [google.maps.drawing.OverlayType.POLYGON],
            },
            polygonOptions: {
              fillColor: color,
              fillOpacity: 0.3,
              strokeColor: color,
              strokeWeight: 2,
              editable: true,
              draggable: true,
            },
          }}
        />
      )}

      {/* Existing polygon - editable */}
      {boundaries && boundaries.length > 2 && (
        <Polygon
          paths={boundaries}
          options={{
            fillColor: color,
            fillOpacity: 0.3,
            strokeColor: color,
            strokeWeight: 2,
            editable: true,
            draggable: true,
          }}
          onLoad={onPolygonLoad}
          onMouseUp={onPolygonEdit}
          onDragEnd={onPolygonEdit}
        />
      )}
    </GoogleMap>
  );
}
