import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { 
  INITIAL_BUSES, 
  INITIAL_DETECTIONS, 
  INITIAL_ROUTES, 
  DEPARTMENTS 
} from './src/data/seedData.ts';
import { 
  Bus, 
  Detection, 
  IncidentStatus, 
  Department, 
  IncidentHistoryEntry 
} from './src/types/index.ts';
import { DemoInferenceService } from './src/services/aiInference.ts';

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json());

// In-memory persistent state for prototype demonstration
let buses: Bus[] = JSON.parse(JSON.stringify(INITIAL_BUSES));
let detections: Detection[] = JSON.parse(JSON.stringify(INITIAL_DETECTIONS));
let simulationRunning = true;
let simulationSpeedMultiplier: 1 | 2 | 5 = 1;
let detectionCounter = 129;

const demoInference = new DemoInferenceService();

// WebSocket Server on /ws/live
const wss = new WebSocketServer({ server, path: '/ws/live' });

function broadcast(type: string, payload: any) {
  const message = JSON.stringify({ type, data: payload, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('WS broadcast error:', err);
      }
    }
  });
}

// Client connection handling
wss.on('connection', (ws) => {
  console.log(`[WS] Client connected. Total clients: ${wss.clients.size}`);

  // Send initial full state
  ws.send(JSON.stringify({
    type: 'init:state',
    data: {
      buses,
      detections,
      routes: INITIAL_ROUTES,
      departments: DEPARTMENTS,
      simulation: {
        isRunning: simulationRunning,
        speed: simulationSpeedMultiplier,
      },
      modelInfo: demoInference.getModelInfo(),
    },
    timestamp: new Date().toISOString(),
  }));

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      handleClientCommand(parsed, ws);
    } catch (e) {
      console.error('Invalid WS message payload:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Remaining: ${wss.clients.size}`);
  });
});

function handleClientCommand(msg: { action: string; [key: string]: any }, sender?: WebSocket) {
  switch (msg.action) {
    case 'pause':
      simulationRunning = false;
      broadcast('simulation:updated', { isRunning: false, speed: simulationSpeedMultiplier });
      break;
    case 'resume':
      simulationRunning = true;
      broadcast('simulation:updated', { isRunning: true, speed: simulationSpeedMultiplier });
      break;
    case 'set_speed':
      if ([1, 2, 5].includes(msg.speed)) {
        simulationSpeedMultiplier = msg.speed;
        broadcast('simulation:updated', { isRunning: simulationRunning, speed: simulationSpeedMultiplier });
      }
      break;
    case 'trigger_detection':
      triggerSimulatedDetection(msg.busId, msg.detectionType);
      break;
    case 'reset_demo':
      resetSimulation();
      break;
    case 'verify':
      updateIncidentStatus(msg.detectionId, 'verified', 'Command Authority (Quick WS)');
      break;
    case 'assign':
      updateIncidentStatus(msg.detectionId, 'assigned', 'Command Authority (Quick WS)', msg.department);
      break;
    case 'resolve':
      updateIncidentStatus(msg.detectionId, 'resolved', 'Field Inspector (Quick WS)', undefined, msg.notes);
      break;
  }
}

// Distance helper
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Heading helper
function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
            Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return Math.round((brng + 360) % 360);
}

