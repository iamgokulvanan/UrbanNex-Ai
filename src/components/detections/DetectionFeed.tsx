import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  ChevronRight, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Bus,
  CheckCircle2
} from 'lucide-react';
import { Detection, DetectionType, SeverityLevel } from '../../types';

interface DetectionFeedProps {
  detections: Detection[];
  onSelectDetection: (detection: Detection) => void;
  maxItems?: number;
}

export const DetectionFeed: React.FC<DetectionFeedProps> = ({
  detections,
  onSelectDetection,
  maxItems = 30,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<DetectionType | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel | 'all'>('all');

  const filtered = detections
    .filter((d) => {
      if (selectedType !== 'all' && d.type !== selectedType) return false;
      if (selectedSeverity !== 'all' && d.severity !== selectedSeverity) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          d.id.toLowerCase().includes(query) ||
          d.locationName.toLowerCase().includes(query) ||
          d.busId.toLowerCase().includes(query) ||
          d.type.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .slice(0, maxItems);

  const getSeverityBadge = (sev: SeverityLevel) => {
    switch (sev) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getTypeIconColor = (type: DetectionType) => {
    switch (type) {
      case 'pothole': return 'text-red-600 bg-red-50';
      case 'waterlogging': return 'text-blue-600 bg-blue-50';
      case 'road_damage': return 'text-orange-600 bg-orange-50';
      case 'congestion': return 'text-amber-600 bg-amber-50';
      case 'pedestrian_risk': return 'text-purple-600 bg-purple-50';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">Live AI Detection Feed</h3>
              <p className="text-[11px] text-slate-500">Autonomous Edge Inferences</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {filtered.length} Events
          </span>
        </div>

        {/* Filter Controls */}
        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search feed by street, bus, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="pothole">Potholes</option>
              <option value="waterlogging">Waterlogging</option>
              <option value="road_damage">Road Damage</option>
              <option value="congestion">Congestion</option>
              <option value="pedestrian_risk">Pedestrian</option>
            </select>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No detections matching current filter.
          </div>
        ) : (
          filtered.map((d) => (
            <div
              key={d.id}
              onClick={() => onSelectDetection(d)}
              className="p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-transparent hover:border-slate-200 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${getTypeIconColor(d.type)}`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 capitalize">
                        {d.type.replace('_', ' ')}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${getSeverityBadge(d.severity)}`}>
                        {d.severity}
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                      <Bus className="w-3 h-3" />
                      {d.busId} • Conf: {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <div className="mt-0.5">
                    <span className="text-[10px] font-semibold text-slate-500 capitalize">
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-2 line-clamp-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{d.locationName}</span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
