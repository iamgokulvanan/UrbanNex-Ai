import React, { useState } from 'react';
import { 
  Bus as BusIcon, 
  MapPin, 
  Wifi, 
  Cpu, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Search,
  X,
  Radio,
  Gauge
} from 'lucide-react';
import { Bus, RouteData } from '../../types';

interface FleetPageProps {
  buses: Bus[];
  routes: RouteData[];
  onSelectBus: (bus: Bus) => void;
  onOpenMapForBus: (bus: Bus) => void;
}

export const FleetPage: React.FC<FleetPageProps> = ({
  buses,
  routes,
  onSelectBus,
  onOpenMapForBus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectingBus, setInspectingBus] = useState<Bus | null>(null);

  const filtered = buses.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        b.id.toLowerCase().includes(q) ||
        b.busNumber.toLowerCase().includes(q) ||
        b.routeName.toLowerCase().includes(q) ||
        b.driverName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Pilot Mobile Sensor Network
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-emerald-600">12 Units Onboard Edge AI</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Bus Fleet Management & Edge Telemetry
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time status of all municipal transit buses equipped with forward-facing cameras and onboard inference units.
          </p>
        </div>

        {/* Quick summary pill */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-xs text-xs">
          <div className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200">
            12 Active
          </div>
          <div className="px-3 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200">
            Avg 28.6 FPS
          </div>
          <div className="px-3 py-1 bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200">
            99.2% Sync
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search bus number, driver, route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Fleet Statuses</option>
            <option value="active">Active Only</option>
            <option value="warning">Warning</option>
            <option value="idle">Idle</option>
          </select>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Bus ID & Reg</th>
                <th className="py-3 px-4">Assigned Route</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">GPS Coordinates</th>
                <th className="py-3 px-4">Speed</th>
                <th className="py-3 px-4">Edge AI / FPS</th>
                <th className="py-3 px-4">Camera</th>
                <th className="py-3 px-4">Detections</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((bus) => (
                <tr 
                  key={bus.id} 
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  onClick={() => setInspectingBus(bus)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {bus.id.replace('BUS-', '')}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{bus.id}</span>
                        <div className="text-[11px] text-slate-400 font-mono">{bus.busNumber}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800">{bus.routeName}</span>
                    <div className="text-[10px] text-slate-400">Pilot Ward 12</div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {bus.status.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {bus.latitude.toFixed(4)}°, {bus.longitude.toFixed(4)}°
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800">{bus.speed}</span>
                    <span className="text-slate-400 text-[10px] ml-0.5">km/h</span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 font-semibold text-blue-600">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>{bus.fps} FPS</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Jetson Nano Edge</span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                      <Camera className="w-3 h-3 text-emerald-600" />
                      1080p Optical
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{bus.totalDetections} flagged</div>
                    <span className="text-[10px] text-emerald-600 font-semibold">{bus.verifiedDetections} verified</span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingBus(bus);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                    >
                      Telemetry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bus Detail Drawer / Modal */}
      {inspectingBus && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div 
            onClick={() => setInspectingBus(null)} 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs" 
          />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {inspectingBus.id.replace('BUS-', '')}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{inspectingBus.id} — Mobile Sensor Unit</h2>
                  <p className="text-xs text-slate-500 font-mono">Reg: {inspectingBus.busNumber} • Driver: {inspectingBus.driverName}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingBus(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
              {/* Telemetry Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Current Speed</span>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{inspectingBus.speed} km/h</div>
                  <span className="text-[10px] text-slate-400 font-mono">Heading: {inspectingBus.heading}°</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Inference Speed</span>
                  <div className="text-xl font-bold text-blue-600 mt-0.5">{inspectingBus.fps} FPS</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">Real-Time Sync</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">4G LTE Link</span>
                  <div className="text-xl font-bold text-emerald-600 mt-0.5">{inspectingBus.networkStrength}%</div>
                  <span className="text-[10px] text-slate-400 font-mono">Metadata stream</span>
                </div>
              </div>

              {/* Hardware Diagnostic Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Edge Onboard Diagnostics
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Forward Camera:</span>
                    <span className="font-bold text-emerald-600">ONLINE (1080p@30)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>GPS Fix:</span>
                    <span className="font-bold text-emerald-600">LOCKED (RTK Sub-Meter)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Inference Model:</span>
                    <span className="font-bold text-slate-800">UrbanNex Edge v2</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Raw Video Streaming:</span>
                    <span className="font-bold text-slate-500">DISABLED (Privacy Strict)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Total Flagged:</span>
                    <span className="font-bold text-slate-900">{inspectingBus.totalDetections} Hazards</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Last Active:</span>
                    <span className="font-bold text-slate-800">{inspectingBus.lastSeen}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    onOpenMapForBus(inspectingBus);
                    setInspectingBus(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Track on GIS Map</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