// Move buses along routes
function tickSimulation() {
  if (!simulationRunning) return;

  const stepDistanceKm = (0.018 * simulationSpeedMultiplier); // ~35 km/h over 2-second ticks

  buses = buses.map((bus) => {
    const route = INITIAL_ROUTES.find((r) => r.id === bus.routeId);
    if (!route || route.waypoints.length < 2) return bus;

    const waypoints = route.waypoints;
    const totalSegments = waypoints.length - 1;

    // Advance progress along route
    let newProgress = bus.routeProgress + (0.008 * simulationSpeedMultiplier);
    if (newProgress >= 1) {
      newProgress = 0.001; // Loop back
    }

    const currentSegmentIndex = Math.min(
      totalSegments - 1,
      Math.floor(newProgress * totalSegments)
    );
    const segmentSubProgress = (newProgress * totalSegments) - currentSegmentIndex;

    const p1 = waypoints[currentSegmentIndex];
    const p2 = waypoints[currentSegmentIndex + 1] || waypoints[0];

    const newLat = p1[0] + (p2[0] - p1[0]) * segmentSubProgress;
    const newLng = p1[1] + (p2[1] - p1[1]) * segmentSubProgress;
    const newHeading = calculateHeading(p1[0], p1[1], p2[0], p2[1]) || bus.heading;

    // Slight variance in speed & fps
    const speedVariation = Math.floor(Math.sin(Date.now() / 10000 + parseInt(bus.id.replace('BUS-', ''))) * 5);
    const speed = Math.max(15, Math.min(52, 32 + speedVariation));
    const fps = parseFloat((28.2 + (Math.random() * 1.6)).toFixed(1));

    return {
      ...bus,
      latitude: parseFloat(newLat.toFixed(6)),
      longitude: parseFloat(newLng.toFixed(6)),
      heading: newHeading,
      speed,
      fps,
      routeProgress: newProgress,
      lastSeen: 'Just now',
    };
  });

  // Broadcast updated bus coordinates
  broadcast('bus:fleet_tick', { buses });
}

// Trigger detection helper
async function triggerSimulatedDetection(selectedBusId?: string, forcedType?: string) {
  const targetBus = selectedBusId 
    ? buses.find(b => b.id === selectedBusId) 
    : buses[Math.floor(Math.random() * buses.length)];

  if (!targetBus) return null;

  const result = await demoInference.detect({
    busId: targetBus.id,
    routeId: targetBus.routeId,
    latitude: targetBus.latitude,
    longitude: targetBus.longitude,
    speed: targetBus.speed,
    timestamp: new Date().toISOString(),
  });

  const detectionId = `DET-2026-00${++detectionCounter}`;
  const detectionType = (forcedType as any) || result.type || 'pothole';

  // Nearby location naming based on coordinates
  const locationNames = [
    'Gandhipuram North Cross Rd, Near Signal 4',
    'Avinashi Rd, KMCH Junction',
    'Peelamedu Tech Park Entry, Fun Mall Cross',
    'RS Puram West DB Road',
    'Town Hall South Underpass Corridor',
    '100 Feet Road Elevated Flyover Ramp',
    'Ukkadam Bypass Bus Terminal Access',
    'Cross Cut Commercial District, Ward 12'
  ];
  const locationName = locationNames[Math.floor(Math.random() * locationNames.length)];

  const newDetection: Detection = {
    id: detectionId,
    type: detectionType,
    confidence: result.confidence || 0.935,
    severity: result.severity || 'high',
    latitude: parseFloat((targetBus.latitude + (Math.random() - 0.5) * 0.0006).toFixed(6)),
    longitude: parseFloat((targetBus.longitude + (Math.random() - 0.5) * 0.0006).toFixed(6)),
    locationName,
    busId: targetBus.id,
    routeId: targetBus.routeId,
    timestamp: new Date().toISOString(),
    status: 'pending_verification',
    evidenceImage: result.evidenceKey || 'simulated_pothole_01',
    simulatedBoundingBoxes: result.boundingBoxes,
    roadSurfaceMetric: result.roadSurfaceMetric,
    speedAtDetection: targetBus.speed,
    notes: result.notes || 'Autonomous Edge AI detection via bus forward stereoscopic optical sensor.',
    history: [
      {
        id: `H-${Date.now()}`,
        detectionId,
        previousStatus: 'pending_verification',
        newStatus: 'pending_verification',
        timestamp: new Date().toISOString(),
        changedBy: `Edge AI (${targetBus.id})`,
        note: 'High-confidence inference matched urban hazard model',
      }
    ]
  };

  // Add to top of list
  detections = [newDetection, ...detections.slice(0, 49)];

  // Update target bus stats
  targetBus.totalDetections += 1;
  targetBus.lastDetection = {
    type: detectionType,
    timestamp: 'Just now',
  };

  // Broadcast new detection event
  broadcast('detection:new', {
    detection: newDetection,
    bus: targetBus,
    notification: {
      id: `NOTIF-${Date.now()}`,
      title: `New ${detectionType.replace('_', ' ').toUpperCase()} Detected`,
      message: `${targetBus.id} detected ${detectionType.replace('_', ' ')} at ${locationName} (Confidence: ${(newDetection.confidence * 100).toFixed(1)}%)`,
      type: newDetection.severity === 'critical' ? 'critical' : 'warning',
      timestamp: new Date().toISOString(),
      relatedDetectionId: detectionId,
      relatedBusId: targetBus.id,
    }
  });

  return newDetection;
}

