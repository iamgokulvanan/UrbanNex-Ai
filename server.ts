import express from 'express';
import 'dotenv/config';
import http from 'http';
import path from 'path';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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
    role TEXT NOT NULL DEFAULT 'department',
    department TEXT,
    requested_department TEXT,
    approved INTEGER NOT NULL DEFAULT 0,
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
  CREATE TABLE IF NOT EXISTS detection_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const userColumns = database.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
for (const [column, definition] of [
  ['role', "TEXT NOT NULL DEFAULT 'department'"],
  ['department', 'TEXT'],
  ['requested_department', 'TEXT'],
  ['approved', 'INTEGER NOT NULL DEFAULT 0'],
] as const) {
  if (!userColumns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }
}

type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'main' | 'department';
  department: Department | null;
  approved: boolean;
};

type UserRecord = Omit<AuthUser, 'approved'> & { approved: number };

function publicUser(user: AuthUser) {
  return { ...user };
}

function bootstrapMainBranch() {
  const email = process.env.URBANNEX_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.URBANNEX_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[Auth] Set URBANNEX_ADMIN_EMAIL and URBANNEX_ADMIN_PASSWORD to enable main-branch access.');
    return;
  }
  if (password.length < 4) throw new Error('URBANNEX_ADMIN_PASSWORD must be at least 4 characters.');

  const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) {
    const credentials = hashPassword(password);
    database.prepare("UPDATE users SET password_hash = ?, password_salt = ?, role = 'main', department = NULL, requested_department = NULL, approved = 1 WHERE id = ?")
      .run(credentials.hash, credentials.salt, existing.id);
    return;
  }

  const credentials = hashPassword(password);
  database.prepare(`
    INSERT INTO users (name, email, password_hash, password_salt, role, approved, created_at)
    VALUES (?, ?, ?, ?, 'main', 1, ?)
  `).run('Main Branch Authority', email, credentials.hash, credentials.salt, new Date().toISOString());
}

bootstrapMainBranch();

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

async function sendAuthorityEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn('[Email] Resend is not configured; authority email was not delivered.');
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Email provider responded with ${response.status}`);
  return true;
}

function getApplicationUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function notifyDepartmentOfIncident(detection: Detection, changedBy: string) {
  if (!detection.department) return;
  const recipients = database.prepare(`
    SELECT email FROM users WHERE role = 'department' AND department = ? AND approved = 1
  `).all(detection.department) as Array<{ email: string }>;
  const subject = `UrbanNex incident ${detection.id}: ${detection.status.replace('_', ' ')}`;
  const text = [
    `Incident ${detection.id} has been updated.`,
    `Type: ${detection.type.replace('_', ' ')}`,
    `Severity: ${detection.severity}`,
    `Status: ${detection.status.replace('_', ' ')}`,
    `Department: ${detection.department}`,
    `Location: ${detection.locationName}`,
    `Coordinates: ${detection.latitude}, ${detection.longitude}`,
    `Bus / route: ${detection.busId} / ${detection.routeId}`,
    `Updated by: ${changedBy}`,
    detection.notes ? `Notes: ${detection.notes}` : '',
    `Open UrbanNex: ${getApplicationUrl()}`,
  ].filter(Boolean).join('\n');
  for (const recipient of recipients) {
    void sendAuthorityEmail(recipient.email, subject, text).catch((error) => {
      console.error(`[Email] Incident notification delivery failed for ${detection.id}:`, error);
    });
  }
}

function getUserByToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  const user = database.prepare(`
    SELECT users.id, users.name, users.email, users.role, users.department, users.approved
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token) as UserRecord | undefined;
  return user ? { ...user, approved: Boolean(user.approved) } : null;
}

function getBearerToken(req: express.Request) {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

function createSession(user: AuthUser) {
  const token = randomBytes(32).toString('hex');
  database.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, user.id, new Date().toISOString());
  return { token, user: publicUser(user) };
}

function requireUser(req: express.Request, res: express.Response): AuthUser | null {
  const user = getUserByToken(getBearerToken(req));
  if (!user || !user.approved) {
    res.status(401).json({ error: 'Please sign in with an approved authority account.' });
    return null;
  }
  return user;
}

function requireMainBranch(req: express.Request, res: express.Response): AuthUser | null {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'main') {
    res.status(403).json({ error: 'Main-branch authority is required for this action.' });
    return null;
  }
  return user;
}

