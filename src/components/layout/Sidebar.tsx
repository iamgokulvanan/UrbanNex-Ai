import React from 'react';
import { 
  LayoutDashboard, 
  MapPin, 
  Activity, 
  Bus, 
  Cpu, 
  AlertOctagon, 
  BarChart3, 
  Kanban, 
  HeartPulse, 
  ShieldCheck,
  Zap,
  Info,
  Camera
} from 'lucide-react';

export type NavTab = 
  | 'overview'
  | 'live_camera'
  | 'gis_map'
  | 'detections'
  | 'fleet'
  | 'ai_monitor'
  | 'incidents'
  | 'analytics'
  | 'workflow'
  | 'health'
  | 'privacy';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeBusCount: number;
  pendingCount: number;
  criticalCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeBusCount,
  pendingCount,
  criticalCount,
}) => {
  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'live_camera' as NavTab,
      label: 'Live Camera',
      icon: Camera,
      badge: 'Mobile',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'gis_map' as NavTab,
      label: 'Live GIS Map',
      icon: MapPin,
      badge: `${activeBusCount} Buses`,
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'detections' as NavTab,
      label: 'Live Detections',
      icon: Activity,
      badge: 'Live',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 'fleet' as NavTab,
      label: 'Bus Fleet',
      icon: Bus,
      badge: `${activeBusCount}/12`,
      badgeColor: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'ai_monitor' as NavTab,
      label: 'AI Monitor',
      icon: Cpu,
      badge: 'Edge',
      badgeColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id: 'workflow' as NavTab,
      label: 'Authority Workflow',
      icon: Kanban,
      badge: pendingCount > 0 ? `${pendingCount}` : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'incidents' as NavTab,
      label: 'Incidents',
      icon: AlertOctagon,
      badge: criticalCount > 0 ? `${criticalCount} Crit` : null,
      badgeColor: 'bg-red-100 text-red-700',
    },
    {
      id: 'analytics' as NavTab,
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'health' as NavTab,
      label: 'System Health',
      icon: HeartPulse,
      badge: '98.7%',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'privacy' as NavTab,
      label: 'Privacy & Specs',
      icon: ShieldCheck,
      badge: 'SIH',
      badgeColor: 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 shadow-xs z-20">
      {/* Top Header info */}
      <div className="p-4">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 leading-tight">Command Center</p>
            <p className="text-[10px] text-slate-500 truncate">Smart Automation #26124</p>
          </div>
        </div>

        {/* Nav list */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70">
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Edge Sensor Fleet:</span>
            <span className="font-bold text-emerald-600">12 Active</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Inference FPS:</span>
            <span className="font-bold text-blue-600">28.6 FPS</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-emerald-500 h-full rounded-full w-[98.7%]" />
          </div>
        </div>

        <div className="mt-3 text-[10px] text-slate-400 text-center leading-tight">
          UrbanNex AI · SIH 2026<br />
          <span className="text-slate-500 font-medium">Coimbatore Transit Pilot</span>
        </div>
      </div>
    </aside>
  );
};