// Update incident status
function updateIncidentStatus(
  id: string, 
  newStatus: IncidentStatus, 
  changedBy: string, 
  department?: Department, 
  note?: string
): Detection | null {
  const index = detections.findIndex(d => d.id === id);
  if (index === -1) return null;

  const current = detections[index];
  const prevStatus = current.status;

  const historyEntry: IncidentHistoryEntry = {
    id: `H-${Date.now()}`,
    detectionId: id,
    previousStatus: prevStatus,
    newStatus,
    timestamp: new Date().toISOString(),
    changedBy,
    note: note || (department ? `Assigned to ${department}` : `Status transitioned to ${newStatus}`),
  };

  const updated: Detection = {
    ...current,
    status: newStatus,
    department: department || current.department,
    notes: note ? `${current.notes ? current.notes + ' | ' : ''}${note}` : current.notes,
    history: [historyEntry, ...current.history],
  };

  detections[index] = updated;

  // Broadcast status update
  broadcast('detection:status_changed', {
    detection: updated,
    notification: {
      id: `NOTIF-${Date.now()}`,
      title: `Incident ${id} Updated`,
      message: `${id} moved to ${newStatus.replace('_', ' ').toUpperCase()}${department ? ` (${department})` : ''}`,
      type: newStatus === 'resolved' ? 'success' : 'info',
      timestamp: new Date().toISOString(),
      relatedDetectionId: id,
    }
  });

  return updated;
}

function resetSimulation() {
  buses = JSON.parse(JSON.stringify(INITIAL_BUSES));
  detections = JSON.parse(JSON.stringify(INITIAL_DETECTIONS));
  simulationRunning = true;
  simulationSpeedMultiplier = 1;
  broadcast('simulation:reset', {
    buses,
    detections,
    simulation: { isRunning: true, speed: 1 },
  });
}

// Run simulation tick every 2 seconds
setInterval(tickSimulation, 2000);

// Auto-generate realistic occasional detection every 14-25 seconds during active simulation
setInterval(() => {
  if (simulationRunning && Math.random() > 0.45) {
    triggerSimulatedDetection();
  }
}, 18000);

// ==================== REST API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Buses
app.get('/api/buses', (req, res) => {
  res.json({ buses, count: buses.length });
});

app.get('/api/buses/:id', (req, res) => {
  const bus = buses.find(b => b.id === req.params.id);
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  res.json(bus);
});

// Detections
app.get('/api/detections', (req, res) => {
  const { type, severity, status, bus_id } = req.query;
  let filtered = [...detections];
  if (type) filtered = filtered.filter(d => d.type === type);
  if (severity) filtered = filtered.filter(d => d.severity === severity);
  if (status) filtered = filtered.filter(d => d.status === status);
  if (bus_id) filtered = filtered.filter(d => d.busId === bus_id);
  res.json({ detections: filtered, total: filtered.length });
});