function canAccessDetection(user: AuthUser, detection: Detection) {
  return user.role === 'main' || detection.department === user.department;
}

// In-memory persistent state for prototype demonstration
let buses: Bus[] = JSON.parse(JSON.stringify(INITIAL_BUSES));
function loadPersistedDetections(): Detection[] {
  const rows = [
    ...database.prepare('SELECT payload FROM detection_state ORDER BY updated_at DESC').all() as Array<{ payload: string }>,
    ...database.prepare('SELECT payload FROM mobile_detections ORDER BY created_at DESC').all() as Array<{ payload: string }>,
  ];
  const byId = new Map<string, Detection>();
  for (const row of rows) {
    try {
      const detection = JSON.parse(row.payload) as Detection;
      if (detection?.id && !byId.has(detection.id)) byId.set(detection.id, detection);
    } catch {
      console.error('[Database] Skipping malformed persisted detection payload.');
    }
  }
  for (const detection of INITIAL_DETECTIONS) {
    if (!byId.has(detection.id)) byId.set(detection.id, detection);
  }
  return [...byId.values()].slice(0, 200);
}

function persistDetection(detection: Detection) {
  database.prepare(`
    INSERT INTO detection_state (id, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(detection.id, JSON.stringify(detection), new Date().toISOString());
}

let detections: Detection[] = loadPersistedDetections();
let simulationRunning = true;
let simulationSpeedMultiplier: 1 | 2 | 3 = 1;
let detectionCounter = 129;

const demoInference = new DemoInferenceService();

// WebSocket Server on /ws/live
const wss = new WebSocketServer({ server, path: '/ws/live' });
const socketUsers = new WeakMap<WebSocket, AuthUser>();

function broadcast(type: string, payload: any) {
  const timestamp = new Date().toISOString();
  wss.clients.forEach((client) => {
    const user = socketUsers.get(client);
    if (user && client.readyState === WebSocket.OPEN) {
      try {
        if (user.role !== 'main' && !['init:state', 'detection:new', 'detection:status_changed'].includes(type)) return;
        if (type === 'detection:new' && !canAccessDetection(user, payload.detection)) return;
        if (type === 'detection:status_changed' && !canAccessDetection(user, payload.detection)) return;
        const scopedPayload = type === 'init:state' && user.role !== 'main'
          ? { ...payload, buses: [], routes: [], detections: payload.detections.filter((detection: Detection) => canAccessDetection(user, detection)), simulation: undefined }
          : payload;
        client.send(JSON.stringify({ type, data: scopedPayload, timestamp }));
      } catch (err) {
        console.error('WS broadcast error:', err);
      }
    }
  });
}

// Client connection handling
wss.on('connection', (ws, req) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const user = getUserByToken(requestUrl.searchParams.get('token') || undefined);
  if (!user || !user.approved) {
    ws.close(1008, 'Authentication required');
    return;
  }
  socketUsers.set(ws, user);
  console.log(`[WS] Client connected. Total clients: ${wss.clients.size}`);

  const initialState = user.role === 'main' ? {
    buses,
    detections,
    routes: INITIAL_ROUTES,
    departments: DEPARTMENTS,
    simulation: { isRunning: simulationRunning, speed: simulationSpeedMultiplier },
    modelInfo: demoInference.getModelInfo(),
  } : {
    buses: [],
    detections: detections.filter((detection) => canAccessDetection(user, detection)),
    routes: [],
    departments: [],
    modelInfo: demoInference.getModelInfo(),
  };
  ws.send(JSON.stringify({
    type: 'init:state',
    data: initialState,
    timestamp: new Date().toISOString(),
  }));

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      handleClientCommand(parsed, ws, user);
    } catch (e) {
      console.error('Invalid WS message payload:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Remaining: ${wss.clients.size}`);
  });
});

