import React from 'react';
import { 
  Bus, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Wifi, 
  MapPin, 
  ChevronRight, 
  TrendingUp, 
  Zap,
  ShieldCheck,
  Radio,
  ExternalLink
} from 'lucide-react';
import { Bus as BusType, Detection, RouteData, Department } from '../../types';
import { DetectionFeed } from '../detections/DetectionFeed';
import { MapView } from '../map/MapView';

interface OverviewDashboardProps {
  buses: BusType[];
  detections: Detection[];
  routes: RouteData[];
  onSelectDetection: (d: Detection) => void;
  onSelectBus: (b: BusType) => void;
  onNavigateTab: (tab: any) => void;
  onTriggerDetection: () => void;
  onVerify: (id: string) => void;
  onAssign: (id: string, dept: Department) => void;
  onResolve: (id: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  buses,
  detections,
  routes,
  onSelectDetection,
  onSelectBus,
  onNavigateTab,
  onTriggerDetection,
  onVerify,
  onAssign,
  onResolve,
}) => {
  const totalBuses = buses.length;
  const activeBuses = buses.filter(b => b.status === 'active').length;
  const pendingCount = detections.filter(d => d.status === 'pending_verification').length;
  const criticalCount = detections.filter(d => d.severity === 'critical' && d.status !== 'resolved').length;
  const resolvedCount = detections.filter(d => d.status === 'resolved').length;
  const verifiedCount = detections.filter(d => d.status === 'verified').length;
  const liveDetectionsLastHour = detections.filter(d => {
    const parsed = new Date(d.timestamp).getTime();
    return Number.isFinite(parsed) && Date.now() - parsed <= 60 * 60 * 1000;
  }).length;
  const fleetOnlinePercent = totalBuses ? Math.round((activeBuses / totalBuses) * 100) : 0;

  const kpis = [
    {
      id: 'active_buses',
      title: 'Active Buses',
      value: `${activeBuses}`,
      subtext: `${fleetOnlinePercent}% of ${totalBuses} fleet units online`,
      icon: Bus,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      badge: `${fleetOnlinePercent}% Online`,
      badgeColor: 'bg-emerald-50 text-emerald-700',
      tab: 'fleet',
    },
    {
      id: 'live_detections',
      title: 'Live Detections',
      value: `${detections.length}`,
      subtext: `${liveDetectionsLastHour} in the last hour`,
      icon: Activity,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      badge: 'Live Stream',
      badgeColor: 'bg-blue-50 text-blue-700',
      tab: 'detections',
    },
    {
      id: 'pending_verification',
      title: 'Pending Verification',
      value: `${pendingCount}`,
      subtext: `${verifiedCount} verified and cleared`,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      badge: pendingCount > 0 ? 'Action Needed' : 'Clear',
      badgeColor: pendingCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700',
      tab: 'workflow',
    },
    {
      id: 'critical_issues',
      title: 'Critical Issues',
      value: `${criticalCount}`,
      subtext: 'Severe road hazards flagged',
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50 border-red-200',
      badge: criticalCount > 0 ? 'Urgent Dispatch' : 'Normal',
      badgeColor: criticalCount > 0 ? 'bg-red-50 text-red-700 font-bold' : 'bg-slate-100 text-slate-700',
      tab: 'incidents',
    },
    {
      id: 'resolved_today',
      title: 'Resolved Today',
      value: `${resolvedCount}`,
      subtext: 'Inspected and certified clear',
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      badge: '+12% vs avg',
      badgeColor: 'bg-emerald-50 text-emerald-700',
      tab: 'workflow',
    },
    {
      id: 'network_health',
      title: 'Network Health',
      value: '98.7%',
      subtext: 'Edge telemetry & GPS lock',
      icon: Wifi,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      badge: 'Latency: 114ms',
      badgeColor: 'bg-cyan-50 text-cyan-800',
      tab: 'health',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white to-blue-50/40 p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Smart India Hackathon 2026 • Problem #26124
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Coimbatore Pilot Corridor</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            UrbanNex AI • Urban Intelligence Command Center
          </h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Real-time urban infrastructure monitoring powered by the city's public transport fleet. Buses act as mobile optical sensors, executing edge inference and reporting structured hazard metadata to municipal desks.
          </p>
        </div>

        {/* Quick Trigger Callout for SIH Judges */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTriggerDetection}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            <span>Simulate Live Anomaly</span>
          </button>
          <button
            onClick={() => onNavigateTab('workflow')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition-colors"
          >
            <span>Triage Board</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              onClick={() => onNavigateTab(kpi.tab)}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${kpi.badgeColor}`}>
                  {kpi.badge}
                </span>
              </div>

              <div className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                {kpi.value}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">{kpi.title}</div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">{kpi.subtext}</div>
            </div>
          );
        })}
      </div>

      {/* Critical Emergency Banner if any critical unaddressed */}
      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-900 uppercase tracking-wide">
                Rapid Response Warning: {criticalCount} High-Severity Road Hazards
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Immediate municipal intervention required. Waterlogging or road cavitations are impeding transit lanes.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('incidents')}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
          >
            Review Hazards
          </button>
        </div>
      )}

      {/* Main Grid: GIS Map Preview + Live Detection Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: GIS Map Preview */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Live Pilot GIS Telemetry (Coimbatore Ward 12)</h2>
            </div>
            <button
              onClick={() => onNavigateTab('gis_map')}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              Expand Full Map <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="relative flex-1 min-h-[420px]">
            <MapView
              buses={buses}
              detections={detections}
              routes={routes}
              onSelectDetection={onSelectDetection}
              onSelectBus={onSelectBus}
              onVerify={onVerify}
              onAssign={onAssign}
              onResolve={onResolve}
              heightClass="h-[420px]"
            />
          </div>
        </div>

        {/* Right 5 cols: Live Activity Feed */}
        <div className="lg:col-span-5 h-[480px]">
          <DetectionFeed
            detections={detections}
            onSelectDetection={onSelectDetection}
            maxItems={15}
          />
        </div>
      </div>
    </div>
  );
};
