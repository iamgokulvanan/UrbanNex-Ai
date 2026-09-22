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

export function useUrbanNexRealtime() {
  const demoMode = typeof window !== 'undefined' && localStorage.getItem('urbannex-token')?.startsWith('urbannex-demo:');
  const [buses, setBuses] = useState<Bus[]>(INITIAL_BUSES);
  const [detections, setDetections] = useState<Detection[]>(INITIAL_DETECTIONS);
  const [routes, setRoutes] = useState<RouteData[]>(INITIAL_ROUTES);
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

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connectWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/live`;

      console.log('[UrbanNex Client] Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[UrbanNex Client] Connected to /ws/live');
        setWsConnected(true);
        setSystemHealth(prev => ({ ...prev, webSocketStatus: 'connected' }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { type, data } = payload;

          if (type === 'init:state') {
            if (data.buses) setBuses(data.buses);
            if (data.detections) setDetections(data.detections);
            if (data.routes) setRoutes(data.routes);
            if (data.simulation) {
              setSimulation(prev => ({
                ...prev,
                isRunning: data.simulation.isRunning,
                speed: data.simulation.speed,
              }));
            }
          } else if (type === 'bus:fleet_tick') {
            if (data.buses) {
              setBuses(data.buses);
              // Also update selectedBus if open
              setSelectedBus(prev => {
                if (!prev) return null;
                const updated = data.buses.find((b: Bus) => b.id === prev.id);
                return updated || prev;
              });
            }
          } else if (type === 'detection:new') {
            const newDet: Detection = data.detection;
            setDetections(prev => {
              if (prev.some(d => d.id === newDet.id)) return prev;
              return [newDet, ...prev];
            });

            if (data.notification) {
              setNotifications(prev => [data.notification, ...prev.slice(0, 24)]);
            }

            setSimulation(prev => ({
              ...prev,
              totalEventsGenerated: prev.totalEventsGenerated + 1,
              lastEventTime: new Date().toLocaleTimeString(),
            }));
          } else if (type === 'detection:status_changed') {
            const updatedDet: Detection = data.detection;
            setDetections(prev => prev.map(d => d.id === updatedDet.id ? updatedDet : d));
            setSelectedDetection(prev => prev && prev.id === updatedDet.id ? updatedDet : prev);

            if (data.notification) {
              setNotifications(prev => [data.notification, ...prev.slice(0, 24)]);
            }
          } else if (type === 'simulation:updated') {
            setSimulation(prev => ({
              ...prev,
              isRunning: data.isRunning,
              speed: data.speed,
            }));
          } else if (type === 'simulation:reset') {
            setBuses(data.buses);
            setDetections(data.detections);
            setSimulation(prev => ({
              ...prev,
              isRunning: data.simulation.isRunning,
              speed: data.simulation.speed,
            }));
          }
        } catch (err) {
          console.error('[UrbanNex Client] Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        console.warn('[UrbanNex Client] WS disconnected. Reconnecting in 3s...');
        setWsConnected(false);
        setSystemHealth(prev => ({ ...prev, webSocketStatus: 'disconnected' }));
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (err) => {
        console.error('[UrbanNex Client] WS Error:', err);
        ws.close();
      };
    } catch (e) {
      console.error('[UrbanNex Client] WebSocket init failed:', e);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
    }
  }, [demoMode]);

  useEffect(() => {
    connectWebSocket();

    // Fallback initial fetch via REST
    fetch('/api/buses')
      .then(r => r.json())
      .then(d => { if (d.buses) setBuses(d.buses); })
      .catch(() => {});

    fetch('/api/detections')
      .then(r => r.json())
      .then(d => { if (d.detections) setDetections(d.detections); })
      .catch(() => {});

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  // Send WS or REST commands
  const sendCommand = useCallback((cmd: any) => {
    if (demoMode) {
      if (cmd.action === 'pause' || cmd.action === 'resume') {
        setSimulation(prev => ({ ...prev, isRunning: cmd.action === 'resume' }));
      } else if (cmd.action === 'set_speed') {
        setSimulation(prev => ({ ...prev, speed: cmd.speed }));
      } else if (cmd.action === 'reset_demo') {
        setBuses(INITIAL_BUSES);
        setDetections(INITIAL_DETECTIONS);
        setSimulation(prev => ({ ...prev, isRunning: true, speed: 1, totalEventsGenerated: INITIAL_DETECTIONS.length }));
      } else if (cmd.action === 'trigger_detection') {
        setSimulation(prev => ({ ...prev, totalEventsGenerated: prev.totalEventsGenerated + 1, lastEventTime: new Date().toLocaleTimeString() }));
      }
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    } else {
      // Fallback to REST API
      if (cmd.action === 'verify' && cmd.detectionId) {
        fetch(`/api/detections/${cmd.detectionId}/verify`, { method: 'POST' }).catch(() => {});
      } else if (cmd.action === 'assign' && cmd.detectionId) {
        fetch(`/api/detections/${cmd.detectionId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: cmd.department }),
        }).catch(() => {});
      } else if (cmd.action === 'resolve' && cmd.detectionId) {
        fetch(`/api/detections/${cmd.detectionId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolutionNotes: cmd.notes }),
        }).catch(() => {});
      } else {
        fetch('/api/simulation/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd),
        }).catch(() => {});
      }
    }
  }, [demoMode]);

  const verifyDetection = useCallback((id: string) => {
    // Optimistic update
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'verified' as IncidentStatus } : d));
    sendCommand({ action: 'verify', detectionId: id });
  }, [sendCommand]);

  const rejectDetection = useCallback((id: string, reason?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' as IncidentStatus } : d));
    fetch(`/api/detections/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  }, []);

  const assignDepartment = useCallback((id: string, department: Department, note?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'assigned' as IncidentStatus, department } : d));
    sendCommand({ action: 'assign', detectionId: id, department, note });
  }, [sendCommand]);

  const markInProgress = useCallback((id: string, note?: string) => {
    setDetections(prev => prev.map(d => d.id === id ? { ...d, status: 'in_progress' as IncidentStatus } : d));
    fetch(`/api/detections/${id}/in-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }).catch(() => {});
  }, []);

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
