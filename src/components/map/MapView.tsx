import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Bus, 
  Detection, 
  RouteData, 
  DetectionType, 
  SeverityLevel,
  Department 
} from '../../types';
import { CITY_CENTER } from '../../data/seedData';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Navigation, 
  Filter, 
  MapPin, 
  Bus as BusIcon, 
  AlertTriangle, 
  CheckCircle,
  ExternalLink,
  Info
} from 'lucide-react';

interface MapViewProps {
  buses: Bus[];
  detections: Detection[];
  routes: RouteData[];
  onSelectDetection: (detection: Detection) => void;
  onSelectBus?: (bus: Bus) => void;
  onVerify?: (id: string) => void;
  onAssign?: (id: string, department: Department) => void;
  onResolve?: (id: string) => void;
  selectedDetectionId?: string | null;
  selectedBusId?: string | null;
  heightClass?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  buses,
  detections,
  routes,
  onSelectDetection,
  onSelectBus,
  onVerify,
  onAssign,
  onResolve,
  selectedDetectionId,
  selectedBusId,
  heightClass = 'h-[calc(100vh-4rem)]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const busMarkersRef = useRef<Record<string, L.Marker>>({});
  const detectionMarkersRef = useRef<Record<string, L.Marker>>({});
  const routeLayersRef = useRef<Record<string, L.Polyline>>({});

  // Layer visibility toggles
  const [showBuses, setShowBuses] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<DetectionType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<SeverityLevel | 'all'>('all');
  const [showLegend, setShowLegend] = useState(true);

  // Helper to get color by detection type
  const getDetectionColor = (type: DetectionType) => {
    switch (type) {
      case 'pothole': return '#ef4444'; // Red
      case 'road_damage': return '#ea580c'; // Orange
      case 'waterlogging': return '#2563eb'; // Blue
      case 'congestion': return '#d97706'; // Amber
      case 'pedestrian_risk': return '#9333ea'; // Purple
    }
  };

  // 1. Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Leaflet Map with smooth carto positron light tiles
    const map = L.map(mapContainerRef.current, {
      center: CITY_CENTER,
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> & OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Draw Routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous
    Object.values(routeLayersRef.current).forEach((layer: L.Polyline) => layer.remove());
    routeLayersRef.current = {};

    if (!showRoutes) return;

    routes.forEach((route) => {
      const polyline = L.polyline(route.waypoints, {
        color: route.color,
        weight: 4,
        opacity: 0.65,
        dashArray: '6, 6',
      }).addTo(map);

      polyline.bindTooltip(`<b>${route.routeNumber}</b>: ${route.name}`, {
        sticky: true,
        className: 'route-tooltip bg-white shadow-md text-xs font-semibold px-2 py-1 rounded border border-slate-200',
      });

      routeLayersRef.current[route.id] = polyline;
    });
  }, [routes, showRoutes]);

