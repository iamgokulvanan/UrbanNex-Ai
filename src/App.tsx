import React, { useEffect, useState } from 'react';
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
import { LiveCamera } from './components/camera/LiveCamera';
import { RealVideoDetection } from './components/detections/RealVideoDetection';
import { DetectionDrawer } from './components/detections/DetectionDrawer';
import { LoginPage } from './components/auth/LoginPage';
import { Detection, Bus, Department, DetectionType } from './types';
import { DEPARTMENTS } from './data/seedData';
import { 
  LayoutDashboard, 
  MapPin, 
  Activity, 
  Camera,
  Bus as BusIcon, 
  Kanban, 
  Menu, 
  X,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(response.ok
      ? 'The authentication service returned an invalid response.'
      : 'The authentication service is unavailable. Please try again shortly.');
  }
  return response.json();
}

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
    appendDetections,
  } = useUrbanNexRealtime();

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ id: number; name: string; email: string; role: 'main' | 'department'; department: Department | null; approved: boolean } | null>(null);
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('urbannex-token'));
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authorityRequests, setAuthorityRequests] = useState<Array<{ id: number; name: string; email: string; requestedDepartment: Department; createdAt: string }>>([]);
  const [authorityError, setAuthorityError] = useState('');
  const [authorityNotice, setAuthorityNotice] = useState('');

  useEffect(() => {
    if (!sessionToken) return;
    if (sessionToken.startsWith('urbannex-demo:')) {
      localStorage.removeItem('urbannex-token');
      setSessionToken(null);
      setUser(null);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Your session has expired. Please sign in again.');
        const data = await readApiResponse(response);
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('urbannex-token');
        setSessionToken(null);
        setUser(null);
      });
  }, [sessionToken]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'main') {
      void loadAuthorityRequests(sessionToken || '');
    } else if (!['workflow', 'incidents'].includes(activeTab)) {
      setActiveTab('workflow');
    }
  }, [user, sessionToken]);

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
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch ? [
    ...buses
      .filter(bus => [bus.id, bus.busNumber, bus.routeName, bus.driverName].some(value => value.toLowerCase().includes(normalizedSearch)))
      .slice(0, 5)
      .map(bus => ({ id: bus.id, label: bus.id, detail: `${bus.routeName} · ${bus.driverName}`, kind: 'bus' as const })),
    ...detections
      .filter(detection => [detection.id, detection.locationName, detection.busId, detection.type].some(value => value.toLowerCase().includes(normalizedSearch)))
      .slice(0, 5)
      .map(detection => ({ id: detection.id, label: detection.id, detail: `${detection.type.replace('_', ' ')} · ${detection.locationName}`, kind: 'detection' as const })),
  ].slice(0, 8) : [];

  const handleAuthSubmit = async ({ name, email, password, accountType, department }: { name: string; email: string; password: string; accountType: 'main' | 'department'; department: Department }) => {
    setAuthSubmitting(true);
    setAuthError('');
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const response = await fetch(`/api/auth/${authMode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password, accountType, department }),
      });
      const data = await readApiResponse(response);
      if (response.status === 202 && data.pendingApproval) {
        setAuthError(data.message);
        setAuthMode('login');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Unable to authenticate.');
      localStorage.setItem('urbannex-token', data.token);
      setSessionToken(data.token);
      setUser(data.user);
      setAuthMode(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to authenticate.';
      if (message.startsWith('The authentication service')) {
        setAuthError('The authority service is required for secure sign-in and department assignment. Start the backend and try again.');
      } else {
        setAuthError(message);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const requestPasswordReset = async (email: string) => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not request a password reset.');
    return data as { message?: string; developmentToken?: string };
  };

  const resetAccountPassword = async (email: string, token: string, password: string) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not reset the password.');
  };

  const loadAuthorityRequests = async (token: string) => {
    try {
      const response = await fetch('/api/admin/authority-requests', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Could not load department access requests.');
      const data = await response.json();
      setAuthorityRequests(data.requests);
      setAuthorityError('');
    } catch (error) {
      setAuthorityError(error instanceof Error ? error.message : 'Could not load department access requests.');
    }
  };

  const approveAuthorityRequest = async (id: number, department: Department) => {
    if (!sessionToken) return;
    const response = await fetch(`/api/admin/authority-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ department }),
    });
    const data = await response.json();
    if (!response.ok) {
      setAuthorityError(data.error || 'Could not approve the authority request.');
      return;
    }
    setAuthorityError('');
    setAuthorityNotice(data.emailSent
      ? `Access approved for ${department}; an email was sent to the authority.`
      : `Access approved for ${department}; approval email was not sent. Configure RESEND_API_KEY and AUTH_FROM_EMAIL.`);
    setAuthorityRequests((requests) => requests.filter((request) => request.id !== id));
  };

  const handleLogout = () => {
    if (sessionToken) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } }).catch(() => {});
    }
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('urbannex-token');
  };

  const handleAuthFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleAuthSubmit({ name: authName, email: authEmail, password: authPassword, accountType: 'department', department: DEPARTMENTS[0] });
  };

  const handleVideoAnalysisResult = async (videoDetections: Array<{
    class?: string;
    type?: DetectionType;
    confidence?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    bbox?: { x1?: number; y1?: number; x2?: number; y2?: number };
    frame?: number;
    timestamp?: number;
    frame_image?: string;
  }>, videoName?: string) => {
    const mapToSeverity = (type: DetectionType = 'pothole', confidence = 0.9) => {
      if (type === 'waterlogging') return confidence > 0.9 ? 'critical' : 'high';
      if (type === 'pedestrian_risk') return confidence > 0.94 ? 'critical' : 'medium';
      if (type === 'congestion') return 'high';
      if (type === 'pothole') return confidence > 0.92 ? 'high' : 'medium';
      if (type === 'road_damage') return confidence > 0.9 ? 'high' : 'medium';
      return 'medium';
    };

    const fallbackBus = buses[0] || {
      id: 'BUS-004',
      routeId: 'RT-04',
      routeName: 'Coimbatore Ring',
      latitude: 11.0185,
      longitude: 76.9566,
    };

    const mapped: Detection[] = videoDetections
      .filter(d => d?.class && d?.bbox)
      .map((detection, index) => {
        const resolvedType = (detection.type ?? detection.class ?? 'pothole') as DetectionType;
        const confidence = detection.confidence ?? 0.9;
        const bbox = detection.bbox ?? {};
        const detectionId = `DET-VIDEO-${Date.now()}-${index + 1}`;
        const createdAt = new Date().toISOString();

        return {
          id: detectionId,
          type: resolvedType,
          confidence,
          severity: detection.severity ?? mapToSeverity(resolvedType, confidence),
          latitude: fallbackBus.latitude + (index + 1) * 0.0002,
          longitude: fallbackBus.longitude + (index + 1) * 0.00015,
          locationName: videoName ? `Uploaded video analysis · ${videoName}` : 'Uploaded video analysis',
          busId: fallbackBus.id,
          routeId: fallbackBus.routeId,
          timestamp: createdAt,
          status: 'pending_verification',
          evidenceImage: detection.frame_image || 'simulated_pothole_01',
          source: 'mobile_camera',
          simulatedBoundingBoxes: [{
            x: ((bbox.x1 ?? 0) / 640) * 100,
            y: ((bbox.y1 ?? 0) / 360) * 100,
            width: (((bbox.x2 ?? 0) - (bbox.x1 ?? 0)) / 640) * 100,
            height: (((bbox.y2 ?? 0) - (bbox.y1 ?? 0)) / 360) * 100,
            label: resolvedType,
            confidence,
          }],
          roadSurfaceMetric: `Video upload classification (${resolvedType.replace('_', ' ')})`,
          notes: `Imported from uploaded road video evidence${videoName ? ` (${videoName})` : ''}. Detected issue: ${resolvedType.replace('_', ' ')}.`,
          history: [{
            id: `H-${Date.now()}-${index}`,
            detectionId,
            previousStatus: 'pending_verification',
            newStatus: 'pending_verification',
            timestamp: createdAt,
            changedBy: 'Video Upload Analysis',
            note: `Imported uploaded video evidence for ${resolvedType.replace('_', ' ')}.`,
          }],
        } satisfies Detection;
      });

    if (!mapped.length) return;
    const response = await fetch('/api/detections/import-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ detections: mapped }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save analyzed video detections.');
    const persistedDetections = data.detections as Detection[];
    appendDetections(persistedDetections);
    setSelectedDetection(persistedDetections[0]);
    setActiveTab('detections');
  };

  const submitMobileDetection = async (payload: {
    detectionType: DetectionType;
    latitude: number;
    longitude: number;
    gpsAccuracy?: number;
    timestamp: string;
    evidenceImage?: string;
  }) => {
    const response = await fetch('/api/detections/mobile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to submit this camera capture.');
  };

  if (!user) {
    return (
      <LoginPage
        mode={authMode === 'signup' ? 'signup' : 'login'}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
        onForgotPassword={requestPasswordReset}
        onResetPassword={resetAccountPassword}
        errorMessage={authError}
        isSubmitting={authSubmitting}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Topbar */}
      <Topbar
        simulation={simulation}
        wsConnected={wsConnected}
        notifications={user.role === 'main' ? notifications : notifications.filter((notification) =>
          detections.some((detection) => detection.id === notification.relatedDetectionId)
        )}
        onPause={pauseSimulation}
        onResume={resumeSimulation}
        onSetSpeed={setSimulationSpeed}
        onTriggerDetection={triggerManualDetection}
        onResetDemo={resetSimulation}
        onSelectNotification={handleSelectDetectionById}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={(result) => {
          setSearchQuery('');
          if (result.kind === 'bus') {
            const bus = buses.find(item => item.id === result.id);
            if (bus) handleOpenMapForBus(bus);
          } else {
            const detection = detections.find(item => item.id === result.id);
            if (detection) setSelectedDetection(detection);
          }
        }}
        user={user}
        userRole={user.role}
        userDepartment={user.department}
        onOpenAuth={setAuthMode}
        onLogout={handleLogout}
      />

      {/* Main Layout (Sidebar + Content Area) */}
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar
            activeTab={activeTab}
            userRole={user.role}
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
                  userRole={user.role}
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
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-6">
          {activeTab === 'authorities' && user.role === 'main' && (
            <section className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
              <header className="border-b border-slate-200 pb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-800">Main branch administration</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">Department access requests</h1>
                <p className="mt-1 text-sm text-slate-500">Assign each authority to one department before approving dashboard access.</p>
              </header>
              {authorityError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{authorityError}</p>}
              {authorityNotice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{authorityNotice}</p>}
              {authorityRequests.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No authority requests are waiting for review.</p>
              ) : authorityRequests.map((request) => (
                <article key={request.id} className="grid gap-3 border-b border-slate-200 py-4 sm:grid-cols-[1fr_220px_auto] sm:items-center">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900">{request.name}</h2>
                    <p className="truncate text-xs text-slate-500">{request.email}</p>
                    <p className="mt-1 text-xs text-slate-600">Requested: {request.requestedDepartment}</p>
                  </div>
                  <select aria-label={`Assign department to ${request.name}`} defaultValue={request.requestedDepartment} id={`department-${request.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                    {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                  <button onClick={() => {
                    const select = document.getElementById(`department-${request.id}`) as HTMLSelectElement | null;
                    if (select) void approveAuthorityRequest(request.id, select.value as Department);
                  }} className="rounded-lg bg-[#0b4b61] px-4 py-2 text-xs font-bold text-white hover:bg-[#07394a]">Assign and approve</button>
                </article>
              ))}
            </section>
          )}
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

          {activeTab === 'live_camera' && (
            <LiveCamera
              onSubmitDetection={submitMobileDetection}
              onOpenMap={() => setActiveTab('gis_map')}
            />
          )}

          {activeTab === 'real_video' && (
            <RealVideoDetection
              accessToken={sessionToken || ''}
              onVideoAnalyzed={(videoDetections, videoName) => {
                handleVideoAnalysisResult(videoDetections, videoName);
              }}
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
        {user.role === 'main' && <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'overview' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>}

        {user.role === 'main' && <button
          onClick={() => setActiveTab('gis_map')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'gis_map' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>GIS Map</span>
        </button>}

        {user.role === 'main' && <button
          onClick={() => setActiveTab('live_camera')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'live_camera' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Camera</span>
        </button>}

        {user.role === 'main' && <button
          onClick={() => setActiveTab('detections')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'detections' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Detections</span>
        </button>}

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

      {authMode && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setAuthMode(null)}>
          <form onSubmit={handleAuthFormSubmit} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{authMode === 'login' ? 'Log in' : 'Create account'}</h2>
                <p className="text-xs text-slate-500 mt-1">Access the UrbanNex command center.</p>
              </div>
              <button type="button" onClick={() => setAuthMode(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            {authMode === 'signup' && (
              <label className="block mb-3 text-xs font-semibold text-slate-700">Full name
                <input required value={authName} onChange={(event) => setAuthName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </label>
            )}
            <label className="block mb-3 text-xs font-semibold text-slate-700">Email
              <input required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <label className="block mb-5 text-xs font-semibold text-slate-700">Password
              <input required minLength={6} type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </label>
            {authError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{authError}</p>}
            <button type="submit" className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{authMode === 'login' ? 'Log in' : 'Sign up'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
