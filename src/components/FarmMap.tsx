import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, LocateFixed, Navigation, PenTool, Radio, RotateCcw, Trash2 } from 'lucide-react';
import type { GeoJsonPolygon, GibsLayerSpec } from '../types';

export function calculatePolygonArea(vertices: Array<[number, number]>): { hectares: number; acres: number } {
  if (vertices.length < 3) return { hectares: 0, acres: 0 };
  const ring = [...vertices, vertices[0]];
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lat1, lon1] = ring[i];
    const [lat2, lon2] = ring[i + 1];
    const p1 = (lon1 * Math.PI) / 180;
    const p2 = (lon2 * Math.PI) / 180;
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    total += (p2 - p1) * (2 + Math.sin(f1) + Math.sin(f2));
  }
  const areaSqM = Math.abs((total * R * R) / 2);
  const hectares = Number((areaSqM / 10_000).toFixed(2));
  const acres = Number((hectares * 2.47105).toFixed(2));
  return { hectares, acres };
}

export function verticesToGeoJson(vertices: Array<[number, number]>): GeoJsonPolygon | null {
  if (vertices.length < 3) return null;
  const ring = vertices.map(([lat, lon]) => [Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
  ring.push([...ring[0]]);
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

export function geoJsonToVertices(poly: GeoJsonPolygon | null): Array<[number, number]> {
  if (!poly?.coordinates?.[0] || poly.coordinates[0].length < 4) return [];
  const ring = poly.coordinates[0];
  return ring.slice(0, -1).map(([lon, lat]) => [lat, lon]);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DEFAULT_LANDSAT_WELD_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg';

const BLUE_MARBLE_FALLBACK_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';

interface FarmMapProps {
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number | null;
  boundary?: GeoJsonPolygon | null;
  gibsLayers?: GibsLayerSpec[];
  editablePoint?: boolean;
  editableBoundary?: boolean;
  showLayerPicker?: boolean;
  enableLiveTracking?: boolean;
  heightClass?: string;
  onPointChange?: (lat: number, lon: number) => void;
  onBoundaryChange?: (poly: GeoJsonPolygon | null, area: { hectares: number; acres: number }) => void;
}

export const FarmMap: React.FC<FarmMapProps> = ({
  latitude,
  longitude,
  gpsAccuracyM = null,
  boundary = null,
  gibsLayers = [],
  editablePoint = false,
  editableBoundary = false,
  showLayerPicker = false,
  enableLiveTracking = true,
  heightClass = 'h-72',
  onPointChange,
  onBoundaryChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointMarkerRef = useRef<L.CircleMarker | L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);
  const liveCircleRef = useRef<L.Circle | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const overlayTileRef = useRef<L.TileLayer | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [drawMode, setDrawMode] = useState<'pin' | 'boundary'>(editableBoundary ? 'boundary' : 'pin');
  const [vertices, setVertices] = useState<Array<[number, number]>>(() => geoJsonToVertices(boundary));
  const [selectedLayerId, setSelectedLayerId] = useState<string>(
    () => gibsLayers[0]?.id ?? 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual'
  );
  const [trackingActive, setTrackingActive] = useState(false);
  const [livePos, setLivePos] = useState<{ lat: number; lon: number; accuracy: number; timestamp: number } | null>(null);
  const [liveTrackError, setLiveTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (gibsLayers.length > 0 && !gibsLayers.some((l) => l.id === selectedLayerId)) {
      setSelectedLayerId(gibsLayers[0].id);
    }
  }, [gibsLayers, selectedLayerId]);

  const activeLayer = useMemo(
    () => gibsLayers.find((l) => l.id === selectedLayerId) ?? gibsLayers[0] ?? null,
    [gibsLayers, selectedLayerId]
  );

  // Sync incoming boundary prop changes
  useEffect(() => {
    setVertices(geoJsonToVertices(boundary));
  }, [boundary]);

  // Initialize Leaflet map with guaranteed HTTP-200 NASA BlueMarble underlay + 30m Landsat WELD + 15m Reference Features
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [latitude, longitude],
      zoom: boundary ? 14 : 12,
      minZoom: 2,
      maxZoom: 18,
      attributionControl: true,
    });

    // Always-available Blue Marble NextGen base ensures zero blank voids at any zoom or date
    L.tileLayer(BLUE_MARBLE_FALLBACK_URL, {
      maxNativeZoom: 8,
      maxZoom: 18,
      zIndex: 0,
      attribution: 'NASA GIBS Blue Marble',
    }).addTo(map);

    const initialBaseUrl =
      (activeLayer?.format === 'jpg' ? activeLayer.urlTemplate : null) ??
      gibsLayers.find((l) => l.format === 'jpg')?.urlTemplate ??
      DEFAULT_LANDSAT_WELD_URL;

    const initialMaxNative =
      (activeLayer?.format === 'jpg' ? activeLayer.maxNativeZoom : null) ??
      gibsLayers.find((l) => l.format === 'jpg')?.maxNativeZoom ??
      12;

    const satLayer = L.tileLayer(initialBaseUrl, {
      maxNativeZoom: initialMaxNative,
      maxZoom: 18,
      zIndex: 1,
      attribution: activeLayer?.attribution ?? 'NASA GIBS Landsat WELD 30m',
    }).addTo(map);
    baseTileRef.current = satLayer;

    // NASA GIBS Reference Features & Labels (15m resolution, Level 13)
    L.tileLayer(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Reference_Features_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png',
      { maxNativeZoom: 13, maxZoom: 18, opacity: 0.72, zIndex: 3 }
    ).addTo(map);

    L.tileLayer(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Reference_Labels_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png',
      { maxNativeZoom: 13, maxZoom: 18, opacity: 0.9, zIndex: 4 }
    ).addTo(map);

    mapRef.current = map;

    // Invalidate size after paint & whenever container resizes (fixes blank maps inside modals / animated steps)
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const timer = window.setTimeout(() => map.invalidateSize(), 180);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GIBS base/overlay tiles when selectedLayerId or verified layers load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeLayer) return;

    if (overlayTileRef.current) {
      map.removeLayer(overlayTileRef.current);
      overlayTileRef.current = null;
    }

    if (activeLayer.format === 'jpg' && baseTileRef.current) {
      baseTileRef.current.options.maxNativeZoom = activeLayer.maxNativeZoom;
      baseTileRef.current.setUrl(activeLayer.urlTemplate);
      baseTileRef.current.redraw();
    } else if (activeLayer.format === 'png') {
      overlayTileRef.current = L.tileLayer(activeLayer.urlTemplate, {
        maxNativeZoom: activeLayer.maxNativeZoom,
        maxZoom: 18,
        opacity: 0.76,
        zIndex: 2,
        attribution: activeLayer.attribution,
      }).addTo(map);
    }
  }, [activeLayer]);

  // Keep map centered & render farm centroid pin + accuracy circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setView([latitude, longitude], map.getZoom(), { animate: true });

    if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }
    if (gpsAccuracyM && gpsAccuracyM > 0) {
      accuracyCircleRef.current = L.circle([latitude, longitude], {
        radius: gpsAccuracyM,
        color: '#E3A72F',
        fillColor: '#E3A72F',
        fillOpacity: 0.14,
        weight: 1.5,
        dashArray: '4 4',
      }).addTo(map);
    }

    if (pointMarkerRef.current) {
      map.removeLayer(pointMarkerRef.current);
      pointMarkerRef.current = null;
    }

    const icon = L.divIcon({
      className: 'farmova-pin-icon',
      html: `<div style="width:20px;height:20px;border-radius:9999px;background:#E3A72F;border:3px solid #1F5A2E;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker([latitude, longitude], {
      icon,
      draggable: editablePoint && drawMode === 'pin',
    }).addTo(map);

    if (editablePoint && drawMode === 'pin') {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onPointChange?.(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      });
    }
    pointMarkerRef.current = marker;
  }, [latitude, longitude, gpsAccuracyM, editablePoint, drawMode, onPointChange]);

  // Render live GPS precision tracking marker & accuracy halo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (liveMarkerRef.current) {
      map.removeLayer(liveMarkerRef.current);
      liveMarkerRef.current = null;
    }
    if (liveCircleRef.current) {
      map.removeLayer(liveCircleRef.current);
      liveCircleRef.current = null;
    }

    if (!trackingActive || !livePos) return;

    liveCircleRef.current = L.circle([livePos.lat, livePos.lon], {
      radius: Math.max(4, livePos.accuracy),
      color: '#0284C7',
      fillColor: '#0284C7',
      fillOpacity: 0.15,
      weight: 1.5,
    }).addTo(map);

    const liveIcon = L.divIcon({
      className: 'farmova-live-gps-icon',
      html: `<div style="width:16px;height:16px;border-radius:9999px;background:#0284C7;border:3px solid #FFFFFF;box-shadow:0 0 0 4px rgba(2,132,199,0.3);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    liveMarkerRef.current = L.marker([livePos.lat, livePos.lon], { icon: liveIcon }).addTo(map);
  }, [trackingActive, livePos]);

  // Manage navigator.geolocation.watchPosition lifecycle
  useEffect(() => {
    if (!trackingActive) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setLiveTrackError('Live GPS tracking is unavailable in this browser.');
      setTrackingActive(false);
      return;
    }

    setLiveTrackError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp,
        };
        setLivePos(next);
        mapRef.current?.panTo([next.lat, next.lon], { animate: true });
      },
      (err) => {
        setLiveTrackError(
          err.code === 1
            ? 'GPS permission denied. Allow browser location to track live field position.'
            : 'Unable to acquire high-accuracy GPS fix right now.'
        );
        setTrackingActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    );

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [trackingActive]);

  // Render polygon & draggable vertices
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    for (const m of vertexMarkersRef.current) {
      map.removeLayer(m);
    }
    vertexMarkersRef.current = [];

    if (vertices.length >= 3) {
      polygonLayerRef.current = L.polygon(vertices, {
        color: '#E3A72F',
        fillColor: '#E3A72F',
        fillOpacity: 0.24,
        weight: 2.5,
      }).addTo(map);
    } else if (vertices.length === 2) {
      polygonLayerRef.current = L.polygon(vertices, {
        color: '#E3A72F',
        weight: 2,
        dashArray: '4 4',
      }).addTo(map);
    }

    if (editableBoundary) {
      vertices.forEach(([vLat, vLon], idx) => {
        const vIcon = L.divIcon({
          className: 'farmova-vertex-icon',
          html: `<div style="width:16px;height:16px;border-radius:9999px;background:#FFFFFF;border:2.5px solid #1F5A2E;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:grab;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const vm = L.marker([vLat, vLon], { icon: vIcon, draggable: true }).addTo(map);
        vm.on('dragend', () => {
          const p = vm.getLatLng();
          const updated = vertices.map((v, i) => (i === idx ? ([Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))] as [number, number]) : v));
          setVertices(updated);
          onBoundaryChange?.(verticesToGeoJson(updated), calculatePolygonArea(updated));
        });
        vertexMarkersRef.current.push(vm);
      });
    }
  }, [vertices, editableBoundary, onBoundaryChange]);

  // Handle map tap for setting pin or adding boundary corner
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lon = Number(e.latlng.lng.toFixed(6));
      if (editableBoundary && drawMode === 'boundary') {
        const next = [...vertices, [lat, lon] as [number, number]];
        setVertices(next);
        onBoundaryChange?.(verticesToGeoJson(next), calculatePolygonArea(next));
      } else if (editablePoint) {
        onPointChange?.(lat, lon);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [editablePoint, editableBoundary, drawMode, vertices, onPointChange, onBoundaryChange]);

  const area = useMemo(() => calculatePolygonArea(vertices), [vertices]);

  const undoVertex = () => {
    const next = vertices.slice(0, -1);
    setVertices(next);
    onBoundaryChange?.(verticesToGeoJson(next), calculatePolygonArea(next));
  };

  const clearBoundary = () => {
    setVertices([]);
    onBoundaryChange?.(null, { hectares: 0, acres: 0 });
  };

  const addLiveCorner = () => {
    if (!livePos) return;
    const next = [...vertices, [livePos.lat, livePos.lon] as [number, number]];
    setVertices(next);
    onBoundaryChange?.(verticesToGeoJson(next), calculatePolygonArea(next));
  };

  const liveDistanceM = livePos ? Math.round(haversineMeters(livePos.lat, livePos.lon, latitude, longitude)) : null;

  return (
    <div className="space-y-2.5">
      {(editableBoundary || showLayerPicker || enableLiveTracking) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {enableLiveTracking && (
              <button
                type="button"
                onClick={() => setTrackingActive((v) => !v)}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  trackingActive
                    ? 'bg-sky-700 text-white'
                    : 'bg-white border border-black/15 text-[#1A1A1A] hover:bg-black/5'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${trackingActive ? 'animate-pulse' : 'text-sky-700'}`} />
                <span>{trackingActive ? 'Live GPS Tracking On' : 'Track Live GPS'}</span>
              </button>
            )}

            {trackingActive && livePos && editableBoundary && (
              <button
                type="button"
                onClick={addLiveCorner}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E3A72F] text-[#1A1A1A] hover:bg-[#d69a24] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Mark Corner at GPS</span>
              </button>
            )}

            {editableBoundary && (
              <>
                {editablePoint && (
                  <button
                    type="button"
                    onClick={() => setDrawMode('pin')}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      drawMode === 'pin'
                        ? 'bg-[#1F5A2E] text-white'
                        : 'bg-white border border-black/15 text-[#1A1A1A] hover:bg-black/5'
                    }`}
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Move Pin</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawMode('boundary')}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    drawMode === 'boundary'
                      ? 'bg-[#1F5A2E] text-white'
                      : 'bg-white border border-black/15 text-[#1A1A1A] hover:bg-black/5'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Tap Corners ({vertices.length})</span>
                </button>
                {vertices.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={undoVertex}
                      className="inline-flex items-center gap-1 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-black/15 text-[#1A1A1A] hover:bg-black/5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearBoundary}
                      className="inline-flex items-center gap-1 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-black/15 text-[#A2461F] hover:bg-[#A2461F]/5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {showLayerPicker && gibsLayers.length > 0 && (
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1F5A2E] shrink-0" />
              <select
                value={selectedLayerId}
                onChange={(e) => setSelectedLayerId(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-black/15 bg-white text-xs font-medium text-[#1A1A1A]"
                aria-label="Select NASA GIBS Satellite Layer"
              >
                {gibsLayers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-black/10 bg-[#1a241d]`}>
        <div ref={containerRef} className="w-full h-full z-0" />
      </div>

      {liveTrackError && (
        <div className="text-xs text-[#A2461F] font-medium">{liveTrackError}</div>
      )}

      {trackingActive && livePos && (
        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-950 font-mono-tabular">
          <span>
            Live GPS Fix: {livePos.lat.toFixed(5)}°, {livePos.lon.toFixed(5)}° (±{livePos.accuracy} m)
          </span>
          {liveDistanceM !== null && (
            <span className="font-semibold">
              Distance to plot pin: {liveDistanceM < 1000 ? `${liveDistanceM} m` : `${(liveDistanceM / 1000).toFixed(2)} km`}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/65">
        <span>
          Imagery: NASA GIBS ({activeLayer?.title ?? 'Landsat WELD 30m Precision'} · {activeLayer?.defaultDate ?? 'Verified'})
          {vertices.length >= 3 && (
            <>
              {' · '}
              <strong className="text-[#1F5A2E]">
                Boundary: {area.acres} acres ({area.hectares} ha)
              </strong>
            </>
          )}
        </span>
        <span className="font-mono-tabular">
          {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
          {gpsAccuracyM ? ` · ±${Math.round(gpsAccuracyM)}m GPS` : ''}
        </span>
      </div>

      {activeLayer?.legendUrl && showLayerPicker && (
        <div className="p-2.5 rounded-xl bg-white border border-black/10 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-black/70">NASA GIBS Color Legend:</span>
          <img
            src={activeLayer.legendUrl}
            alt={`${activeLayer.title} legend`}
            className="h-12 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};
