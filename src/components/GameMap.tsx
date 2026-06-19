import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ScavengerItem } from "../types";
import { MapPin, Navigation, Compass, AlertCircle, Crosshair, HelpCircle, Star, Sparkles } from "lucide-react";

const ADMIN_CACHE_LAYERS = ["original", "imagery", "labels"] as const;
const TRANSPARENT_TILE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+H9kAAAAASUVORK5CYII=";

interface GameMapProps {
  items: ScavengerItem[];
  userLat: number | null;
  userLng: number | null;
  isAdmin?: boolean;
  mapMode: "original" | "satellite_labels" | "missions_only";
  selectedItemId?: string | null;
  onSelectChallenge?: (itemId: string) => void;
  onSimulateCoordinates?: (lat: number, lng: number) => void;
  onRevertToDeviceGPS?: () => void;
  onCreateMissionFromMap?: (lat: number, lng: number) => void;
}

export function GameMap({
  items,
  userLat,
  userLng,
  isAdmin = false,
  mapMode,
  selectedItemId,
  onSelectChallenge,
  onSimulateCoordinates,
  onRevertToDeviceGPS,
  onCreateMissionFromMap
}: GameMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const circlesGroupRef = useRef<any>(null);
  const markerByItemIdRef = useRef<Map<string, any>>(new Map());
  const baseTileLayerRef = useRef<any>(null);
  const labelsTileLayerRef = useRef<any>(null);
  const adminPrefetchedTilesRef = useRef<Set<string>>(new Set());
  const adminPrefetchFrameRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Default coordinate center (reunion site)
  const defaultLat = 38.80071;
  const defaultLng = -111.68311;

  const currentLat = userLat !== null ? userLat : defaultLat;
  const currentLng = userLng !== null ? userLng : defaultLng;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Construct map
    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLng],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: true
    });

    const originalLayer = L.tileLayer("/tiles/original/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      tileSize: 256,
      errorTileUrl: TRANSPARENT_TILE_DATA_URL
    });
    const imageryLayer = L.tileLayer("/tiles/imagery/{z}/{x}/{y}.png", {
      attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
      maxZoom: 17,
      tileSize: 256,
      errorTileUrl: TRANSPARENT_TILE_DATA_URL
    });
    const labelsLayer = L.tileLayer("/tiles/labels/{z}/{x}/{y}.png", {
      attribution: 'Labels &copy; <a href="https://www.esri.com">Esri</a>',
      maxZoom: 17,
      tileSize: 256,
      opacity: 1,
      pane: "overlayPane",
      errorTileUrl: TRANSPARENT_TILE_DATA_URL
    });

    if (mapMode === "satellite_labels") {
      imageryLayer.addTo(map);
      labelsLayer.addTo(map);
      baseTileLayerRef.current = imageryLayer;
      labelsTileLayerRef.current = labelsLayer;
    } else if (mapMode === "original") {
      originalLayer.addTo(map);
      baseTileLayerRef.current = originalLayer;
      labelsTileLayerRef.current = null;
    } else {
      baseTileLayerRef.current = null;
      labelsTileLayerRef.current = null;
    }

    // Create layers for item pins and visual radius circles
    markersGroupRef.current = L.layerGroup().addTo(map);
    circlesGroupRef.current = L.layerGroup().addTo(map);

    // Create a blue animated visual pulsing icon for User's Location
    const pulsarHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute h-8 w-8 bg-amber-500 rounded-full animate-ping opacity-45"></div>
        <div class="h-4 w-4 bg-amber-700 border-2 border-white rounded-full shadow-md flex items-center justify-center">
          <div class="h-1.5 w-1.5 bg-white rounded-full"></div>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: pulsarHtml,
      className: "custom-user-pulsar",
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    userMarkerRef.current = L.marker([currentLat, currentLng], { icon: userIcon }).addTo(map);

    userMarkerRef.current.bindPopup(`
      <div class="font-sans text-xs p-1">
        <p class="font-bold text-amber-800 flex items-center gap-1">
          <span class="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          Your Active Location
        </p>
        <p class="text-[10px] text-gray-500 font-mono mt-0.5">Lat: ${currentLat.toFixed(5)}<br>Lng: ${currentLng.toFixed(5)}</p>
        <p class="text-[10px] text-amber-700 italic font-semibold mt-1">💡 Click anywhere on map to simulate moving your GPS location here!</p>
      </div>
    `);

    // Bind Map click to Geolocation emulator coordinates
    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      if (onSimulateCoordinates) {
        onSimulateCoordinates(lat, lng);
      }
    });

    // Bind Map double-click to create mission at location
    map.on("dblclick", (e: any) => {
      const { lat, lng } = e.latlng;
      if (onCreateMissionFromMap) {
        onCreateMissionFromMap(lat, lng);
      }
    });

    // Track long-tap for mobile (750ms hold)
    let touchStartTime = 0;
    let touchCoords = { lat: 0, lng: 0 };

    map.on("touchstart", (e: any) => {
      touchStartTime = Date.now();
      if (e.latlng) {
        touchCoords = e.latlng;
      }
    });

    map.on("touchend", () => {
      const touchDuration = Date.now() - touchStartTime;
      if (touchDuration > 750 && onCreateMissionFromMap) {
        onCreateMissionFromMap(touchCoords.lat, touchCoords.lng);
      }
    });

    mapRef.current = map;
    setMapLoaded(true);

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      markersGroupRef.current = null;
      circlesGroupRef.current = null;
      baseTileLayerRef.current = null;
      labelsTileLayerRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Update base map style when admin changes map mode
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (labelsTileLayerRef.current) {
      map.removeLayer(labelsTileLayerRef.current);
      labelsTileLayerRef.current = null;
    }

    if (mapMode === "satellite_labels") {
      const imageryLayer = L.tileLayer("/tiles/imagery/{z}/{x}/{y}.png", {
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
        maxZoom: 17,
        tileSize: 256,
        errorTileUrl: TRANSPARENT_TILE_DATA_URL
      });
      const labelsLayer = L.tileLayer("/tiles/labels/{z}/{x}/{y}.png", {
        attribution: 'Labels &copy; <a href="https://www.esri.com">Esri</a>',
        maxZoom: 17,
        tileSize: 256,
        opacity: 1,
        pane: "overlayPane",
        errorTileUrl: TRANSPARENT_TILE_DATA_URL
      });
      imageryLayer.addTo(map);
      labelsLayer.addTo(map);
      baseTileLayerRef.current = imageryLayer;
      labelsTileLayerRef.current = labelsLayer;
    } else if (mapMode === "original") {
      const originalLayer = L.tileLayer("/tiles/original/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
        tileSize: 256,
        errorTileUrl: TRANSPARENT_TILE_DATA_URL
      });
      originalLayer.addTo(map);
      baseTileLayerRef.current = originalLayer;
    } else {
      baseTileLayerRef.current = null;
      labelsTileLayerRef.current = null;
    }
  }, [mapMode, mapLoaded]);

  // Update User position markers in real-time on movement
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !userMarkerRef.current) return;

    userMarkerRef.current.setLatLng([currentLat, currentLng]);
    userMarkerRef.current.getPopup().setContent(`
      <div class="font-sans text-xs p-1">
        <p class="font-bold text-amber-800 flex items-center gap-1">
          <span class="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          Your Target Coordinates
        </p>
        <p class="text-[10px] text-gray-500 font-mono mt-0.5">Lat: ${currentLat.toFixed(5)}<br>Lng: ${currentLng.toFixed(5)}</p>
        <p class="text-[10px] text-amber-700 italic font-semibold mt-1">💡 Click anywhere on map to simulate moving your GPS location here!</p>
      </div>
    `);
  }, [currentLat, currentLng, mapLoaded]);

  // Admin-only background prefetch so both map styles are cached for visited areas.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !isAdmin) return;
    if (mapMode !== "original" && mapMode !== "satellite_labels") return;

    const map = mapRef.current;

    const schedulePrefetch = () => {
      if (adminPrefetchFrameRef.current !== null) {
        cancelAnimationFrame(adminPrefetchFrameRef.current);
      }

      adminPrefetchFrameRef.current = requestAnimationFrame(() => {
        adminPrefetchFrameRef.current = null;

        const zoom = map.getZoom();
        if (typeof zoom !== "number" || zoom < 0 || zoom > 22) return;

        const bounds = map.getBounds();
        const northWest = bounds.getNorthWest();
        const southEast = bounds.getSouthEast();

        const northWestPoint = L.CRS.EPSG3857.latLngToPoint(northWest, zoom);
        const southEastPoint = L.CRS.EPSG3857.latLngToPoint(southEast, zoom);

        const minTileX = Math.floor(northWestPoint.x / 256);
        const maxTileX = Math.floor(southEastPoint.x / 256);
        const minTileY = Math.floor(northWestPoint.y / 256);
        const maxTileY = Math.floor(southEastPoint.y / 256);

        const worldTileCount = Math.pow(2, zoom);

        for (let x = minTileX; x <= maxTileX; x++) {
          for (let y = minTileY; y <= maxTileY; y++) {
            if (y < 0 || y >= worldTileCount) continue;
            const wrappedX = ((x % worldTileCount) + worldTileCount) % worldTileCount;

            for (const layer of ADMIN_CACHE_LAYERS) {
              const key = `${layer}/${zoom}/${wrappedX}/${y}`;
              if (adminPrefetchedTilesRef.current.has(key)) continue;
              adminPrefetchedTilesRef.current.add(key);

              const tileUrl = `/tiles/${layer}/${zoom}/${wrappedX}/${y}.png`;
              void fetch(tileUrl, { cache: "no-store" }).catch(() => {
                // Keep navigation smooth even if upstream tile fetch fails.
              });
            }
          }
        }
      });
    };

    map.on("moveend", schedulePrefetch);
    map.on("zoomend", schedulePrefetch);
    schedulePrefetch();

    return () => {
      map.off("moveend", schedulePrefetch);
      map.off("zoomend", schedulePrefetch);
      if (adminPrefetchFrameRef.current !== null) {
        cancelAnimationFrame(adminPrefetchFrameRef.current);
        adminPrefetchFrameRef.current = null;
      }
    };
  }, [isAdmin, mapLoaded, mapMode]);

  // Render Challenge pins and geofence circles in real-time
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !markersGroupRef.current || !circlesGroupRef.current) return;

    // Clear old layers
    markersGroupRef.current.clearLayers();
    circlesGroupRef.current.clearLayers();
    markerByItemIdRef.current.clear();

    // Map through only geofenced items
    items.forEach((item) => {
      if (item.lat === null || item.lng === null || item.lat === undefined || item.lng === undefined) return;

      const lat = Number(item.lat);
      const lng = Number(item.lng);
      const radius = Number(item.radius) || 100;
      const isSelected = selectedItemId === item.id;

      // Distance calculation to shade color based on user proximity
      const distance = getDistance(currentLat, currentLng, lat, lng);
      const isInside = distance <= radius;

      // Draw geofence circle overlay
      const circleColor = isSelected ? "#f97316" : isInside ? "#22c55e" : "#5a5a40";
      const circleFillColor = isSelected ? "#fdba74" : isInside ? "#4ade80" : "#dcdcd4";

      const boundaryCircle = L.circle([lat, lng], {
        radius: radius,
        color: circleColor,
        weight: isSelected ? 3 : 1.5,
        fillColor: circleFillColor,
        fillOpacity: isSelected ? 0.3 : 0.15,
        dashArray: isInside ? "none" : "4 4"
      });
      circlesGroupRef.current.addLayer(boundaryCircle);

      // Create Custom Pin Icon
      const pinHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center">
          <div class="absolute -top-10 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none z-50">
            ${item.title} (+${item.points} pts)
          </div>
          <div class="h-9 w-9 rounded-full ${isSelected ? 'bg-orange-500 border-orange-300 ring-2 ring-orange-300/80 ring-offset-2 ring-offset-white animate-pulse' : isInside ? 'bg-green-600 border-green-400' : 'bg-[#5a5a40] border-[#dcdcd4]'} border-2 flex items-center justify-center text-white shadow-lg transition-all duration-300 transform group-hover:scale-110">
            <span class="text-xs font-bold leading-none">${item.points}</span>
          </div>
          <div class="absolute -bottom-1.5 w-2 h-2 ${isSelected ? 'bg-orange-500' : isInside ? 'bg-green-600' : 'bg-[#5a5a40]'} rotate-45 border-r border-b border-transparent"></div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinHtml,
        className: "custom-mission-pin",
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      const pinMarker = L.marker([lat, lng], { icon: pinIcon });
      markerByItemIdRef.current.set(item.id, pinMarker);
      if (isSelected) {
        pinMarker.setZIndexOffset(1000);
      }
      
      // Popup body
      const popupHtml = `
        <div class="font-sans text-xs p-2 max-w-[200px] space-y-1">
          <div class="flex items-center justify-between pb-1 border-b border-gray-100">
            <span class="text-[9px] uppercase font-bold tracking-widest text-amber-700">${item.category}</span>
            <span class="font-mono font-bold text-amber-600">+${item.points} PTS</span>
          </div>
          <h4 class="font-bold text-gray-800 line-clamp-1">${item.title}</h4>
          <p class="text-gray-500 text-[10px] leading-relaxed line-clamp-3">${item.description}</p>
          <div class="pt-2 flex flex-col gap-1">
            <div class="flex items-center gap-1 text-[10px] ${isInside ? 'text-green-600 font-bold' : 'text-gray-500'}">
              <span>Distance: ${distance.toFixed(0)}m</span>
              <span>${isInside ? '(In Range! 🎉)' : `(Allowed: ${radius}m)`}</span>
            </div>
            <button 
              id="map-btn-${item.id}"
              class="w-full text-center py-1 rounded bg-[#5a5a40] text-white hover:bg-[#464632] transition font-bold text-[10px] mt-1 shadow-sm"
            >
              Details & Hunt!
            </button>
          </div>
        </div>
      `;

      pinMarker.bindPopup(popupHtml);
      
      pinMarker.on("popupopen", () => {
        const btn = document.getElementById(`map-btn-${item.id}`);
        if (btn && onSelectChallenge) {
          btn.addEventListener("click", () => {
            onSelectChallenge(item.id);
            pinMarker.closePopup();
          });
        }
      });

      markersGroupRef.current.addLayer(pinMarker);
    });

  }, [items, mapLoaded, currentLat, currentLng, selectedItemId]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !selectedItemId) return;

    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem || selectedItem.lat === null || selectedItem.lng === null) return;

    const map = mapRef.current;
    const nextZoom = Math.max(map.getZoom(), 16);
    map.flyTo([selectedItem.lat, selectedItem.lng], nextZoom, {
      animate: true,
      duration: 0.8,
    });

    const selectedMarker = markerByItemIdRef.current.get(selectedItemId);
    if (selectedMarker) {
      selectedMarker.openPopup();
    }
  }, [selectedItemId, items, mapLoaded]);

  // Helper distance function
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Pan map to active center
  const recenterMap = () => {
    if (mapRef.current) {
      mapRef.current.setView([currentLat, currentLng], 14, { animate: true });
    }
  };

  return (
    <div className="bg-white border border-brand-border rounded-[28px] overflow-hidden shadow-sm flex flex-col h-[520px]">
      <div className="bg-brand-beige-light px-5 py-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-brand-moss animate-pulse" />
          <div>
            <h3 className="text-sm font-serif font-bold italic text-brand-moss">Live Map</h3>
            <p className="text-[10px] text-brand-muted">
              {mapMode === "missions_only"
                ? "Missions + GPS only mode (no tile downloads)"
                : "Double-click to create a mission, click for coordinates"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRevertToDeviceGPS?.()}
            type="button"
            className="bg-white border border-brand-border hover:bg-brand-beige-light p-1.5 rounded-full text-brand-moss transition shadow-sm"
            title="Use device GPS location"
          >
            <Navigation className="h-4 w-4" />
          </button>
          <button
            onClick={recenterMap}
            type="button"
            className="bg-white border border-brand-border hover:bg-brand-beige-light p-1.5 rounded-full text-brand-moss transition shadow-sm"
            title="Recenter location"
          >
            <Crosshair className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map iframe mockup / Leaflet div container */}
      <div className="flex-1 relative min-h-0 bg-[#f5f5f0]">
        <div ref={mapContainerRef} className="w-full h-full z-10" />
      </div>
    </div>
  );
}
