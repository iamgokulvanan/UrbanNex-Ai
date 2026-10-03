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
import { RealVideoDetection } from './components/detections/RealVideoDetection';
import { DetectionDrawer } from './components/detections/DetectionDrawer';
import { LoginPage } from './components/auth/LoginPage';
import { AuthorityManagementPage } from './components/authorities/AuthorityManagementPage';
import { Detection, Bus, Department, DetectionType } from './types';
import { DEPARTMENTS, isDetectionSuitableForDepartment } from './data/seedData';
import { 
  LayoutDashboard, 
  MapPin, 
  Activity, 
  ScanSearch,
  Bus as BusIcon, 
  Kanban, 
  Menu, 
  X,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';

class ApiResponseError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const message = response.status === 404
      ? 'The authentication API route was not found (HTTP 404). Check that the backend API function is deployed.'
      : response.status >= 500
        ? `The authentication backend returned HTTP ${response.status}. Check the server and database logs.`
        : `The authentication API returned an unexpected HTTP ${response.status} response.`;
    throw new ApiResponseError(
      message,
      response.status,
      'INVALID_API_RESPONSE',
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ApiResponseError('The API returned malformed JSON.', response.status, 'INVALID_API_RESPONSE');
  }
}

function getApiBaseUrl() {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  if (configuredBaseUrl) return configuredBaseUrl;
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return window.location.origin;
}

function apiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
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
  const [authorityRequests, setAuthorityRequests] = useState<Array<{ id: number; name: string; email: string; requestedDepartment: Department | null; createdAt: string }>>([]);
  const [authorityRoster, setAuthorityRoster] = useState<Array<{ id: number; name: string; email: string; role: 'main' | 'department'; department: Department | null; createdAt: string; lastLoginAt?: string }>>([]);
  const [authorityActivity, setAuthorityActivity] = useState<Array<{ id: number; eventType: string; payload: any; timestamp: string }>>([]);
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
    fetch(apiUrl('/api/auth/me'), { headers: { Authorization: `Bearer ${sessionToken}` } })
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
      void loadAuthorityData(sessionToken || '');
    } else {
      if (!['workflow', 'incidents', 'gis_map', 'real_video', 'overview'].includes(activeTab)) {
        setActiveTab('workflow');
      }
    }
  }, [user, sessionToken]);

  useEffect(() => {
    if (user?.role === 'main' && activeTab === 'authorities' && sessionToken) {
      void loadAuthorityData(sessionToken);
    }
  }, [activeTab, user?.role, sessionToken]);

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

  // Scope detections: authority users only access their department's suitable problems and solve workflows
  const visibleDetections = user?.role === 'department' && user.department
    ? detections.filter(d => isDetectionSuitableForDepartment(d, user.department!))
    : detections;

  const pendingCount = visibleDetections.filter(d => d.status === 'pending_verification' || (user?.role === 'department' && d.status === 'assigned')).length;
  const criticalCount = visibleDetections.filter(d => d.severity === 'critical' && d.status !== 'resolved').length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch ? [
    ...buses
      .filter(bus => [bus.id, bus.busNumber, bus.routeName, bus.driverName].some(value => value.toLowerCase().includes(normalizedSearch)))
      .slice(0, 5)
      .map(bus => ({ id: bus.id, label: bus.id, detail: `${bus.routeName} · ${bus.driverName}`, kind: 'bus' as const })),
    ...visibleDetections
      .filter(detection => [detection.id, detection.locationName, detection.busId, detection.type].some(value => value.toLowerCase().includes(normalizedSearch)))
      .slice(0, 5)
      .map(detection => ({ id: detection.id, label: detection.id, detail: `${detection.type.replace('_', ' ')} · ${detection.locationName}`, kind: 'detection' as const })),
  ].slice(0, 8) : [];

  const handleAuthSubmit = async ({ 
    name, 
    email, 
    password, 
    accountType, 
    department, 
    action 
  }: { 
    name: string; 
    email: string; 
    password: string; 
    accountType?: 'main' | 'department'; 
    department?: Department;
    action?: 'login' | 'signup';
  }) => {
    setAuthSubmitting(true);
    setAuthError('');
    setAuthorityNotice('');
    const normalizedEmail = email.trim().toLowerCase();
    const targetAction = action || (authMode === 'signup' ? 'signup' : 'login');
    const endpoint = `/api/auth/${targetAction}`;

    // Resilience fallback: lookup client approved roster or registered authority profile if available
    let clientRosterUser: any = undefined;
    if (targetAction === 'login') {
      try {
        const raw = localStorage.getItem('urbannex_authority_approved_roster');
        if (raw) {
          const list = JSON.parse(raw);
          clientRosterUser = list.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        }
        if (!clientRosterUser) {
          const rawReg = localStorage.getItem('urbannex_registered_authority');
          if (rawReg) {
            const reg = JSON.parse(rawReg);
            if (reg.email?.toLowerCase() === normalizedEmail) {
              clientRosterUser = reg;
            }
          }
        }
      } catch {}
    }

    try {
      let response: Response;
      try {
        response = await fetch(apiUrl(endpoint), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password, accountType, department, clientRosterUser }),
        });
      } catch {
        let healthAvailable = false;
        try {
          const healthResponse = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
          healthAvailable = healthResponse.ok && (healthResponse.headers.get('content-type') || '').includes('application/json');
        } catch {
          healthAvailable = false;
        }
        throw new ApiResponseError(
          healthAvailable
            ? `The backend is running, but ${endpoint} could not be reached. Check the deployed API route.`
            : `Cannot reach the UrbanNex backend at ${getApiBaseUrl()}. Configure VITE_API_BASE_URL in the frontend environment and retry.`,
          0,
          healthAvailable ? 'AUTH_ROUTE_UNAVAILABLE' : 'BACKEND_UNAVAILABLE',
        );
      }
      const data = await readApiResponse(response);
      if (response.status === 202 && data.pendingApproval) {
        const newReq = data.request || {
          id: Date.now(),
          name: name.trim(),
          email: normalizedEmail,
          requestedDepartment: department || null,
          createdAt: new Date().toISOString(),
        };
        try {
          const raw = localStorage.getItem('urbannex_authority_pending_queue');
          const existing: any[] = raw ? JSON.parse(raw) : [];
          const filtered = existing.filter((r: any) => r.email.toLowerCase() !== newReq.email.toLowerCase());
          filtered.push(newReq);
          localStorage.setItem('urbannex_authority_pending_queue', JSON.stringify(filtered));
          localStorage.setItem('urbannex_registered_authority', JSON.stringify({
            ...newReq,
            department: newReq.requestedDepartment || department || 'Roads & Infrastructure',
            role: 'department',
          }));
        } catch {}

        setAuthorityRequests(prev => {
          const filtered = prev.filter(r => r.email.toLowerCase() !== newReq.email.toLowerCase());
          return [...filtered, newReq];
        });
        setAuthorityNotice(data.message || 'Your account request was sent to the main branch for approval.');
        setAuthMode('login');
        return;
      }
      if (!response.ok) {
        throw new ApiResponseError(data.error || 'Unable to authenticate.', response.status, data.code);
      }
      localStorage.setItem('urbannex-token', data.token);
      setSessionToken(data.token);
      setUser(data.user);
      setAuthMode(null);
    } catch (error) {
      if (error instanceof ApiResponseError) {
        if (error.code === 'INVALID_CREDENTIALS') {
          setAuthError('Email or password is incorrect.');
        } else if (error.code === 'AUTHORITY_TYPE_MISMATCH') {
          setAuthError('This account is not authorized for the selected authority desk.');
        } else if (error.code === 'DEPARTMENT_PENDING') {
          setAuthError('Department access is waiting for main-branch approval.');
        } else if (error.code === 'DATABASE_UNAVAILABLE') {
          setAuthError('The authentication database is unavailable. Check the backend database configuration.');
        } else if (error.status >= 500) {
          setAuthError(`Authentication service error (HTTP ${error.status}). Check the backend logs.`);
        } else {
          setAuthError(error.message);
        }
      } else {
        setAuthError(error instanceof Error ? error.message : 'Unable to authenticate.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const loadAuthorityData = async (token: string) => {
    try {
      let localQueued: any[] = [];
      try {
        const raw = localStorage.getItem('urbannex_authority_pending_queue');
        if (raw) localQueued = JSON.parse(raw);
      } catch {}

      let localRoster: any[] = [];
      try {
        const raw = localStorage.getItem('urbannex_authority_approved_roster');
        if (raw) localRoster = JSON.parse(raw);
      } catch {}

      if ((localQueued.length > 0 || localRoster.length > 0) && token) {
        fetch(apiUrl('/api/admin/sync-authority-requests'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ requests: localQueued, approvedRoster: localRoster }),
        }).catch(() => {});
      }

      const response = await fetch(apiUrl('/api/admin/authorities'), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Could not load department access requests and authority roster.');
      const data = await response.json();
      
      const serverRequests: any[] = data.requests || [];
      const serverRoster: any[] = data.roster || [];

      // Merge server requests with local queued requests (avoid duplicates)
      const mergedRequests = [...serverRequests];
      for (const loc of localQueued) {
        const inServer = serverRequests.some(s => s.email.toLowerCase() === loc.email.toLowerCase() || s.id === loc.id);
        const inRoster = serverRoster.some(r => r.email.toLowerCase() === loc.email.toLowerCase());
        if (!inServer && !inRoster) {
          mergedRequests.push(loc);
        }
      }

      const mergedRoster = [...serverRoster];
      for (const loc of localRoster) {
        if (!mergedRoster.some(r => r.email.toLowerCase() === loc.email.toLowerCase())) {
          mergedRoster.push(loc);
        }
      }

      setAuthorityRequests(mergedRequests);
      setAuthorityRoster(mergedRoster);
      setAuthorityActivity(data.activity || []);
      setAuthorityError('');
    } catch (error) {
      try {
        const raw = localStorage.getItem('urbannex_authority_pending_queue');
        if (raw) setAuthorityRequests(JSON.parse(raw));
      } catch {}
      setAuthorityError(error instanceof Error ? error.message : 'Could not load department access requests.');
    }
  };

  const approveAuthorityRequest = async (id: number, department: Department) => {
    if (!sessionToken) return;
    const reqObj = authorityRequests.find(r => r.id === id);
    try {
      const response = await fetch(apiUrl(`/api/admin/authority-requests/${id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ 
          department, 
          email: reqObj?.email,
          name: reqObj?.name,
          passwordHash: (reqObj as any)?.passwordHash,
          passwordSalt: (reqObj as any)?.passwordSalt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthorityError(data.error || 'Could not approve the authority request.');
        return;
      }

      // Update local storage queues immediately
      try {
        const rawPending = localStorage.getItem('urbannex_authority_pending_queue');
        if (rawPending) {
          const list = JSON.parse(rawPending);
          const updated = list.filter((r: any) => r.id !== id && (!reqObj || r.email.toLowerCase() !== reqObj.email.toLowerCase()));
          localStorage.setItem('urbannex_authority_pending_queue', JSON.stringify(updated));
        }

        const rawRoster = localStorage.getItem('urbannex_authority_approved_roster');
        const rosterList = rawRoster ? JSON.parse(rawRoster) : [];
        if (reqObj) {
          rosterList.push({
            id,
            name: reqObj.name,
            email: reqObj.email,
            role: 'department',
            department,
            createdAt: reqObj.createdAt,
            passwordHash: (reqObj as any)?.passwordHash,
            passwordSalt: (reqObj as any)?.passwordSalt,
          });
          localStorage.setItem('urbannex_authority_approved_roster', JSON.stringify(rosterList));
        }
      } catch {}

      // Update state immediately
      setAuthorityRequests(prev => prev.filter(r => r.id !== id && (!reqObj || r.email.toLowerCase() !== reqObj.email.toLowerCase())));
      if (reqObj) {
        setAuthorityRoster(prev => [
          ...prev.filter(r => (!reqObj || r.email.toLowerCase() !== reqObj.email.toLowerCase())),
          {
            id,
            name: reqObj.name,
            email: reqObj.email,
            role: 'department',
            department,
            createdAt: reqObj.createdAt,
          }
        ]);
      }

      setAuthorityError('');
      const officerName = reqObj?.name || data.approvalDetails?.officerName || 'Officer';
      const officerEmail = reqObj?.email || data.approvalDetails?.officerEmail || 'the officer email';
      setAuthorityNotice(
        `Official access approved for ${officerName} (${department})! Full clearance and login instructions dispatched to ${officerEmail}. The officer can now log in anytime.`
      );
      void loadAuthorityData(sessionToken);
    } catch (e) {
      setAuthorityError(e instanceof Error ? e.message : 'Could not approve the authority request.');
    }
  };

  const handleForgotPassword = async (email: string) => {
    const response = await fetch(apiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || 'Failed to send password reset request.');
    return data;
  };

  const handleResetPassword = async (
    arg1: { token: string; email?: string; newPassword?: string; password?: string } | string,
    arg2?: string,
    arg3?: string
  ) => {
    let email = '';
    let token = '';
    let password = '';
    if (typeof arg1 === 'object') {
      email = arg1.email || '';
      token = arg1.token || '';
      password = arg1.newPassword || arg1.password || '';
    } else {
      email = arg1 || '';
      token = arg2 || '';
      password = arg3 || '';
    }
    const response = await fetch(apiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.trim().toLowerCase(), 
        token: token.trim(), 
        password, 
        newPassword: password 
      }),
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || 'Failed to reset password.');
    if (data.token && data.user) {
      localStorage.setItem('urbannex-token', data.token);
      setSessionToken(data.token);
      setUser(data.user);
      setAuthMode(null);
    }
    if (data.credentials) {
      try {
        const norm = email.trim().toLowerCase();
        const regRaw = localStorage.getItem('urbannex_registered_authority');
        if (regRaw) {
          const reg = JSON.parse(regRaw);
          if (reg?.email?.toLowerCase() === norm) {
            reg.passwordHash = data.credentials.passwordHash;
            reg.passwordSalt = data.credentials.passwordSalt;
            localStorage.setItem('urbannex_registered_authority', JSON.stringify(reg));
          }
        }
        const rosterRaw = localStorage.getItem('urbannex_authority_approved_roster');
        if (rosterRaw) {
          const list = JSON.parse(rosterRaw);
          if (Array.isArray(list)) {
            const updated = list.map((item: any) => {
              if (item?.email?.toLowerCase() === norm) {
                return { ...item, passwordHash: data.credentials.passwordHash, passwordSalt: data.credentials.passwordSalt };
              }
              return item;
            });
            localStorage.setItem('urbannex_authority_approved_roster', JSON.stringify(updated));
          }
        }
      } catch {}
    }
    return data;
  };

  const handleLogout = () => {
    if (sessionToken) {
      fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } }).catch(() => {});
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
    locationName?: string;
    latitude?: number;
    longitude?: number;
    department?: Department;
    status?: IncidentStatus;
    assignedTo?: string;
    notes?: string;
  }>, mediaName?: string, options?: { targetTab?: NavTab }) => {
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
        const detectionId = `DET-AI-${Date.now()}-${index + 1}`;
        const createdAt = new Date().toISOString();
        const initialStatus = detection.status || (detection.department ? 'assigned' : 'pending_verification');

        return {
          id: detectionId,
          type: resolvedType,
          confidence,
          severity: detection.severity ?? mapToSeverity(resolvedType, confidence),
          latitude: detection.latitude ?? (fallbackBus.latitude + (index + 1) * 0.0002),
          longitude: detection.longitude ?? (fallbackBus.longitude + (index + 1) * 0.00015),
          locationName: detection.locationName || (mediaName ? `AI Analysis · ${mediaName}` : 'AI Analysis Detection'),
          busId: fallbackBus.id,
          routeId: fallbackBus.routeId,
          timestamp: createdAt,
          status: initialStatus,
          department: detection.department,
          assignedTo: detection.assignedTo,
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
          roadSurfaceMetric: `AI classification (${resolvedType.replace('_', ' ')})`,
          notes: detection.notes || `Detected from ${mediaName || 'AI Analyzer'}. Type: ${resolvedType.replace('_', ' ')}.`,
          history: [{
            id: `H-${Date.now()}-${index}`,
            detectionId,
            previousStatus: 'pending_verification',
            newStatus: initialStatus,
            timestamp: createdAt,
            changedBy: detection.assignedTo ? `Authority Dispatch (${detection.assignedTo})` : 'AI Analyzer System',
            note: detection.notes || (detection.department ? `Work order assigned to ${detection.department}.` : 'AI detected anomaly.'),
          }],
        } satisfies Detection;
      });

    if (!mapped.length) return;
    let persistedDetections = mapped;
    try {
      const response = await fetch(apiUrl('/api/detections/import-video'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ detections: mapped }),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.detections) && data.detections.length) {
          persistedDetections = data.detections as Detection[];
        }
      }
    } catch (e) {
      console.warn('[AI Analyzer] Syncing to import-video endpoint deferred, persisting locally:', e);
    }
    appendDetections(persistedDetections);
    setSelectedDetection(persistedDetections[0]);
    if (options?.targetTab) {
      setActiveTab(options.targetTab);
    }
  };

  const submitMobileDetection = async (payload: {
    detectionType: DetectionType;
    latitude: number;
    longitude: number;
    gpsAccuracy?: number;
    timestamp: string;
    evidenceImage?: string;
  }) => {
    const response = await fetch(apiUrl('/api/detections/mobile'), {
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
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        errorMessage={authError}
        successMessage={authorityNotice}
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
          visibleDetections.some((detection) => detection.id === notification.relatedDetectionId)
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
            const detection = visibleDetections.find(item => item.id === result.id);
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
            userDepartment={user.department}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            activeBusCount={buses.filter(b => b.status === 'active').length}
            pendingCount={pendingCount}
            criticalCount={criticalCount}
            pendingAuthorityCount={authorityRequests.length}
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
                  userDepartment={user.department}
                  onSelectTab={(tab) => {
                    setActiveTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  activeBusCount={buses.filter(b => b.status === 'active').length}
                  pendingCount={pendingCount}
                  criticalCount={criticalCount}
                  pendingAuthorityCount={authorityRequests.length}
                />
              </div>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-6">
          {activeTab === 'authorities' && user.role === 'main' && (
            <AuthorityManagementPage
              authorityRequests={authorityRequests}
              requests={authorityRequests}
              authorityRoster={authorityRoster}
              roster={authorityRoster}
              authorityActivity={authorityActivity}
              activity={authorityActivity}
              detections={detections}
              onApproveRequest={approveAuthorityRequest}
              onAssignDepartment={assignDepartment}
              onRerouteDetection={(detectionId, department, note) => {
                assignDepartment(detectionId, department, note);
              }}
              onSelectDetection={setSelectedDetection}
              onNavigateTab={setActiveTab}
              onRefresh={() => sessionToken && loadAuthorityData(sessionToken)}
              notice={authorityNotice}
              error={authorityError}
            />
          )}
          {activeTab === 'overview' && (
            <OverviewDashboard
              buses={buses}
              detections={visibleDetections}
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

          {activeTab === 'real_video' && (
            <RealVideoDetection
              accessToken={sessionToken || ''}
              onVideoAnalyzed={(videoDetections, videoName, options) => {
                return handleVideoAnalysisResult(videoDetections, videoName, options);
              }}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'gis_map' && (
            <div className="h-[calc(100vh-4rem)]">
              <MapView
                buses={buses}
                detections={visibleDetections}
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
                  detections={visibleDetections}
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
              detections={visibleDetections}
              onTriggerDetection={triggerManualDetection}
            />
          )}

          {activeTab === 'workflow' && (
            <WorkflowBoard
              detections={visibleDetections}
              onSelectDetection={setSelectedDetection}
              onVerify={verifyDetection}
              onAssign={assignDepartment}
              onInProgress={markInProgress}
              onResolve={resolveIncident}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentsPage
              detections={visibleDetections}
              onSelectDetection={setSelectedDetection}
              onVerify={verifyDetection}
              onResolve={resolveIncident}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage
              detections={visibleDetections}
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
        {user.role === 'main' && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'overview' ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>
        )}

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

        {user.role === 'department' && (
          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'incidents' ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Incidents</span>
          </button>
        )}

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
          onClick={() => setActiveTab('real_video')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'real_video' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <ScanSearch className="w-4 h-4" />
          <span>AI Vision</span>
        </button>

        {user.role === 'main' && (
          <button
            onClick={() => setActiveTab('detections')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'detections' ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Detections</span>
          </button>
        )}

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
