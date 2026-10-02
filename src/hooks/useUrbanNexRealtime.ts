import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bus, 
  Detection, 
  RouteData, 
  Department, 
  NotificationItem, 
  SimulationControlState, 
  SystemHealthMetrics, 
  IncidentStatus 
} from '../types';
import { INITIAL_BUSES, INITIAL_DETECTIONS, INITIAL_ROUTES } from '../data/seedData';

function getApiBaseUrl() {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  if (configuredBaseUrl) return configuredBaseUrl;
  return import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
}

function getWebSocketBaseUrl() {
  const configuredBaseUrl = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  if (configuredBaseUrl) return configuredBaseUrl.startsWith('ws') ? configuredBaseUrl : configuredBaseUrl.replace(/^http/, 'ws');
  const origin = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
  return origin.replace(/^http/, 'ws');
}

function apiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function useUrbanNexRealtime() {
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('urbannex-token') : null;
  const demoMode = sessionToken?.startsWith('urbannex-demo:') ?? false;
  const [buses, setBuses] = useState<Bus[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<SimulationControlState>({
    isRunning: true,
    speed: 1,
    activeBusCount: 12,
    totalEventsGenerated: INITIAL_DETECTIONS.length,
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'init-1',
      title: 'UrbanNex Fleet Active',
      message: '12 pilot buses synchronized on live GPS and Edge AI stream.',
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false,
    },
    {
      id: 'init-2',
      title: 'Waterlogging Alert',
      message: 'BUS-008 flagged critical water pooling near Town Hall Underpass.',
      type: 'critical',
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      read: false,
      relatedDetectionId: 'DET-2026-00127',
      relatedBusId: 'BUS-008',
    }
  ]);

  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics>({
    webSocketStatus: 'connecting',
    apiStatus: 'healthy',
    databaseStatus: 'connected',
    gpsStreamStatus: 'active',
    aiServiceStatus: 'online',
    fleetConnectivity: '12 / 12',
    averageLatencyMs: 114,
    eventProcessingRate: 99.3,
    cpuUsage: 22.4,
    memoryUsage: 36.8,
    messagesPerSecond: 16,
    history: Array.from({ length: 12 }).map((_, i) => ({
      timestamp: `${12 - i}m ago`,
      cpu: 20 + Math.floor(Math.random() * 8),
      memory: 34 + Math.floor(Math.random() * 6),
      latency: 110 + Math.floor(Math.random() * 20),
      events: 8 + Math.floor(Math.random() * 7),
    })),
  });

  const pollingRef = useRef<number | null>(null);
  const eventCursorRef = useRef<number>(0);

  const pollLiveData = useCallback(async () => {
    if (!sessionToken || demoMode) return;
    const headers = { Authorization: `Bearer ${sessionToken}` };

    try {
      const stateResponse = await fetch(apiUrl('/api/live/state'), { headers });
      if (stateResponse.ok) {
        const state = await stateResponse.json();
        if (state.buses) setBuses(state.buses);
        if (state.detections) setDetections(state.detections);
        if (state.routes) setRoutes(state.routes);
        if (state.simulation) {
          setSimulation(prev => ({
            ...prev,
            isRunning: state.simulation.isRunning,
            speed: state.simulation.speed,
          }));
        }
      }
    } catch (error) {
      console.warn('[UrbanNex Client] Live state poll failed:', error);
    }

    try {
      const eventsResponse = await fetch(`${apiUrl('/api/live/events')}?after=${eventCursorRef.current}&limit=25`, { headers });
      if (!eventsResponse.ok) return;
      const eventsPayload = await eventsResponse.json();
      const events = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];
      for (const event of events) {
        eventCursorRef.current = Math.max(eventCursorRef.current, Number(event.id || 0));
        const { type, data } = event;

        if (type === 'detection:new') {
          const newDet: Detection = data.detection;
          setDetections(prev => (prev.some(d => d.id === newDet.id) ? prev : [newDet, ...prev]));
          if (data.notification) {
            setNotifications(prev => [data.notification, ...prev.slice(0, 24)]);
          }
        } else if (type === 'detection:status_changed') {
          const updatedDet: Detection = data.detection;
          setDetections(prev => prev.map(d => d.id === updatedDet.id ? updatedDet : d));
          setSelectedDetection(prev => (prev && prev.id === updatedDet.id ? updatedDet : prev));
          if (data.notification) {
            setNotifications(prev => [data.notification, ...prev.slice(0, 24)]);
          }
        } else if (type === 'simulation:updated') {
          setSimulation(prev => ({
            ...prev,
            isRunning: data.isRunning,
            speed: data.speed,
          }));
        }
      }
    } catch (error) {
      console.warn('[UrbanNex Client] Event poll failed:', error);
    }
  }, [demoMode, sessionToken]);

  useEffect(() => {
    if (!sessionToken || demoMode) return;

    setWsConnected(true);
    setSystemHealth(prev => ({ ...prev, webSocketStatus: 'connected' }));
    void pollLiveData();

    const headers = { Authorization: `Bearer ${sessionToken}` };
    fetch(apiUrl('/api/buses'), { headers })
      .then(r => r.json())
      .then(d => { if (d.buses) setBuses(d.buses); })
      .catch(() => {});

    fetch(apiUrl('/api/detections'), { headers })
      .then(r => r.json())
      .then(d => { if (d.detections) setDetections(d.detections); })
      .catch(() => {});

    pollingRef.current = window.setInterval(() => {
      void pollLiveData();
    }, 6000);

    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [demoMode, pollLiveData, sessionToken]);

  const sendCommand = useCallback((cmd: any) => {
    if (demoMode) return;
    const headers = { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) };

    if (cmd.action === 'verify' && cmd.detectionId) {
      fetch(apiUrl(`/api/detections/${cmd.detectionId}/verify`), { method: 'POST', headers }).catch(() => {});
    } else if (cmd.action === 'assign' && cmd.detectionId) {
      fetch(apiUrl(`/api/detections/${cmd.detectionId}/assign`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ department: cmd.department, note: cmd.note }),
      }).catch(() => {});
    } else if (cmd.action === 'resolve' && cmd.detectionId) {
      fetch(apiUrl(`/api/detections/${cmd.detectionId}/resolve`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolutionNotes: cmd.notes }),
      }).catch(() => {});
    } else {
      fetch(apiUrl('/api/simulation/control'), {
        method: 'POST',
        headers,
        body: JSON.stringify(cmd),
      }).catch(() => {});
    }
  }, [demoMode, sessionToken]);

  const verifyDetection = useCallback((id: string) => {
    // Optimistic update
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'verified' as IncidentStatus } : d));
    sendCommand({ action: 'verify', detectionId: id });
  }, [sendCommand]);

  const rejectDetection = useCallback((id: string, reason?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' as IncidentStatus } : d));
    fetch(apiUrl(`/api/detections/${id}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  }, [sessionToken]);

  const assignDepartment = useCallback((id: string, department: Department, note?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'assigned' as IncidentStatus, department } : d));
    sendCommand({ action: 'assign', detectionId: id, department, note });
  }, [sendCommand]);

  const markInProgress = useCallback((id: string, note?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'in_progress' as IncidentStatus } : d));
    fetch(apiUrl(`/api/detections/${id}/in-progress`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      body: JSON.stringify({ note }),
    }).catch(() => {});
  }, [sessionToken]);

  const resolveIncident = useCallback((id: string, notes?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'resolved' as IncidentStatus } : d));
    sendCommand({ action: 'resolve', detectionId: id, notes });
  }, [sendCommand]);

  const pauseSimulation = useCallback(() => {
    sendCommand({ action: 'pause' });
  }, [sendCommand]);

  const resumeSimulation = useCallback(() => {
    sendCommand({ action: 'resume' });
  }, [sendCommand]);

  const setSimulationSpeed = useCallback((speed: 1 | 2 | 3) => {
    sendCommand({ action: 'set_speed', speed });
  }, [sendCommand]);

  const triggerManualDetection = useCallback((busId?: string, detectionType?: string) => {
    sendCommand({ action: 'trigger_detection', busId, detectionType });
  }, [sendCommand]);

  const resetSimulation = useCallback(() => {
    sendCommand({ action: 'reset_demo' });
  }, [sendCommand]);

  const submitMobileDetection = useCallback((payload: {
    detectionType: Detection['type'];
    latitude: number;
    longitude: number;
    gpsAccuracy?: number;
    timestamp: string;
    evidenceImage?: string;
  }) => {
    sendCommand({ action: 'mobile_detection', ...payload });
  }, [sendCommand]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const appendDetections = useCallback((incoming: Detection[]) => {
    if (!incoming.length) return;
    setDetections(prev => {
      const ids = new Set(prev.map(d => d.id));
      const merged = [...incoming, ...prev].filter(d => !ids.has(d.id) || !prev.some(item => item.id === d.id));
      return merged;
    });
  }, []);

  return {
    buses,
    detections,
    routes,
    selectedDetection,
    setSelectedDetection,
    selectedBus,
    setSelectedBus,
    wsConnected,
    simulation,
    notifications,
    systemHealth,
    verifyDetection,
    rejectDetection,
    assignDepartment,
    markInProgress,
    resolveIncident,
    pauseSimulation,
    resumeSimulation,
    setSimulationSpeed,
    triggerManualDetection,
    submitMobileDetection,
    resetSimulation,
    markNotificationRead,
    clearAllNotifications,
    appendDetections,
  };
}
