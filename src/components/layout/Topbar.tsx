import React, { useState } from 'react';
import { 
  Radio, 
  Bell, 
  Search, 
  Play, 
  Pause, 
  Zap, 
  RotateCcw, 
  ChevronDown, 
  ShieldCheck, 
  ExternalLink,
  LogIn,
  LogOut,
  UserPlus,
  Bus as BusIcon,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { NotificationItem, SimulationControlState } from '../../types';

interface TopbarProps {
  simulation: SimulationControlState;
  wsConnected: boolean;
  notifications: NotificationItem[];
  onPause: () => void;
  onResume: () => void;
  onSetSpeed: (speed: 1 | 2 | 3) => void;
  onTriggerDetection: () => void;
  onResetDemo: () => void;
  onSelectNotification?: (detectionId?: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: Array<{ id: string; label: string; detail: string; kind: 'bus' | 'detection' }>;
  onSelectSearchResult: (result: { id: string; kind: 'bus' | 'detection' }) => void;
  user: { name: string; email: string } | null;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  simulation,
  wsConnected,
  notifications,
  onPause,
  onResume,
  onSetSpeed,
  onTriggerDetection,
  onResetDemo,
  onSelectNotification,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectSearchResult,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-xs sm:px-4 md:px-6">
      {/* Brand & Live Indicator */}
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <BusIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="truncate font-bold text-lg tracking-tight text-slate-900">UrbanNex <span className="text-blue-600">AI</span></span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                SIH 2026 #26124
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden md:block">Turning Buses into Mobile Sensors</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden lg:block" />

        {/* Live Simulation Indicator */}
        <div className="hidden shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs sm:flex">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${simulation.isRunning ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${simulation.isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="font-semibold text-slate-700 tracking-wide">
            {simulation.isRunning ? 'LIVE SIMULATION' : 'SIMULATION PAUSED'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {wsConnected ? 'WS LIVE' : 'WS RECONNECTING'}
          </span>
        </div>
      </div>

      {/* Center / Right: Demo Simulation Controls */}
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {/* Simulation Control Bar */}
        <div className="hidden xl:flex items-center gap-1.5 bg-slate-100/90 border border-slate-200 p-1 rounded-xl">
          <button
            onClick={simulation.isRunning ? onPause : onResume}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              simulation.isRunning
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            title={simulation.isRunning ? 'Pause Fleet Simulation' : 'Resume Fleet Simulation'}
          >
            {simulation.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{simulation.isRunning ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold text-slate-600">
            {([1, 2, 3] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => onSetSpeed(spd)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  simulation.speed === spd
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'hover:text-blue-600 text-slate-600'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Trigger Detection Button */}
          <button
            onClick={onTriggerDetection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
            title="Simulate immediate Edge AI detection from an active bus"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
            <span>Generate Detection</span>
          </button>

          {/* Reset Demo */}
          <button
            onClick={onResetDemo}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors"
            title="Reset simulation data to initial SIH demo state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Global Search */}
        <div className="relative hidden md:block w-44 lg:w-56">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search bus, route, incident..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
          />
          {searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {searchResults.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-500">No buses or incidents found.</p>
              ) : searchResults.map((result) => (
                <button
                  key={`${result.kind}-${result.id}`}
                  onClick={() => onSelectSearchResult(result)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0"
                >
                  <p className="text-xs font-semibold text-slate-800">{result.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{result.detail}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">System Alerts</span>
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                    {notifications.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">SIH Pilot Feed</span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">No active alerts.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.relatedDetectionId && onSelectNotification) {
                          onSelectNotification(n.relatedDetectionId);
                          setShowNotifications(false);
                        }
                      }}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-2.5"
                    >
                      <div className="mt-0.5">
                        {n.type === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : n.type === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : n.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                        {n.relatedDetectionId && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 mt-1 hover:underline">
                            Inspect {n.relatedDetectionId} <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {user ? user.name.slice(0, 2).toUpperCase() : <LogIn className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name || 'Guest Authority'}</p>
              <p className="text-[10px] text-slate-500 leading-tight">{user?.email || 'Sign in to continue'}</p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {!user ? (
                <div className="space-y-2">
                  <button onClick={() => onOpenAuth('login')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"><LogIn className="w-3.5 h-3.5" /> Log in</button>
                  <button onClick={() => onOpenAuth('signup')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"><UserPlus className="w-3.5 h-3.5" /> Sign up</button>
                </div>
              ) : <>
              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Smart City Authority Portal</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Connected as: <span className="font-medium text-slate-700">{user.email}</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {user.name} · Municipal Commissioner Desk
                </div>
              </div>
              <div className="pt-2 text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
                  <span>Pilot Deployment:</span>
                  <span className="font-semibold text-slate-800">Coimbatore Ward 12</span>
                </div>
                <div className="flex justify-between py-1 text-[11px]">
                  <span>SIH 2026 Prototype:</span>
                  <span className="font-semibold text-blue-600">Active</span>
                </div>
              </div>
              <button onClick={onLogout} className="mt-3 w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50"><LogOut className="w-3.5 h-3.5" /> Log out</button>
              </>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
