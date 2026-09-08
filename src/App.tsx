import React, { useState } from 'react';
import { useUrbanNexRealtime } from './hooks/useUrbanNexRealtime';
import { Topbar } from './components/layout/Topbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { MapView } from './components/map/MapView';
import { DetectionFeed } from './components/detections/DetectionFeed';
import { FleetPage } from './components/fleet/FleetPage';
import { AIMonitor } from './components/ai-monitor/AIMonitor';
import { WorkflowBoard } from './components/workflow/WorkflowBoard';
import { IncidentsPage } from './components/incidents/IncidentsPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { SystemHealthPage } from './components/health/SystemHealthPage';
import { PrivacySpecsPage } from './components/privacy/PrivacySpecsPage';
import { DetectionDrawer } from './components/detections/DetectionDrawer';
import { Detection, Bus, Department } from './types';
import { 
  LayoutDashboard, 
  MapPin, 
  Activity, 
  Bus as BusIcon, 
  Kanban, 
  Menu, 
  X,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';

export default function App() {
  const {
    buses,
    detections,
    routes,
    systemHealth,
    simulation,
    notifications,
    wsConnected,
    pauseSimulation,
    resumeSimulation,
    setSimulationSpeed,
    triggerManualDetection,
    verifyDetection,
    rejectDetection,
    assignDepartment,
    markInProgress,
    resolveIncident,
    resetSimulation,
  } = useUrbanNexRealtime();

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handlers
  const handleSelectDetectionById = (id?: string) => {
    if (!id) return;
    const found = detections.find(d => d.id === id);
    if (found) {
      setSelectedDetection(found);
    }
  };

  const handleOpenMapForBus = (bus: Bus) => {
    setSelectedBusId(bus.id);
    setActiveTab('gis_map');
  };

  const pendingCount = detections.filter(d => d.status === 'pending_verification').length;
  const criticalCount = detections.filter(d => d.severity === 'critical' && d.status !== 'resolved').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Topbar */}
      <Topbar
        simulation={simulation}
        wsConnected={wsConnected}
        notifications={notifications}
        onPause={pauseSimulation}
        onResume={resumeSimulation}
        onSetSpeed={setSimulationSpeed}
        onTriggerDetection={triggerManualDetection}
        onResetDemo={resetSimulation}
        onSelectNotification={handleSelectDetectionById}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Layout (Sidebar + Content Area) */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            activeBusCount={buses.filter(b => b.status === 'active').length}
            pendingCount={pendingCount}
            criticalCount={criticalCount}
          />
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div 
              onClick={() => setMobileMenuOpen(false)} 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs" 
            />
            <div className="relative w-64 bg-white shadow-2xl h-full flex flex-col z-10">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">Navigation Menu</span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar
                  activeTab={activeTab}
                  onSelectTab={(tab) => {
                    setActiveTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  activeBusCount={buses.filter(b => b.status === 'active').length}
                  pendingCount={pendingCount}
                  criticalCount={criticalCount}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Center Stage Views */}
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-4rem)] pb-16 md:pb-6">
          {activeTab === 'overview' && (
            <OverviewDashboard
              buses={buses}
              detections={detections}
              routes={routes}
              onSelectDetection={setSelectedDetection}
              onSelectBus={handleOpenMapForBus}
              onNavigateTab={setActiveTab}
              onTriggerDetection={triggerManualDetection}
              onVerify={verifyDetection}
              onAssign={assignDepartment}
              onResolve={resolveIncident}
            />
          )}

          {activeTab === 'gis_map' && (
            <div className="h-[calc(100vh-4rem)]">
              <MapView
                buses={buses}
                detections={detections}
                routes={routes}
                onSelectDetection={setSelectedDetection}
                onSelectBus={handleOpenMapForBus}
                onVerify={verifyDetection}
                onAssign={assignDepartment}
                onResolve={resolveIncident}
                selectedDetectionId={selectedDetection?.id}
                selectedBusId={selectedBusId}
                heightClass="h-full"
              />
            </div>
          )}

          {activeTab === 'detections' && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Live Optical Detections Stream
                  </h1>
                  <p className="text-xs md:text-sm text-slate-500">
                    Real-time edge event feed from all forward-facing cameras across the Coimbatore transit fleet.
                  </p>
                </div>
                <button
                  onClick={triggerManualDetection}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors self-start"
                >
                  Generate New Detection
                </button>
              </div>

              <div className="h-[680px]">
                <DetectionFeed
                  detections={detections}
                  onSelectDetection={setSelectedDetection}
                  maxItems={50}
                />
              </div>
            </div>
          )}

          {activeTab === 'fleet' && (
            <FleetPage
              buses={buses}
              routes={routes}
              onSelectBus={(bus) => setSelectedBusId(bus.id)}
              onOpenMapForBus={handleOpenMapForBus}
            />
          )}

          {activeTab === 'ai_monitor' && (
            <AIMonitor
              buses={buses}
              detections={detections}
              onTriggerDetection={triggerManualDetection}
            />
          )}

          {activeTab === 'workflow' && (
            <WorkflowBoard
              detections={detections}
              onSelectDetection={setSelectedDetection}
              onVerify={verifyDetection}
              onAssign={assignDepartment}
              onInProgress={markInProgress}
              onResolve={resolveIncident}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentsPage
              detections={detections}
              onSelectDetection={setSelectedDetection}
              onVerify={verifyDetection}
              onResolve={resolveIncident}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage
              detections={detections}
              buses={buses}
              routes={routes}
            />
          )}

          {activeTab === 'health' && (
            <SystemHealthPage
              health={systemHealth}
              wsConnected={wsConnected}
            />
          )}

          {activeTab === 'privacy' && (
            <PrivacySpecsPage
              onNavigateTab={setActiveTab}
              onTriggerDetection={triggerManualDetection}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 flex items-center justify-around z-30 shadow-lg">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'overview' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('gis_map')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'gis_map' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>GIS Map</span>
        </button>

        <button
          onClick={() => setActiveTab('detections')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'detections' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Detections</span>
        </button>

        <button
          onClick={() => setActiveTab('workflow')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold relative ${
            activeTab === 'workflow' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Kanban className="w-4 h-4" />
          <span>Workflow</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500"
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </div>

      {/* Incident Detail / Evidence Drawer Modal */}
      {selectedDetection && (
        <DetectionDrawer
          detection={selectedDetection}
          onClose={() => setSelectedDetection(null)}
          onVerify={(id) => {
            verifyDetection(id);
            // update currently inspected object
            setSelectedDetection(prev => prev ? { ...prev, status: 'verified' } : null);
          }}
          onReject={(id, reason) => {
            rejectDetection(id, reason);
            setSelectedDetection(null);
          }}
          onAssign={(id, dept, note) => {
            assignDepartment(id, dept, note);
            setSelectedDetection(prev => prev ? { ...prev, status: 'assigned', department: dept } : null);
          }}
          onInProgress={(id, note) => {
            markInProgress(id, note);
            setSelectedDetection(prev => prev ? { ...prev, status: 'in_progress' } : null);
          }}
          onResolve={(id, notes) => {
            resolveIncident(id, notes);
            setSelectedDetection(prev => prev ? { ...prev, status: 'resolved' } : null);
          }}
        />
      )}
    </div>
  );
}
