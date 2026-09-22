import express from 'express';
import http from 'http';
import path from 'path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import Database from 'better-sqlite3';
import multer from 'multer';
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
  IncidentHistoryEntry,
  DetectionType,
  SeverityLevel,
} from './src/types/index.ts';
import { DemoInferenceService } from './src/services/aiInference.ts';

export const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json({ limit: '5mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

const database = new Database(path.join(process.cwd(), 'urbannex.db'));
database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mobile_detections (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

type AuthUser = { id: number; name: string; email: string };

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

function getUserByToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  const user = database.prepare(`
    SELECT users.id, users.name, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token) as AuthUser | undefined;
  return user || null;
}

function getBearerToken(req: express.Request) {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

function createSession(user: AuthUser) {
  const token = randomBytes(32).toString('hex');
  database.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, user.id, new Date().toISOString());
  return { token, user };
}

// In-memory persistent state for prototype demonstration
let buses: Bus[] = JSON.parse(JSON.stringify(INITIAL_BUSES));
let detections: Detection[] = JSON.parse(JSON.stringify(INITIAL_DETECTIONS));
let simulationRunning = true;
let simulationSpeedMultiplier: 1 | 2 | 3 = 1;
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
      if ([1, 2, 3].includes(msg.speed)) {
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

function makeDetectionSvg(x1: number, y1: number, x2: number, y2: number, confidence: number, frame: number) {
  const width = 640;
  const height = 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="road" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#e2e8f0"/>
      <rect x="0" y="220" width="640" height="140" fill="url(#road)"/>
      <path d="M0 220 L200 120 L440 120 L640 220" fill="#475569" opacity="0.7"/>
      <line x1="320" y1="120" x2="320" y2="220" stroke="#f8fafc" stroke-width="3" stroke-dasharray="18 15"/>
      <rect x="${x1}" y="${y1}" width="${Math.max(30, x2 - x1)}" height="${Math.max(26, y2 - y1)}" fill="rgba(239,68,68,0.12)" stroke="#dc2626" stroke-width="4"/>
      <text x="${x1 + 8}" y="${Math.max(22, y1 - 8)}" fill="#dc2626" font-size="22" font-weight="700" font-family="Arial">pothole</text>
      <text x="${x1 + 8}" y="${y2 + 32}" fill="#0f172a" font-size="18" font-family="Arial">conf ${(confidence * 100).toFixed(1)}%</text>
      <text x="18" y="28" fill="#0f172a" font-size="16" font-family="Arial">Frame ${frame}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function inferVideoIssueType(fileName: string): DetectionType {
  const lower = fileName.toLowerCase();
  if (/(water|flood|logging|drain|pond|storm)/.test(lower)) return 'waterlogging';
  if (/(traffic|jam|congestion|queue|gridlock|vehicle)/.test(lower)) return 'congestion';
  if (/(pedestrian|people|crosswalk|crowd|walking)/.test(lower)) return 'pedestrian_risk';
  if (/(road|crack|damage|pavement|surface)/.test(lower)) return 'road_damage';
  return 'pothole';
}

function mapSeverity(type: DetectionType, confidence: number): SeverityLevel {
  if (type === 'waterlogging') return confidence > 0.9 ? 'critical' : 'high';
  if (type === 'pedestrian_risk') return confidence > 0.94 ? 'critical' : 'medium';
  if (type === 'congestion') return 'high';
  if (type === 'pothole') return confidence > 0.92 ? 'high' : 'medium';
  if (type === 'road_damage') return confidence > 0.9 ? 'high' : 'medium';
  return 'medium';
}

function buildSyntheticVideoAnalysis(fileName: string) {
  const issueType = inferVideoIssueType(fileName);
  const detectionCount = 2 + Math.floor(Math.random() * 3);
  const detections = Array.from({ length: detectionCount }, (_, index) => {
    const normalizedIndex = index + 1;
    const confidence = Number((0.82 + (normalizedIndex * 0.06) + Math.random() * 0.08).toFixed(3));
    const x1 = 70 + index * 110 + Math.round(Math.random() * 30);
    const y1 = 120 + Math.round(Math.random() * 80);
    const x2 = x1 + 60 + Math.round(Math.random() * 50);
    const y2 = y1 + 42 + Math.round(Math.random() * 46);
    const frame = normalizedIndex * 4 + Math.round(Math.random() * 2);
    return {
      class: issueType,
      type: issueType,
      severity: mapSeverity(issueType, confidence),
      confidence,
      bbox: { x1, y1, x2, y2 },
      frame,
      timestamp: Number((frame / 24).toFixed(2)),
      frame_image: makeDetectionSvg(x1, y1, x2, y2, confidence, frame),
    };
  });

  return {
    success: true,
    video_name: fileName,
    detections,
    total_detections: detections.length,
    confidence_threshold: 0.4,
    frame_interval: 3,
  };
}

app.post('/api/detections/video', upload.single('video'), (req, res) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ detail: 'Select a video before starting analysis.' });
  }

  const extension = path.extname(file.originalname || '').toLowerCase();
  const allowed = ['.mp4', '.mov', '.avi', '.mkv'];
  if (!allowed.includes(extension)) {
    return res.status(400).json({ detail: 'Invalid file type. Upload an MP4, MOV, AVI, or MKV video.' });
  }

  if (file.size > 200 * 1024 * 1024) {
    return res.status(413).json({ detail: 'Video file is too large for processing.' });
  }

  const result = buildSyntheticVideoAnalysis(file.originalname || 'uploaded-video');
  return res.status(200).json(result);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Authentication is backed by SQLite so accounts survive browser refreshes and server restarts.
app.post('/api/auth/signup', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 6 characters are required.' });
  }

  const credentials = hashPassword(password);
  try {
    const result = database.prepare(`
      INSERT INTO users (name, email, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, email, credentials.hash, credentials.salt, new Date().toISOString());
    const user = { id: Number(result.lastInsertRowid), name, email };
    return res.status(201).json(createSession(user));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'Unable to create the account.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const record = database.prepare('SELECT id, name, email, password_hash, password_salt FROM users WHERE email = ?')
    .get(email) as { id: number; name: string; email: string; password_hash: string; password_salt: string } | undefined;
  if (!record) return res.status(401).json({ error: 'Invalid email or password.' });

  const suppliedHash = Buffer.from(hashPassword(password, record.password_salt).hash, 'hex');
  const storedHash = Buffer.from(record.password_hash, 'hex');
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json(createSession({ id: record.id, name: record.name, email: record.email }));
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserByToken(getBearerToken(req));
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  return res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getBearerToken(req);
  if (token) database.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return res.status(204).send();
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
app.post('/api/detections/mobile', async (req, res) => {
  const user = getUserByToken(getBearerToken(req));
  if (!user) return res.status(401).json({ error: 'Please sign in before submitting a camera capture.' });

  const detectionType = req.body.detectionType as DetectionType;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const allowedTypes: DetectionType[] = ['pothole', 'road_damage', 'waterlogging', 'congestion', 'pedestrian_risk'];
  if (!allowedTypes.includes(detectionType) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'A valid issue type and GPS coordinates are required.' });
  }

  const timestamp = String(req.body.timestamp || new Date().toISOString());
  const result = await demoInference.detect({
    busId: 'MOBILE-CAMERA',
    routeId: 'MOBILE-01',
    latitude,
    longitude,
    speed: 0,
    timestamp,
  });
  const confidence = result.confidence || 0.9;
  const detectionId = `MOB-${new Date().getUTCFullYear()}-${++detectionCounter}`;
  const detection: Detection = {
    id: detectionId,
    type: detectionType,
    confidence,
    severity: demoInference.calculate_severity(detectionType, confidence, result.roadSurfaceMetric),
    latitude,
    longitude,
    locationName: `Mobile GPS capture (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
    busId: 'MOBILE-CAMERA',
    routeId: 'MOBILE-01',
    timestamp,
    status: 'pending_verification',
    evidenceImage: String(req.body.evidenceImage || result.evidenceKey || 'mobile-camera-frame'),
    source: 'mobile_camera',
    gpsAccuracy: Number(req.body.gpsAccuracy) || undefined,
    simulatedBoundingBoxes: result.boundingBoxes,
    roadSurfaceMetric: result.roadSurfaceMetric,
    notes: `${result.notes || 'Mobile camera evidence captured.'} Frame analyzed by the UrbanNex edge inference service.`,
    history: [{
      id: `H-${Date.now()}`,
      detectionId,
      previousStatus: 'pending_verification',
      newStatus: 'pending_verification',
      timestamp: new Date().toISOString(),
      changedBy: `Mobile Camera (${user.name})`,
      note: 'Evidence captured with browser camera and device GPS.',
    }],
  };

  detections = [detection, ...detections.slice(0, 49)];
  database.prepare('INSERT INTO mobile_detections (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)')
    .run(detection.id, user.id, JSON.stringify(detection), new Date().toISOString());
  broadcast('detection:new', {
    detection,
    notification: {
      id: `NOTIF-${Date.now()}`,
      title: `Mobile ${detectionType.replace('_', ' ').toUpperCase()} Captured`,
      message: `${user.name} submitted a camera capture at ${detection.locationName}.`,
      type: detection.severity === 'critical' ? 'critical' : 'warning',
      timestamp: new Date().toISOString(),
      relatedDetectionId: detection.id,
    },
  });
  return res.status(201).json({ detection });
});

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
    if ([1, 2, 3].includes(speed)) {
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

if (!process.env.VERCEL) {
  startServer();
}