function handleClientCommand(msg: { action: string; [key: string]: any }, sender: WebSocket, user: AuthUser) {
  if (user.role !== 'main') {
    const detection = detections.find((item) => item.id === msg.detectionId);
    if (detection?.department !== user.department || !['in_progress', 'resolve'].includes(msg.action)) return;
  }
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
    case 'in_progress':
      updateIncidentStatus(msg.detectionId, 'in_progress', user.name);
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
  detections = [newDetection, ...detections.slice(0, 199)];
  persistDetection(newDetection);

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
  const allowedPreviousStatuses: Partial<Record<IncidentStatus, IncidentStatus[]>> = {
    verified: ['pending_verification'],
    rejected: ['pending_verification'],
    assigned: ['verified'],
    in_progress: ['assigned'],
    resolved: ['in_progress'],
  };
  if (allowedPreviousStatuses[newStatus] && !allowedPreviousStatuses[newStatus]?.includes(prevStatus)) return null;
  if (newStatus === 'assigned' && (!department || !DEPARTMENTS.includes(department))) return null;

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
  persistDetection(updated);
  if (['assigned', 'in_progress', 'resolved'].includes(newStatus)) {
    notifyDepartmentOfIncident(updated, changedBy);
  }

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

function makeDetectionSvg(x1: number, y1: number, x2: number, y2: number, confidence: number, frame: number, label: string) {
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
      <text x="${x1 + 8}" y="${Math.max(22, y1 - 8)}" fill="#dc2626" font-size="22" font-weight="700" font-family="Arial">${label}</text>
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
    const confidence = Number(Math.min(0.99, 0.82 + (normalizedIndex * 0.06) + Math.random() * 0.08).toFixed(3));
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
      frame_image: makeDetectionSvg(x1, y1, x2, y2, confidence, frame, issueType),
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

app.post('/api/detections/video', (req, res, next) => {
  if (!requireMainBranch(req, res)) return;
  next();
}, upload.single('video'), (req, res) => {
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
  const requestedDepartment = String(req.body.department || '');
  if (!name || !email || password.length < 4 || !DEPARTMENTS.includes(requestedDepartment as Department)) {
    return res.status(400).json({ error: 'Name, valid department, and a password of at least 4 characters are required.' });
  }

  const credentials = hashPassword(password);
  try {
    const result = database.prepare(`
      INSERT INTO users (name, email, password_hash, password_salt, role, requested_department, approved, created_at)
      VALUES (?, ?, ?, ?, 'department', ?, 0, ?)
    `).run(name, email, credentials.hash, credentials.salt, requestedDepartment, new Date().toISOString());
    return res.status(202).json({ pendingApproval: true, message: 'Your account request was sent to the main branch for approval.' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'Unable to create the account.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || email.length > 254) return res.status(400).json({ error: 'Enter a valid account email.' });
  const genericMessage = 'If an account exists for that email, password reset instructions have been sent.';
  const account = database.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (!account) return res.json({ message: genericMessage });

  const resetToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(resetToken).digest('hex');
  const now = new Date();
  database.prepare('DELETE FROM password_resets WHERE user_id = ?').run(account.id);
  database.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash, account.id, new Date(now.getTime() + 30 * 60 * 1000).toISOString(), now.toISOString());

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.AUTH_FROM_EMAIL;
  if (resendKey && fromEmail) {
    try {
      const delivery = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'UrbanNex password reset',
          text: `Use this one-time reset token within 30 minutes: ${resetToken}`,
        }),
      });
      if (!delivery.ok) throw new Error(`Email provider responded with ${delivery.status}`);
      return res.json({ message: genericMessage });
    } catch (error) {
      database.prepare('DELETE FROM password_resets WHERE token_hash = ?').run(tokenHash);
      console.error('[Auth] Password reset email delivery failed:', error);
      return res.status(503).json({ error: 'Password reset email could not be sent. Please contact your administrator.' });
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return res.json({ message: genericMessage, developmentToken: resetToken });
  }
  database.prepare('DELETE FROM password_resets WHERE token_hash = ?').run(tokenHash);
  return res.status(503).json({ error: 'Password reset delivery is not configured. Please contact your administrator.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (!email || !token || password.length < 4) {
    return res.status(400).json({ error: 'Email, reset token, and a password of at least 4 characters are required.' });
  }
  const user = database.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (!user) return res.status(400).json({ error: 'Reset token is invalid or expired.' });
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const reset = database.prepare(`
    SELECT token_hash FROM password_resets
    WHERE token_hash = ? AND user_id = ? AND expires_at > ?
  `).get(tokenHash, user.id, new Date().toISOString()) as { token_hash: string } | undefined;
  if (!reset) return res.status(400).json({ error: 'Reset token is invalid or expired.' });

  const credentials = hashPassword(password);
  database.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .run(credentials.hash, credentials.salt, user.id);
  database.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
  database.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  return res.json({ message: 'Password updated. Sign in using your new password.' });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const accountType = String(req.body.accountType || 'department');
  const record = database.prepare('SELECT id, name, email, password_hash, password_salt, role, department, approved FROM users WHERE email = ?')
    .get(email) as (UserRecord & { password_hash: string; password_salt: string }) | undefined;
  if (!record) return res.status(401).json({ error: 'Invalid email or password.' });

  const suppliedHash = Buffer.from(hashPassword(password, record.password_salt).hash, 'hex');
  const storedHash = Buffer.from(record.password_hash, 'hex');
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (record.role !== accountType) return res.status(401).json({ error: 'This account does not have that authority type.' });
  if (!record.approved) return res.status(403).json({ error: 'Your department access is awaiting main-branch approval.' });

  return res.json(createSession({
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    department: record.department,
    approved: Boolean(record.approved),
  }));
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserByToken(getBearerToken(req));
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  if (!user.approved) return res.status(403).json({ error: 'Your department access is awaiting main-branch approval.' });
  return res.json({ user });
});

app.get('/api/admin/authority-requests', (req, res) => {
  if (!requireMainBranch(req, res)) return;
  const requests = database.prepare(`
    SELECT id, name, email, requested_department AS requestedDepartment, created_at AS createdAt
    FROM users WHERE role = 'department' AND approved = 0 ORDER BY created_at ASC
  `).all();
  res.json({ requests });
});

app.post('/api/admin/authority-requests/:id/approve', async (req, res) => {
  const approver = requireMainBranch(req, res);
  if (!approver) return;
  const department = String(req.body.department || '');
  if (!DEPARTMENTS.includes(department as Department)) {
    return res.status(400).json({ error: 'Choose a valid department.' });
  }
  const result = database.prepare(`
    UPDATE users SET department = ?, approved = 1
    WHERE id = ? AND role = 'department' AND approved = 0
  `).run(department, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Authority request not found.' });
  const account = database.prepare('SELECT name, email FROM users WHERE id = ?').get(Number(req.params.id)) as { name: string; email: string };
  let emailSent = false;
  try {
    emailSent = await sendAuthorityEmail(
      account.email,
      'Your UrbanNex department access is approved',
      [
        `Hello ${account.name},`,
        '',
        `Main branch approved your authority account for: ${department}.`,
        'Sign in using the Department authority desk and the password you set during signup.',
        'For security, your password is not included in this email.',
        `Open UrbanNex: ${getApplicationUrl()}`,
      ].join('\n'),
    );
  } catch (error) {
    console.error('[Email] Authority approval notification failed:', error);
  }
  res.json({ approved: true, department, emailSent, approvedBy: approver.name });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getBearerToken(req);
  if (token) database.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return res.status(204).send();
});

// Buses
app.get('/api/buses', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== 'main') return res.json({ buses: [], count: 0 });
  res.json({ buses, count: buses.length });
});

app.get('/api/buses/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== 'main') return res.status(403).json({ error: 'Fleet details are restricted to main branch.' });
  const bus = buses.find(b => b.id === req.params.id);
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  res.json(bus);
});

