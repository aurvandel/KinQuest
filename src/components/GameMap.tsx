import { useEffect, useRef, useState } from "react";
import { ScavengerItem } from "../types";
import { MapPin, Navigation, Compass, AlertCircle, Crosshair, HelpCircle, Star, Sparkles } from "lucide-react";

// Explicit declaration for window with global L (Leaflet) loaded via CDN
declare global {
  interface Window {
    L: any;
  }
}

interface GameMapProps {
  items: ScavengerItem[];
  userLat: number | null;
  userLng: number | null;
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
  const [mapLoaded, setMapLoaded] = useState(false);

  // Default coordinate center (Central Park NYC)
  const defaultLat = 40.7829;
  const defaultLng = -73.9654;

  const currentLat = userLat !== null ? userLat : defaultLat;
  const currentLng = userLng !== null ? userLng : defaultLng;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Wait until window.L is active
    if (typeof window.L === "undefined") {
      const interval = setInterval(() => {
        if (typeof window.L !== "undefined") {
          clearInterval(interval);
          initializeLeaflet();
        }
      }, 200);
      return () => clearInterval(interval);
    }

    initializeLeaflet();

    function initializeLeaflet() {
      if (!mapContainerRef.current) return;
      const L = window.L;

      // Construct map
      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // Warm earthy map theme: use CartoDB Positron which looks incredible for Natural Tones!
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);

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
    }
  }, []);

  // Update User position markers in real-time on movement
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !userMarkerRef.current) return;
    const L = window.L;

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

  // Render Challenge pins and geofence circles in real-time
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !markersGroupRef.current || !circlesGroupRef.current) return;
    const L = window.L;

    // Clear old layers
    markersGroupRef.current.clearLayers();
    circlesGroupRef.current.clearLayers();

    // Map through only geofenced items
    items.forEach((item) => {
      if (item.lat === null || item.lng === null || item.lat === undefined || item.lng === undefined) return;

      const lat = Number(item.lat);
      const lng = Number(item.lng);
      const radius = Number(item.radius) || 100;

      // Distance calculation to shade color based on user proximity
      const distance = getDistance(currentLat, currentLng, lat, lng);
      const isInside = distance <= radius;

      // Draw geofence circle overlay
      const circleColor = isInside ? "#22c55e" : "#5a5a40"; // moss tones
      const circleFillColor = isInside ? "#4ade80" : "#dcdcd4";

      const boundaryCircle = L.circle([lat, lng], {
        radius: radius,
        color: circleColor,
        weight: 1.5,
        fillColor: circleFillColor,
        fillOpacity: 0.15,
        dashArray: isInside ? "none" : "4 4"
      });
      circlesGroupRef.current.addLayer(boundaryCircle);

      // Create Custom Pin Icon
      const pinHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center">
          <div class="absolute -top-10 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none z-50">
            ${item.title} (+${item.points} pts)
          </div>
          <div class="h-9 w-9 rounded-full ${isInside ? 'bg-green-600 border-green-400' : 'bg-[#5a5a40] border-[#dcdcd4]'} border-2 flex items-center justify-center text-white shadow-lg transition-all duration-300 transform group-hover:scale-110">
            <span class="text-xs font-bold leading-none">${item.points}</span>
          </div>
          <div class="absolute -bottom-1.5 w-2 h-2 ${isInside ? 'bg-green-600' : 'bg-[#5a5a40]'} rotate-45 border-r border-b border-transparent"></div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinHtml,
        className: "custom-mission-pin",
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      const pinMarker = L.marker([lat, lng], { icon: pinIcon });
      
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

  }, [items, mapLoaded, currentLat, currentLng]);

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
            <p className="text-[10px] text-brand-muted">Double-click to create a mission, click for coordinates</p>
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

        {/* Floating Instruction overlay wrapper inside container */}
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex flex-col gap-2">
          <div className="bg-white/95 backdrop-blur-md border border-brand-border rounded-xl p-3 shadow-md max-w-sm pointer-events-auto space-y-2">
            <p className="text-xs font-bold text-brand-moss flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span> Geolocation Emulator</span>
            </p>
            <p className="text-[10.5px] text-gray-500 leading-normal">
              Click to emulate GPS movement. Double-click (or long-tap on mobile) to create a new geofenced mission at that location!
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-brand-border/50">
              <button
                onClick={() => onSimulateCoordinates?.(40.7829, -73.9654)}
                type="button"
                className="text-[10px] font-bold bg-[#e6e2d3] hover:bg-[#dcdcd4] text-brand-moss px-2 py-1 rounded transition whitespace-nowrap"
              >
                📍 Green Leaf Base
              </button>
              <button
                onClick={() => onSimulateCoordinates?.(40.7850, -73.9682)}
                type="button"
                className="text-[10px] font-bold bg-[#e6e2d3] hover:bg-[#dcdcd4] text-brand-moss px-2 py-1 rounded transition whitespace-nowrap"
              >
                📍 Digit Clock Area
              </button>
              <button
                onClick={() => onSimulateCoordinates?.(40.7812, -73.9665)}
                type="button"
                className="text-[10px] font-bold bg-[#e6e2d3] hover:bg-[#dcdcd4] text-brand-moss px-2 py-1 rounded transition whitespace-nowrap"
              >
                📍 Furry Pet Zone
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