app.get('/api/detections/:id', (req, res) => {
  const detection = detections.find(d => d.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  res.json(detection);
});

app.post('/api/detections/:id/verify', (req, res) => {
  const updated = updateIncidentStatus(req.params.id, 'verified', req.body.changedBy || 'Command Authority Officer');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/reject', (req, res) => {
  const updated = updateIncidentStatus(req.params.id, 'rejected', req.body.changedBy || 'Command Authority Officer', undefined, req.body.reason || 'False positive detection');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/assign', (req, res) => {
  const { department, changedBy, note } = req.body;
  if (!department) return res.status(400).json({ error: 'Department is required' });
  const updated = updateIncidentStatus(req.params.id, 'assigned', changedBy || 'Authority Lead', department, note);
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/in-progress', (req, res) => {
  const { changedBy, note } = req.body;
  const updated = updateIncidentStatus(req.params.id, 'in_progress', changedBy || 'Field Crew Dispatcher', undefined, note || 'Field repair units mobilized on site');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/resolve', (req, res) => {
  const { changedBy, resolutionNotes } = req.body;
  const updated = updateIncidentStatus(req.params.id, 'resolved', changedBy || 'Senior Civil Inspector', undefined, resolutionNotes || 'Pavement restored and inspected');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

// Routes
app.get('/api/routes', (req, res) => {
  res.json(INITIAL_ROUTES);
});

// Analytics
app.get('/api/analytics', (req, res) => {
  const byType: Record<string, number> = {
    pothole: 0,
    road_damage: 0,
    waterlogging: 0,
    congestion: 0,
    pedestrian_risk: 0,
  };
  const bySeverity: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const byStatus: Record<string, number> = {
    pending_verification: 0,
    verified: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  };

  detections.forEach((d) => {
    byType[d.type] = (byType[d.type] || 0) + 1;
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  });

  const busPerformance = buses.map(b => ({
    busId: b.id,
    route: b.routeName,
    detections: b.totalDetections,
    verified: b.verifiedDetections,
    fps: b.fps,
  }));

  res.json({
    byType,
    bySeverity,
    byStatus,
    busPerformance,
    responseMetrics: {
      avgVerificationMinutes: 4.8,
      avgAssignmentMinutes: 12.3,
      avgResolutionHours: 3.4,
      totalTrackedKmToday: 1840,
    },
    totalDetectionsCount: detections.length,
    activeBusesCount: buses.filter(b => b.status === 'active').length,
  });
});

// System Health
app.get('/api/system/health', (req, res) => {
  const activeBuses = buses.filter(b => b.status === 'active').length;
  res.json({
    webSocketStatus: 'connected',
    apiStatus: 'healthy',
    databaseStatus: 'connected',
    gpsStreamStatus: 'active',
    aiServiceStatus: 'online',
    fleetConnectivity: `${activeBuses} / ${buses.length}`,
    averageLatencyMs: 118,
    eventProcessingRate: 99.4,
    cpuUsage: 24.2,
    memoryUsage: 38.6,
    messagesPerSecond: 18,
    activeClients: wss.clients.size,
    modelName: demoInference.getModelInfo().name,
  });
});

// Simulation controls
app.post('/api/simulation/control', async (req, res) => {
  const { action, speed, busId, detectionType } = req.body;
  if (action === 'pause') {
    simulationRunning = false;
    broadcast('simulation:updated', { isRunning: false, speed: simulationSpeedMultiplier });
    return res.json({ status: 'paused' });
  } else if (action === 'resume') {
    simulationRunning = true;
    broadcast('simulation:updated', { isRunning: true, speed: simulationSpeedMultiplier });
    return res.json({ status: 'resumed' });
  } else if (action === 'set_speed') {
    if ([1, 2, 5].includes(speed)) {
      simulationSpeedMultiplier = speed;
      broadcast('simulation:updated', { isRunning: simulationRunning, speed: simulationSpeedMultiplier });
      return res.json({ status: 'speed_updated', speed });
    }
  } else if (action === 'trigger_detection') {
    const d = await triggerSimulatedDetection(busId, detectionType);
    return res.json({ status: 'detection_generated', detection: d });
  } else if (action === 'reset') {
    resetSimulation();
    return res.json({ status: 'reset_complete' });
  }
  res.status(400).json({ error: 'Invalid action' });
});

// Vite Middleware Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[UrbanNex AI] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[UrbanNex AI] WebSocket endpoint ready at ws://0.0.0.0:${PORT}/ws/live`);
  });
}

startServer();