// Detections
app.post('/api/detections/mobile', async (req, res) => {
  const user = requireMainBranch(req, res);
  if (!user) return;

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

  detections = [detection, ...detections.slice(0, 199)];
  database.prepare('INSERT INTO mobile_detections (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)')
    .run(detection.id, user.id, JSON.stringify(detection), new Date().toISOString());
  persistDetection(detection);
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
  const user = requireUser(req, res);
  if (!user) return;
  const { type, severity, status, bus_id } = req.query;
  let filtered = user.role === 'main'
    ? [...detections]
    : detections.filter((detection) => canAccessDetection(user, detection));
  if (type) filtered = filtered.filter(d => d.type === type);
  if (severity) filtered = filtered.filter(d => d.severity === severity);
  if (status) filtered = filtered.filter(d => d.status === status);
  if (bus_id) filtered = filtered.filter(d => d.busId === bus_id);
  res.json({ detections: filtered, total: filtered.length });
});

app.get('/api/detections/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const detection = detections.find(d => d.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  if (!canAccessDetection(user, detection)) return res.status(404).json({ error: 'Detection not found' });
  res.json(detection);
});

app.post('/api/detections/import-video', (req, res) => {
  const user = requireMainBranch(req, res);
  if (!user) return;
  const incoming = req.body.detections;
  if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 50) {
    return res.status(400).json({ error: 'Submit between 1 and 50 analyzed detections.' });
  }

  const allowedTypes: DetectionType[] = ['pothole', 'road_damage', 'waterlogging', 'congestion', 'pedestrian_risk'];
  const createdAt = new Date().toISOString();
  const imported: Detection[] = [];
  for (const item of incoming) {
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    const confidence = Number(item.confidence);
    if (!allowedTypes.includes(item.type) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 ||
        typeof item.locationName !== 'string' || typeof item.busId !== 'string' || typeof item.routeId !== 'string') {
      return res.status(400).json({ error: 'Video analysis contains an invalid detection record.' });
    }
    const detectionId = `VID-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;
    const detection: Detection = {
      id: detectionId,
      type: item.type,
      confidence,
      severity: ['low', 'medium', 'high', 'critical'].includes(item.severity) ? item.severity : 'medium',
      latitude,
      longitude,
      locationName: item.locationName.slice(0, 240),
      busId: item.busId.slice(0, 80),
      routeId: item.routeId.slice(0, 80),
      timestamp: createdAt,
      status: 'pending_verification',
      evidenceImage: typeof item.evidenceImage === 'string' ? item.evidenceImage.slice(0, 1_000_000) : 'video-frame-unavailable',
      source: 'mobile_camera',
      simulatedBoundingBoxes: Array.isArray(item.simulatedBoundingBoxes) ? item.simulatedBoundingBoxes.slice(0, 20) : [],
      roadSurfaceMetric: typeof item.roadSurfaceMetric === 'string' ? item.roadSurfaceMetric.slice(0, 500) : undefined,
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 1000) : 'Imported from analyzed road video.',
      history: [{
        id: `H-${Date.now()}-${imported.length}`,
        detectionId,
        previousStatus: 'pending_verification',
        newStatus: 'pending_verification',
        timestamp: createdAt,
        changedBy: user.name,
        note: 'Imported from main-branch road video analysis.',
      }],
    };
    imported.push(detection);
  }

  for (const detection of imported) persistDetection(detection);
  detections = [...imported.reverse(), ...detections].slice(0, 200);
  for (const detection of imported) {
    broadcast('detection:new', { detection });
  }
  return res.status(201).json({ detections: imported });
});

app.post('/api/detections/:id/verify', (req, res) => {
  const user = requireMainBranch(req, res);
  if (!user) return;
  const updated = updateIncidentStatus(req.params.id, 'verified', user.name);
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/reject', (req, res) => {
  const user = requireMainBranch(req, res);
  if (!user) return;
  const updated = updateIncidentStatus(req.params.id, 'rejected', user.name, undefined, req.body.reason || 'False positive detection');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/assign', (req, res) => {
  const user = requireMainBranch(req, res);
  if (!user) return;
  const { department, note } = req.body;
  if (!department) return res.status(400).json({ error: 'Department is required' });
  if (!DEPARTMENTS.includes(department as Department)) return res.status(400).json({ error: 'Choose a valid department.' });
  const updated = updateIncidentStatus(req.params.id, 'assigned', user.name, department, note);
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/in-progress', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const detection = detections.find((item) => item.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  if (user.role !== 'main' && (detection.department !== user.department || detection.status !== 'assigned')) {
    return res.status(403).json({ error: 'You can only mobilize incidents assigned to your department.' });
  }
  const updated = updateIncidentStatus(req.params.id, 'in_progress', user.name, undefined, req.body.note || 'Field repair units mobilized on site');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/resolve', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const detection = detections.find((item) => item.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  if (user.role !== 'main' && (detection.department !== user.department || detection.status !== 'in_progress')) {
    return res.status(403).json({ error: 'You can only resolve incidents in progress for your department.' });
  }
  const updated = updateIncidentStatus(req.params.id, 'resolved', user.name, undefined, req.body.resolutionNotes || 'Pavement restored and inspected');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

// Routes
app.get('/api/routes', (req, res) => {
  if (!requireMainBranch(req, res)) return;
  res.json(INITIAL_ROUTES);
});

// Analytics
app.get('/api/analytics', (req, res) => {
  if (!requireMainBranch(req, res)) return;
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
  if (!requireMainBranch(req, res)) return;
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
  if (!requireMainBranch(req, res)) return;
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