  // 3. Update or create Bus Markers smoothly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!showBuses) {
      Object.values(busMarkersRef.current).forEach((m: L.Marker) => m.remove());
      busMarkersRef.current = {};
      return;
    }

    buses.forEach((bus) => {
      const isSelected = selectedBusId === bus.id;

      // Custom HTML bus icon with heading arrow and speed badge
      const busHtml = `
        <div class="relative group cursor-pointer transition-transform duration-300" style="transform: translate(-50%, -50%);">
          <!-- Outer Pulsing Glow if selected or active -->
          <div class="w-10 h-10 rounded-full ${isSelected ? 'bg-blue-500/30 ring-4 ring-blue-500' : 'bg-slate-900/15'} flex items-center justify-center transition-all">
            <!-- Inner Bus Disc -->
            <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg border-2 ${isSelected ? 'border-blue-400' : 'border-white'} relative">
              <!-- Direction Heading Needle -->
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="transform: rotate(${bus.heading}deg);">
                <div class="w-1.5 h-1.5 bg-yellow-400 rounded-full absolute -top-1"></div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6v6"></path><path d="M16 6v6"></path><path d="M4 12h16"></path><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"></path><path d="M6 18v2"></path><path d="M18 18v2"></path>
              </svg>
            </div>
          </div>
          <!-- Bus ID & Speed Tag -->
          <div class="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 backdrop-blur-xs text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-200 pointer-events-none flex items-center gap-1">
            <span class="text-blue-600">${bus.id}</span>
            <span class="text-slate-400">•</span>
            <span>${bus.speed} km/h</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: busHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      if (busMarkersRef.current[bus.id]) {
        // Update position smoothly
        const marker = busMarkersRef.current[bus.id];
        marker.setLatLng([bus.latitude, bus.longitude]);
        marker.setIcon(customIcon);
      } else {
        // Create new marker
        const marker = L.marker([bus.latitude, bus.longitude], { icon: customIcon }).addTo(map);

        marker.on('click', () => {
          if (onSelectBus) onSelectBus(bus);
        });

        const popupContent = `
          <div class="p-2 min-w-[210px] text-slate-800 font-sans">
            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
              <div class="flex items-center gap-1.5">
                <div class="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">B</div>
                <span class="font-bold text-sm text-slate-900">${bus.id}</span>
              </div>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ${bus.status.toUpperCase()}
              </span>
            </div>
            <div class="text-xs space-y-1 text-slate-600 mb-2">
              <div class="flex justify-between">
                <span>Route:</span>
                <span class="font-semibold text-slate-800">${bus.routeName}</span>
              </div>
              <div class="flex justify-between">
                <span>Speed / Heading:</span>
                <span class="font-semibold text-slate-800">${bus.speed} km/h (${bus.heading}°)</span>
              </div>
              <div class="flex justify-between">
                <span>AI Inference:</span>
                <span class="font-semibold text-blue-600">${bus.aiStatus.toUpperCase()} (${bus.fps} FPS)</span>
              </div>
              <div class="flex justify-between">
                <span>GPS Lock:</span>
                <span class="font-semibold text-emerald-600">${bus.gpsStatus.toUpperCase()}</span>
              </div>
              <div class="flex justify-between">
                <span>Events Detected:</span>
                <span class="font-semibold text-slate-900">${bus.totalDetections}</span>
              </div>
            </div>
            <button id="inspect-bus-${bus.id}" class="w-full py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
              Open Bus Telemetry
            </button>
          </div>
        `;
        marker.bindPopup(popupContent, { className: 'urbannex-popup' });
        marker.on('popupopen', () => {
          const btn = document.getElementById(`inspect-bus-${bus.id}`);
          if (btn && onSelectBus) {
            btn.onclick = () => onSelectBus(bus);
          }
        });

        busMarkersRef.current[bus.id] = marker;
      }
    });
  }, [buses, showBuses, selectedBusId, onSelectBus]);

  // 4. Update or create Detection Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!showDetections) {
      Object.values(detectionMarkersRef.current).forEach((m: L.Marker) => m.remove());
      detectionMarkersRef.current = {};
      return;
    }

    // Filter detections
    const filtered = detections.filter((d) => {
      if (filterType !== 'all' && d.type !== filterType) return false;
      if (filterSeverity !== 'all' && d.severity !== filterSeverity) return false;
      return true;
    });

    const activeIds = new Set(filtered.map(d => d.id));

    // Remove obsolete markers
    Object.keys(detectionMarkersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        detectionMarkersRef.current[id].remove();
        delete detectionMarkersRef.current[id];
      }
    });

    filtered.forEach((detection) => {
      const isSelected = selectedDetectionId === detection.id;
      const color = getDetectionColor(detection.type);

      const markerHtml = `
        <div class="relative cursor-pointer transition-transform hover:scale-110" style="transform: translate(-50%, -50%);">
          <!-- Outer Pulsing Ring for Critical -->
          ${detection.severity === 'critical' ? `<div class="absolute -inset-1 rounded-full animate-ping opacity-60" style="background-color: ${color};"></div>` : ''}
          <div class="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md border-2 ${isSelected ? 'border-blue-600 scale-125 ring-2 ring-blue-300' : 'border-white'}" style="background-color: ${color};">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
            </svg>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-detection-marker',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (detectionMarkersRef.current[detection.id]) {
        detectionMarkersRef.current[detection.id].setIcon(icon);
      } else {
        const marker = L.marker([detection.latitude, detection.longitude], { icon }).addTo(map);

        const statusBadgeColor = 
          detection.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          detection.status === 'verified' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          detection.status === 'assigned' ? 'bg-purple-50 text-purple-700 border-purple-200' :
          detection.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          'bg-slate-100 text-slate-700 border-slate-200';

        const popupHtml = `
          <div class="p-2 min-w-[240px] text-slate-800 font-sans">
            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color};"></span>
                <span class="font-bold text-sm capitalize text-slate-900">${detection.type.replace('_', ' ')}</span>
              </div>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadgeColor}">
                ${detection.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div class="text-xs space-y-1.5 text-slate-600 mb-3">
              <div class="flex justify-between">
                <span>Confidence:</span>
                <span class="font-bold text-slate-900">${(detection.confidence * 100).toFixed(1)}%</span>
              </div>
              <div class="flex justify-between">
                <span>Severity:</span>
                <span class="font-bold uppercase ${detection.severity === 'critical' ? 'text-red-600' : detection.severity === 'high' ? 'text-orange-600' : 'text-slate-800'}">
                  ${detection.severity}
                </span>
              </div>
              <div class="flex justify-between">
                <span>Detected By:</span>
                <span class="font-semibold text-blue-600">${detection.busId}</span>
              </div>
              <div class="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                ${detection.locationName}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-1.5 mb-1.5">
              ${detection.status === 'pending_verification' ? `
                <button id="verify-btn-${detection.id}" class="py-1 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors">
                  Verify
                </button>
                <button id="assign-btn-${detection.id}" class="py-1 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors">
                  Assign
                </button>
              ` : detection.status !== 'resolved' ? `
                <button id="resolve-btn-${detection.id}" class="col-span-2 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-md transition-colors">
                  Mark Resolved
                </button>
              ` : `
                <div class="col-span-2 text-center text-xs text-emerald-600 font-semibold py-1 bg-emerald-50 rounded-md">
                  ✓ Issue Resolved
                </div>
              `}
            </div>

            <button id="drawer-btn-${detection.id}" class="w-full py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors flex items-center justify-center gap-1">
              Inspect Evidence Frame
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
          </div>
        `;

        marker.bindPopup(popupHtml, { className: 'urbannex-popup' });

        marker.on('popupopen', () => {
          const verifyBtn = document.getElementById(`verify-btn-${detection.id}`);
          if (verifyBtn && onVerify) {
            verifyBtn.onclick = () => {
              onVerify(detection.id);
              marker.closePopup();
            };
          }
          const assignBtn = document.getElementById(`assign-btn-${detection.id}`);
          if (assignBtn && onAssign) {
            assignBtn.onclick = () => {
              onAssign(detection.id, 'Roads & Infrastructure');
              marker.closePopup();
            };
          }
          const resolveBtn = document.getElementById(`resolve-btn-${detection.id}`);
          if (resolveBtn && onResolve) {
            resolveBtn.onclick = () => {
              onResolve(detection.id);
              marker.closePopup();
            };
          }
          const drawerBtn = document.getElementById(`drawer-btn-${detection.id}`);
          if (drawerBtn) {
            drawerBtn.onclick = () => {
              onSelectDetection(detection);
              marker.closePopup();
            };
          }
        });

        detectionMarkersRef.current[detection.id] = marker;
      }
    });
  }, [detections, showDetections, filterType, filterSeverity, selectedDetectionId, onSelectDetection, onVerify, onAssign, onResolve]);

  // Recenter helper
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(CITY_CENTER, 13, { animate: true });
    }
  };

  return (
    <div className={`relative w-full ${heightClass} bg-slate-100 overflow-hidden`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        {/* Layer Toggles Group */}
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-1 shadow-md flex items-center gap-1 text-xs">
          <button
            onClick={() => setShowBuses(!showBuses)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              showBuses ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BusIcon className="w-3.5 h-3.5" />
            <span>Buses ({buses.length})</span>
          </button>

          <button
            onClick={() => setShowDetections(!showDetections)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              showDetections ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Detections ({detections.length})</span>
          </button>

          <button
            onClick={() => setShowRoutes(!showRoutes)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              showRoutes ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Routes</span>
          </button>
        </div>

        {/* Filters Group */}
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-1 shadow-md flex items-center gap-1 text-xs">
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-transparent px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Anomaly Types</option>
            <option value="pothole">Potholes</option>
            <option value="waterlogging">Waterlogging</option>
            <option value="road_damage">Road Damage</option>
            <option value="congestion">Traffic Congestion</option>
            <option value="pedestrian_risk">Pedestrian Risk</option>
          </select>

          <div className="h-4 w-px bg-slate-200" />

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as any)}
            className="bg-transparent px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          className="bg-white/95 backdrop-blur-xs hover:bg-white text-slate-700 p-2 rounded-xl shadow-md border border-slate-200 transition-colors"
          title="Recenter Map"
        >
          <Navigation className="w-4 h-4 text-blue-600" />
        </button>
      </div>

      {/* Floating Legend in Bottom Left */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-2xl p-3 shadow-lg max-w-xs text-xs">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
            <span className="font-bold text-slate-800 text-[11px] tracking-wide">GIS MAP LEGEND</span>
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-slate-400 hover:text-slate-700"
            >
              {showLegend ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showLegend && (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-900 border border-white flex items-center justify-center text-[8px] text-white font-bold">B</span>
                <span className="text-slate-700 font-medium">Active Sensor Bus (Live Heading)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-slate-700 font-medium">Pothole</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                <span className="text-slate-700 font-medium">Waterlogging</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-slate-700 font-medium">Road Damage</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-slate-700 font-medium">Traffic Congestion</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                <span className="text-slate-700 font-medium">Pedestrian Safety Risk</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
