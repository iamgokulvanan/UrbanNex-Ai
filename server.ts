import express from 'express';
import 'dotenv/config';
import http from 'http';
import path from 'path';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import { databaseProvider, dbAll, dbGet, dbRun, initializeDatabase, isPostgres } from './src/server/database.ts';
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
const PORT = Number(process.env.PORT || 3000);
const server = http.createServer(app);

const allowedOrigins = new Set(
  [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean))
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || allowedOrigins.has(origin) || (!origin && req.method === 'OPTIONS');
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use((req, res, next) => {
  if (req.url.startsWith('/index')) {
    req.url = req.url.replace(/^\/index/, '');
  }
  if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.startsWith('/ws')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

app.use(express.json({ limit: '5mb' }));

app.get('/api', (_req, res) => {
  res.json({ status: 'ok', message: 'UrbanNex AI API is running', timestamp: new Date().toISOString() });
});

let databaseInitializationError: unknown;
const databaseReady = initializeDatabase()
  .then(async () => {
    await bootstrapMainBranch();
    detections = await loadPersistedDetections();
    await loadSimulationState();
  })
  .catch((error) => {
    databaseInitializationError = error;
    console.error('[Database] Initialization failed:', error);
  });

app.use(async (_req, res, next) => {
  await databaseReady;
  if (databaseInitializationError) {
    return res.status(503).json({
      code: 'DATABASE_UNAVAILABLE',
      error: 'Persistent database is unavailable.',
    });
  }
  if (process.env.VERCEL) {
    try {
      detections = await loadPersistedDetections();
    } catch (error) {
      console.warn('[Database] Failed to refresh persisted incidents, keeping in-memory:', error);
    }
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

type AuthUser = {
  id: number | string;
  name: string;
  email: string;
  role: 'main' | 'department';
  department: Department | null;
  approved: boolean;
};

type UserRecord = Omit<AuthUser, 'approved'> & { approved: number | boolean; password_hash?: string; password_salt?: string };

function publicUser(user: AuthUser) {
  return { ...user };
}

async function bootstrapMainBranch() {
  const accountsToEnsure: Array<{
    email: string;
    password: string;
    role: 'main' | 'department';
    department: Department | null;
    name: string;
  }> = [
    {
      email: 'iamgokulvanan@gmail.com',
      password: 'gokul123@',
      role: 'main',
      department: null,
      name: 'Main Branch Director (Gokulvanan)',
    },
    {
      email: 'admin@urbannex.ai',
      password: 'admin123',
      role: 'main',
      department: null,
      name: 'Main Branch Authority',
    },
    {
      email: 'roads@urbannex.ai',
      password: 'roads123@',
      role: 'department',
      department: 'Roads & Infrastructure',
      name: 'Eng. K. Rajesh (Roads & Infrastructure)',
    },
    {
      email: 'water@urbannex.ai',
      password: 'water123@',
      role: 'department',
      department: 'Water & Drainage',
      name: 'Officer M. Senthil (Water & Drainage)',
    },
    {
      email: 'traffic@urbannex.ai',
      password: 'traffic123@',
      role: 'department',
      department: 'Traffic Management',
      name: 'Inspector P. Kumar (Traffic Management)',
    },
    {
      email: 'safety@urbannex.ai',
      password: 'safety123@',
      role: 'department',
      department: 'Public Safety',
      name: 'Officer R. Anand (Public Safety)',
    },
    {
      email: 'emergency@urbannex.ai',
      password: 'emergency123@',
      role: 'department',
      department: 'Emergency Response',
      name: 'Captain S. Vijay (Emergency Response)',
    },
  ];

  const envEmail = process.env.URBANNEX_ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.URBANNEX_ADMIN_PASSWORD;
  if (envEmail && envPassword && !accountsToEnsure.some(a => a.email === envEmail)) {
    accountsToEnsure.push({
      email: envEmail,
      password: envPassword,
      role: 'main',
      department: null,
      name: 'Main Branch Authority',
    });
  }

  for (const account of accountsToEnsure) {
    if (account.password.length < 4) continue;
    const existing = await dbGet<{ id: number | string }>('SELECT id FROM users WHERE email = ?', [account.email]);
    const credentials = hashPassword(account.password);
    if (existing) {
      await dbRun(
        "UPDATE users SET password_hash = ?, password_salt = ?, role = ?, department = ?, requested_department = ?, approved = 1 WHERE id = ?",
        [credentials.hash, credentials.salt, account.role, account.department, account.department, existing.id]
      );
      console.log(`[Auth] Account updated (${account.email} · ${account.role}).`);
    } else {
      await dbRun(`
        INSERT INTO users (name, email, password_hash, password_salt, role, department, requested_department, approved, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [account.name, account.email, credentials.hash, credentials.salt, account.role, account.department, account.department, new Date().toISOString()]);
      console.log(`[Auth] Account bootstrapped (${account.email} · ${account.role}).`);
    }
  }
}

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

async function notifyDepartmentOfIncident(detection: Detection, changedBy: string) {
  if (!detection.department) return;
  const recipients = await dbAll<{ email: string }>(`
    SELECT email FROM users WHERE role = 'department' AND department = ? AND approved = 1
  `, [detection.department]);
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

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || 'urbannex-prod-security-secret-2026-cbe';
}

function hashSessionToken(token: string) {
  const secret = getSessionSecret();
  return createHash('sha256').update(`${secret}:${token}`).digest('hex');
}

function createSignedSessionToken(user: AuthUser): string {
  const secret = getSessionSecret();
  const payload = JSON.stringify({
    id: user.id,
    email: user.email.toLowerCase(),
    role: user.role,
    department: user.department,
    ts: Date.now(),
    rnd: randomBytes(8).toString('hex'),
  });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', secret).update(b64Payload).digest('base64url');
  return `${b64Payload}.${sig}`;
}

function verifySignedSessionToken(token: string): { id: number; email: string; role: 'main' | 'department'; department: Department | null } | null {
  try {
    const [b64Payload, sig] = token.split('.');
    if (!b64Payload || !sig) return null;
    const secret = getSessionSecret();
    const expectedSig = createHmac('sha256', secret).update(b64Payload).digest('base64url');
    if (sig !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
    return data;
  } catch {
    return null;
  }
}

async function getUserByToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const lookupToken = hashSessionToken(token);
  const dbUser = await dbGet<UserRecord>(`
    SELECT users.id, users.name, users.email, users.role, users.department, users.approved
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `, [lookupToken]);
  if (dbUser) return { ...dbUser, approved: Boolean(dbUser.approved) };

  // Fallback to verified signed token for multi-container serverless parity
  const verified = verifySignedSessionToken(token);
  if (!verified) return null;
  const user = await dbGet<UserRecord>(`
    SELECT id, name, email, role, department, approved FROM users WHERE email = ?
  `, [verified.email.toLowerCase()]);
  if (user) return { ...user, approved: Boolean(user.approved) };
  return null;
}

function getBearerToken(req: express.Request) {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

async function createSession(user: AuthUser) {
  const token = createSignedSessionToken(user);
  const storedToken = hashSessionToken(token);
  await dbRun('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [storedToken, user.id, new Date().toISOString()]);
  return { token, user: publicUser(user) };
}

async function requireUser(req: express.Request, res: express.Response): Promise<AuthUser | null> {
  const user = await getUserByToken(getBearerToken(req));
  if (!user || !user.approved) {
    res.status(401).json({ error: 'Please sign in with an approved authority account.' });
    return null;
  }
  return user;
}

async function requireMainBranch(req: express.Request, res: express.Response): Promise<AuthUser | null> {
  const user = await requireUser(req, res);
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
async function loadPersistedDetections(): Promise<Detection[]> {
  const rows = [
    ...await dbAll<{ payload: Detection | string }>('SELECT payload FROM detection_state ORDER BY updated_at DESC'),
    ...await dbAll<{ payload: Detection | string }>('SELECT payload FROM mobile_detections ORDER BY created_at DESC'),
  ];
  const byId = new Map<string, Detection>();
  for (const row of rows) {
    try {
      const detection = typeof row.payload === 'string' ? JSON.parse(row.payload) as Detection : row.payload;
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

async function persistDetection(detection: Detection) {
  await dbRun(`
    INSERT INTO detection_state (id, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `, [detection.id, JSON.stringify(detection), new Date().toISOString()]);
  if (isPostgres()) {
    await dbRun(`
      INSERT INTO detections (id, type, confidence, severity, latitude, longitude, location_name, bus_id, timestamp, evidence_image, status, department, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type, confidence = excluded.confidence, severity = excluded.severity,
        latitude = excluded.latitude, longitude = excluded.longitude, location_name = excluded.location_name,
        bus_id = excluded.bus_id, timestamp = excluded.timestamp, evidence_image = excluded.evidence_image,
        status = excluded.status, department = excluded.department, notes = excluded.notes
    `, [detection.id, detection.type, detection.confidence, detection.severity, detection.latitude, detection.longitude,
      detection.locationName, detection.busId, detection.timestamp, detection.evidenceImage, detection.status,
      detection.department || null, detection.notes || null]);
    const latestHistory = detection.history[0];
    if (latestHistory) {
      const alreadyStored = await dbGet<{ id: number | string }>(
        'SELECT id FROM incident_history WHERE detection_id = ? AND timestamp = ? AND new_status = ?',
        [detection.id, latestHistory.timestamp, latestHistory.newStatus]);
      if (!alreadyStored) {
        await dbRun(`
          INSERT INTO incident_history (detection_id, previous_status, new_status, timestamp, changed_by, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [detection.id, latestHistory.previousStatus, latestHistory.newStatus, latestHistory.timestamp,
          latestHistory.changedBy, latestHistory.note || null]);
      }
    }
  }
}

let detections: Detection[] = [...INITIAL_DETECTIONS];
let simulationRunning = true;
let simulationSpeedMultiplier: 1 | 2 | 3 = 1;
let detectionCounter = 129;

async function loadSimulationState() {
  const setting = await dbGet<{ value: unknown }>('SELECT value FROM app_settings WHERE key = ?', ['simulation']);
  if (!setting) return;
  const value = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value as { isRunning?: boolean; speed?: number };
  if (typeof value.isRunning === 'boolean') simulationRunning = value.isRunning;
  if ([1, 2, 3].includes(Number(value.speed))) simulationSpeedMultiplier = Number(value.speed) as 1 | 2 | 3;
}

async function persistSimulationState() {
  await dbRun(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `, ['simulation', JSON.stringify({ isRunning: simulationRunning, speed: simulationSpeedMultiplier }), new Date().toISOString()]);
}

const demoInference = new DemoInferenceService();
const liveWebSocketClients = new Set<any>();

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  liveWebSocketClients.add(ws);
  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(String(raw));
      if (message?.action === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', data: { ok: true } }));
      }
    } catch {
      // Ignore non-JSON messages.
    }
  });
  ws.on('close', () => liveWebSocketClients.delete(ws));
  ws.on('error', () => liveWebSocketClients.delete(ws));
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (pathname !== '/ws/live') {
    socket.destroy();
    return;
  }
  const token = new URL(request.url || '/', 'http://localhost').searchParams.get('token');
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    void (async () => {
      const user = await getUserByToken(token);
      if (!user || !user.approved) {
        ws.send(JSON.stringify({ type: 'auth:error', data: { code: 'SESSION_EXPIRED', error: 'Session expired.' } }));
        ws.close();
        return;
      }
      wss.emit('connection', ws, request);
      ws.send(JSON.stringify({ type: 'init:state', data: { buses, detections, routes: INITIAL_ROUTES, simulation: { isRunning: simulationRunning, speed: simulationSpeedMultiplier } } }));
    })().catch(() => {
      ws.close();
    });
  });
});

async function broadcast(type: string, payload: any) {
  const timestamp = new Date().toISOString();
  if (!['detection:new', 'detection:status_changed'].includes(type)) return;
  const detection = payload.detection as Detection | undefined;
  const targetDepartment = detection?.department || null;
  await dbRun(
    'INSERT INTO realtime_events (event_type, payload, target_department, created_at) VALUES (?, ?, ?, ?)',
    [type, JSON.stringify({ ...payload, timestamp }), targetDepartment, timestamp],
  );

  const eventPayload = JSON.stringify({ type, data: payload });
  for (const client of [...liveWebSocketClients]) {
    if (client.readyState === 1) {
      client.send(eventPayload);
    }
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
  await persistDetection(newDetection);

  // Update target bus stats
  targetBus.totalDetections += 1;
  targetBus.lastDetection = {
    type: detectionType,
    timestamp: 'Just now',
  };

  // Broadcast new detection event
  await broadcast('detection:new', {
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
async function updateIncidentStatus(
  id: string, 
  newStatus: IncidentStatus, 
  changedBy: string, 
  department?: Department, 
  note?: string
): Promise<Detection | null> {
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
  await persistDetection(updated);
  if (['assigned', 'in_progress', 'resolved'].includes(newStatus)) {
    await notifyDepartmentOfIncident(updated, changedBy);
  }

  // Broadcast status update
  await broadcast('detection:status_changed', {
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

async function resetSimulation() {
  buses = JSON.parse(JSON.stringify(INITIAL_BUSES));
  simulationRunning = true;
  simulationSpeedMultiplier = 1;
  await persistSimulationState();
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const busTimer = setInterval(tickSimulation, 2000);
  const detectionTimer = setInterval(() => {
    if (simulationRunning && Math.random() > 0.45) void triggerSimulatedDetection();
  }, 18000);
  busTimer.unref();
  detectionTimer.unref();
}

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

function buildSyntheticImageAnalysis(fileName: string, dataUri?: string) {
  const issueType = inferVideoIssueType(fileName);
  const confidence = Number((0.89 + Math.random() * 0.09).toFixed(3));
  const x1 = 120 + Math.round(Math.random() * 80);
  const y1 = 140 + Math.round(Math.random() * 60);
  const x2 = x1 + 220 + Math.round(Math.random() * 80);
  const y2 = y1 + 130 + Math.round(Math.random() * 70);
  const severity = mapSeverity(issueType, confidence);

  const descriptions: Record<DetectionType, string> = {
    pothole: 'Severe pavement depression and asphalt cavitation detected in transit lane.',
    road_damage: 'Extensive structural asphalt cracking and lateral degradation observed.',
    waterlogging: 'Stormwater accumulation impeding vehicular traction and pedestrian safety.',
    congestion: 'High-density vehicle accumulation creating bottleneck at urban arterial.',
    pedestrian_risk: 'Pedestrian in close proximity to active transit roadway without designated crossing.',
  };

  const departments: Record<DetectionType, Department> = {
    pothole: 'Roads & Infrastructure',
    road_damage: 'Roads & Infrastructure',
    waterlogging: 'Water & Drainage',
    congestion: 'Traffic Management',
    pedestrian_risk: 'Public Safety',
  };

  const detection = {
    class: issueType,
    type: issueType,
    severity,
    confidence,
    bbox: { x1, y1, x2, y2 },
    frame: 1,
    timestamp: 0,
    description: descriptions[issueType] || 'Civic infrastructure anomaly detected.',
    department: departments[issueType] || 'Roads & Infrastructure',
    frame_image: dataUri || makeDetectionSvg(x1, y1, x2, y2, confidence, 1, issueType),
  };

  return {
    success: true,
    media_type: 'image',
    file_name: fileName,
    video_name: fileName,
    detections: [detection],
    total_detections: 1,
    confidence_threshold: 0.4,
  };
}

const handleMediaAnalysis: express.RequestHandler = async (req, res) => {
  const file = req.file as Express.Multer.File | undefined;
  const bodyImage = req.body?.image as string | undefined;
  const fileName = (file?.originalname || req.body?.fileName || 'analyzed-media').trim();
  const explicitType = req.body?.mediaType as string | undefined;

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg'];
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

  const extension = path.extname(fileName).toLowerCase();
  const isImage = explicitType === 'image' || Boolean(bodyImage) || imageExtensions.includes(extension) || file?.mimetype?.startsWith('image/');
  const isVideo = explicitType === 'video' || videoExtensions.includes(extension) || file?.mimetype?.startsWith('video/');

  if (!file && !bodyImage) {
    return res.status(400).json({ detail: 'Upload a video or image file before starting analysis.' });
  }

  if (file && file.size > 200 * 1024 * 1024) {
    return res.status(413).json({ detail: 'Media file is too large for processing.' });
  }

  if (isImage) {
    const dataUri = bodyImage || (file ? `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}` : undefined);
    const result = buildSyntheticImageAnalysis(fileName, dataUri);
    return res.status(200).json(result);
  }

  if (isVideo || !extension) {
    const result = buildSyntheticVideoAnalysis(fileName);
    return res.status(200).json(result);
  }

  return res.status(400).json({ detail: 'Unsupported format. Upload an MP4, MOV, WEBM video or JPG, PNG, WEBP image.' });
};

app.post('/api/detections/analyze', async (req, res, next) => {
  if (!await requireMainBranch(req, res)) return;
  next();
}, upload.single('file'), handleMediaAnalysis);

app.post('/api/detections/video', async (req, res, next) => {
  if (!await requireMainBranch(req, res)) return;
  next();
}, upload.single('video'), handleMediaAnalysis);

// Health check used by local diagnostics and frontend service-status checks.
const healthCheck: express.RequestHandler = async (_req, res) => {
  try {
    await dbGet('SELECT 1');
    res.json({ status: 'ok', database: databaseProvider(), time: new Date().toISOString() });
  } catch (error) {
    console.error('[Health] Database check failed:', error);
    res.status(503).json({ status: 'error', database: 'unavailable', code: 'DATABASE_UNAVAILABLE' });
  }
};
app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// Authentication is backed by SQLite so accounts survive browser refreshes and server restarts.
app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const requestedDepartmentValue = String(req.body.department || '').trim();
  const requestedDepartment = requestedDepartmentValue && DEPARTMENTS.includes(requestedDepartmentValue as Department)
    ? requestedDepartmentValue as Department
    : null;
  if (!name || !email || password.length < 4 || (requestedDepartmentValue && !requestedDepartment)) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 4 characters are required.' });
  }

  const credentials = hashPassword(password);
  try {
    await dbRun(`
      INSERT INTO users (name, email, password_hash, password_salt, role, requested_department, approved, created_at)
      VALUES (?, ?, ?, ?, 'department', ?, FALSE, ?)
    `, [name, email, credentials.hash, credentials.salt, requestedDepartment, new Date().toISOString()]);
    return res.status(202).json({ pendingApproval: true, message: 'Your account request was sent to the main branch for approval.' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ code: 'ACCOUNT_EXISTS', error: 'An account with this email already exists.' });
    }
    console.error('[Auth] Signup failed:', error);
    return res.status(500).json({ code: 'DATABASE_UNAVAILABLE', error: 'Unable to create the account because the authentication database failed.' });
  }
});

function createSignedResetToken(userId: number | string, email: string): string {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + 30 * 60 * 1000;
  const payload = `${userId}:${email.toLowerCase()}:${expiresAt}`;
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifySignedResetToken(token: string, expectedEmail: string, expectedUserId: number | string): boolean {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return false;
    const secret = getSessionSecret();
    const expectedSig = createHmac('sha256', secret).update(b64).digest('base64url');
    if (sig !== expectedSig) return false;
    const decoded = Buffer.from(b64, 'base64url').toString('utf-8');
    const [userId, email, expiresAt] = decoded.split(':');
    if (String(userId) !== String(expectedUserId)) return false;
    if (email.toLowerCase() !== expectedEmail.toLowerCase()) return false;
    if (Date.now() > Number(expiresAt)) return false;
    return true;
  } catch {
    return false;
  }
}

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || email.length > 254) return res.status(400).json({ error: 'Enter a valid account email.' });
  const genericMessage = 'If an account exists for that email, password reset instructions have been sent.';
  const account = await dbGet<{ id: number | string; email: string }>('SELECT id, email FROM users WHERE email = ?', [email]);
  if (!account) return res.json({ message: genericMessage });

  const resetToken = createSignedResetToken(account.id, account.email);
  const tokenHash = createHash('sha256').update(resetToken).digest('hex');
  const now = new Date();
  await dbRun('DELETE FROM password_resets WHERE user_id = ?', [account.id]);
  await dbRun('INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [tokenHash, account.id, new Date(now.getTime() + 30 * 60 * 1000).toISOString(), now.toISOString()]);

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.AUTH_FROM_EMAIL;
  let emailSent = false;
  if (resendKey && fromEmail) {
    try {
      const delivery = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'UrbanNex password reset token',
          text: `Hello,\n\nUse this one-time verification token within 30 minutes to reset your UrbanNex password:\n\n${resetToken}\n\nUrbanNex Command Center: ${getApplicationUrl()}`,
        }),
      });
      emailSent = delivery.ok;
    } catch (error) {
      console.warn('[Email] Resend delivery encountered an error:', error);
    }
  }

  return res.json({ 
    message: emailSent ? 'Password reset token was sent to your email.' : 'Reset verification token generated successfully.', 
    resetToken,
    emailSent,
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (!email || !token || password.length < 4) {
    return res.status(400).json({ error: 'Email, reset token, and a password of at least 4 characters are required.' });
  }
  const user = await dbGet<{ id: number | string }>('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) return res.status(400).json({ error: 'Reset token is invalid or expired.' });
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const reset = await dbGet<{ token_hash: string }>(`
    SELECT token_hash FROM password_resets
    WHERE token_hash = ? AND user_id = ? AND expires_at > ?
  `, [tokenHash, user.id, new Date().toISOString()]);
  const isSignedValid = verifySignedResetToken(token, email, user.id);
  if (!reset && !isSignedValid) return res.status(400).json({ error: 'Reset token is invalid or expired.' });

  const credentials = hashPassword(password);
  await dbRun('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [credentials.hash, credentials.salt, user.id]);
  await dbRun('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
  await dbRun('DELETE FROM sessions WHERE user_id = ?', [user.id]);
  return res.json({ message: 'Password updated. Sign in using your new password.' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const accountType = req.body.accountType == null ? null : String(req.body.accountType);
    if (accountType !== null && !['main', 'department'].includes(accountType)) {
      return res.status(400).json({ code: 'INVALID_AUTHORITY_TYPE', error: 'Choose a valid authority desk.' });
    }
    const record = await dbGet<UserRecord>('SELECT id, name, email, password_hash, password_salt, role, department, approved FROM users WHERE email = ?', [email]);
    if (!record || !record.password_hash || !record.password_salt) return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' });

    const suppliedHash = Buffer.from(hashPassword(password, record.password_salt).hash, 'hex');
    const storedHash = Buffer.from(record.password_hash, 'hex');
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' });
    }
    if (accountType !== null && record.role !== accountType) {
      return res.status(403).json({ code: 'AUTHORITY_TYPE_MISMATCH', error: 'This account is not authorized for the selected authority desk.' });
    }
    if (!record.approved) {
      return res.status(403).json({ code: 'DEPARTMENT_PENDING', error: 'Your department access is awaiting main-branch approval.' });
    }

    // Security & Audit Log for authority login
    const loginTimestamp = new Date().toISOString();
    const loginNoticeSubject = `[UrbanNex Security] Authority Desk Login: ${record.name} (${record.department || 'Main Branch'})`;
    const loginNoticeText = [
      `UrbanNex City Command - Authority Login Alert`,
      `User: ${record.name}`,
      `Email: ${record.email}`,
      `Role: ${record.role === 'main' ? 'Main Branch Commander' : 'Department Authority'}`,
      `Department: ${record.department || 'Main Branch Command Center'}`,
      `Timestamp: ${loginTimestamp}`,
      `Portal: ${getApplicationUrl()}`,
    ].join('\n');

    // Notify user email and notify main branch administrator (iamgokulvanan@gmail.com)
    void sendAuthorityEmail(record.email, loginNoticeSubject, loginNoticeText).catch(() => {});
    if (record.email !== 'iamgokulvanan@gmail.com') {
      void sendAuthorityEmail('iamgokulvanan@gmail.com', loginNoticeSubject, loginNoticeText).catch(() => {});
    }

    // Persist login event to audit log in database
    await dbRun(
      'INSERT INTO realtime_events (event_type, payload, target_department, created_at) VALUES (?, ?, ?, ?)',
      ['auth:login', JSON.stringify({ userId: record.id, name: record.name, email: record.email, role: record.role, department: record.department, timestamp: loginTimestamp }), record.department || null, loginTimestamp]
    );

    return res.json(await createSession({
      id: Number(record.id),
      name: record.name,
      email: record.email,
      role: record.role,
      department: record.department,
      approved: Boolean(record.approved),
    }));
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    return res.status(500).json({ code: 'DATABASE_UNAVAILABLE', error: 'Authentication could not complete because the user database failed.' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getUserByToken(getBearerToken(req));
    if (!user) return res.status(401).json({ code: 'SESSION_EXPIRED', error: 'Session expired.' });
    if (!user.approved) return res.status(403).json({ code: 'DEPARTMENT_PENDING', error: 'Your department access is awaiting main-branch approval.' });
    return res.json({ user });
  } catch (error) {
    console.error('[Auth] Session lookup failed:', error);
    return res.status(500).json({ code: 'DATABASE_UNAVAILABLE', error: 'Authentication database is unavailable.' });
  }
});

app.get('/api/admin/authorities', async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const requests = await dbAll(`
    SELECT id, name, email, requested_department AS requestedDepartment, created_at AS createdAt
    FROM users WHERE role = 'department' AND approved = FALSE ORDER BY created_at ASC
  `);
  const roster = await dbAll(`
    SELECT id, name, email, role, department, created_at AS createdAt
    FROM users WHERE approved = TRUE ORDER BY role DESC, department ASC, name ASC
  `);
  const activity = await dbAll(`
    SELECT id, payload, created_at AS createdAt
    FROM realtime_events WHERE event_type = 'auth:login' ORDER BY id DESC LIMIT 20
  `);
  res.json({ requests, roster, activity });
});

app.get('/api/admin/authority-requests', async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const requests = await dbAll(`
    SELECT id, name, email, requested_department AS requestedDepartment, created_at AS createdAt
    FROM users WHERE role = 'department' AND approved = FALSE ORDER BY created_at ASC
  `);
  res.json({ requests });
});

app.post('/api/admin/authority-requests/:id/approve', async (req, res) => {
  const approver = await requireMainBranch(req, res);
  if (!approver) return;
  const department = String(req.body.department || '');
  if (!DEPARTMENTS.includes(department as Department)) {
    return res.status(400).json({ error: 'Choose a valid department.' });
  }
  const result = await dbRun(`
    UPDATE users SET department = ?, approved = TRUE
    WHERE id = ? AND role = 'department' AND approved = FALSE
  `, [department, Number(req.params.id)]);
  if (!result.changes) return res.status(404).json({ error: 'Authority request not found.' });
  const account = await dbGet<{ name: string; email: string }>('SELECT name, email FROM users WHERE id = ?', [Number(req.params.id)]);
  if (!account) return res.status(404).json({ error: 'Authority request not found.' });
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

app.post('/api/auth/logout', async (req, res) => {
  const token = getBearerToken(req);
  if (token) await dbRun('DELETE FROM sessions WHERE token = ?', [hashSessionToken(token)]);
  return res.status(204).send();
});

app.get('/api/live/state', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const state = {
    buses: user.role === 'main' ? buses : [],
    detections: user.role === 'main' ? detections : detections.filter((item) => canAccessDetection(user, item)),
    routes: user.role === 'main' ? INITIAL_ROUTES : [],
    simulation: user.role === 'main' ? { isRunning: simulationRunning, speed: simulationSpeedMultiplier } : undefined,
    modelInfo: demoInference.getModelInfo(),
  };
  res.json(state);
});

app.get('/api/live/events', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const afterId = Math.max(0, Number(req.query.after) || 0);
  const requestedLimit = Math.max(1, Number(req.query.limit) || 100);
  const limit = Math.min(250, requestedLimit);
  const events = user.role === 'main'
    ? await dbAll<{ id: number | string; event_type: string; payload: unknown; created_at: string }>(
        'SELECT id, event_type, payload, created_at FROM realtime_events WHERE id > ? ORDER BY id ASC LIMIT ?', [afterId, limit])
    : await dbAll<{ id: number | string; event_type: string; payload: unknown; created_at: string }>(
        'SELECT id, event_type, payload, created_at FROM realtime_events WHERE id > ? AND target_department = ? ORDER BY id ASC LIMIT ?', [afterId, user.department, limit]);
  res.json({ events: events.map((event) => ({
    id: Number(event.id),
    type: event.event_type,
    data: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
    timestamp: event.created_at,
  })) });
});

// Buses
app.get('/api/buses', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.role !== 'main') return res.json({ buses: [], count: 0 });
  res.json({ buses, count: buses.length });
});

app.get('/api/buses/:id', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.role !== 'main') return res.status(403).json({ error: 'Fleet details are restricted to main branch.' });
  const bus = buses.find(b => b.id === req.params.id);
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  res.json(bus);
});

// Detections
app.post('/api/detections/mobile', async (req, res) => {
  const user = await requireMainBranch(req, res);
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
  await dbRun('INSERT INTO mobile_detections (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)',
    [detection.id, user.id, JSON.stringify(detection), new Date().toISOString()]);
  await persistDetection(detection);
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

app.get('/api/detections', async (req, res) => {
  const user = await requireUser(req, res);
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

app.get('/api/detections/:id', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const detection = detections.find(d => d.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  if (!canAccessDetection(user, detection)) return res.status(404).json({ error: 'Detection not found' });
  res.json(detection);
});

app.post('/api/detections/import-video', async (req, res) => {
  const user = await requireUser(req, res);
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
    const incomingStatus = ['pending_verification', 'verified', 'assigned', 'in_progress', 'resolved'].includes(item.status) ? item.status : 'pending_verification';
    const resolvedDept = (item.department && DEPARTMENTS.includes(item.department)) ? item.department : (user.role === 'department' ? user.department : undefined);
    const incomingDept = resolvedDept && DEPARTMENTS.includes(resolvedDept) ? resolvedDept : undefined;
    const finalStatus = incomingDept ? (incomingStatus === 'pending_verification' ? 'assigned' : incomingStatus) : incomingStatus;
    const assignedTo = typeof item.assignedTo === 'string' ? item.assignedTo.slice(0, 120) : undefined;

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
      status: finalStatus,
      department: incomingDept,
      assignedTo,
      evidenceImage: typeof item.evidenceImage === 'string' ? item.evidenceImage.slice(0, 1_000_000) : 'video-frame-unavailable',
      source: 'mobile_camera',
      simulatedBoundingBoxes: Array.isArray(item.simulatedBoundingBoxes) ? item.simulatedBoundingBoxes.slice(0, 20) : [],
      roadSurfaceMetric: typeof item.roadSurfaceMetric === 'string' ? item.roadSurfaceMetric.slice(0, 500) : undefined,
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 1000) : (incomingDept ? `Work order assigned to ${incomingDept}.` : 'Imported from AI Analyzer.'),
      history: [{
        id: `H-${Date.now()}-${imported.length}`,
        detectionId,
        previousStatus: 'pending_verification',
        newStatus: finalStatus,
        timestamp: createdAt,
        changedBy: assignedTo ? `Authority Dispatch (${assignedTo})` : user.name,
        note: typeof item.notes === 'string' ? item.notes.slice(0, 1000) : (incomingDept ? `Work order assigned to ${incomingDept}.` : 'Imported from AI Analyzer.'),
      }],
    };
    imported.push(detection);
  }

  for (const detection of imported) await persistDetection(detection);
  detections = [...imported.reverse(), ...detections].slice(0, 200);
  for (const detection of imported) {
    await broadcast('detection:new', { detection });
  }
  return res.status(201).json({ detections: imported });
});

app.post('/api/detections/:id/verify', async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const updated = await updateIncidentStatus(req.params.id, 'verified', user.name);
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/reject', async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const updated = await updateIncidentStatus(req.params.id, 'rejected', user.name, undefined, req.body.reason || 'False positive detection');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/assign', async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const { department, note } = req.body;
  if (!department) return res.status(400).json({ error: 'Department is required' });
  if (!DEPARTMENTS.includes(department as Department)) return res.status(400).json({ error: 'Choose a valid department.' });
  const updated = await updateIncidentStatus(req.params.id, 'assigned', user.name, department, note);
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/in-progress', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const detection = detections.find((item) => item.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  if (user.role !== 'main' && (detection.department !== user.department || detection.status !== 'assigned')) {
    return res.status(403).json({ error: 'You can only mobilize incidents assigned to your department.' });
  }
  const updated = await updateIncidentStatus(req.params.id, 'in_progress', user.name, undefined, req.body.note || 'Field repair units mobilized on site');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

app.post('/api/detections/:id/resolve', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const detection = detections.find((item) => item.id === req.params.id);
  if (!detection) return res.status(404).json({ error: 'Detection not found' });
  if (user.role !== 'main' && (detection.department !== user.department || detection.status !== 'in_progress')) {
    return res.status(403).json({ error: 'You can only resolve incidents in progress for your department.' });
  }
  const updated = await updateIncidentStatus(req.params.id, 'resolved', user.name, undefined, req.body.resolutionNotes || 'Pavement restored and inspected');
  if (!updated) return res.status(404).json({ error: 'Detection not found' });
  res.json(updated);
});

// Routes
app.get('/api/routes', async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  res.json(INITIAL_ROUTES);
});

// Analytics
app.get('/api/analytics', async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
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
app.get('/api/system/health', async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const activeBuses = buses.filter(b => b.status === 'active').length;
  res.json({
    webSocketStatus: 'disconnected',
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
    activeClients: 0,
    modelName: demoInference.getModelInfo().name,
  });
});

// Simulation controls
app.post('/api/simulation/control', async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
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
    const { createServer: createViteServer } = await import('vite');
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

export default app;
