export type DetectionType = 'pothole' | 'road_damage' | 'waterlogging' | 'congestion' | 'pedestrian_risk';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'pending_verification' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';

export type BusStatus = 'active' | 'idle' | 'warning' | 'offline';

export type Department = 
  | 'Roads & Infrastructure'
  | 'Traffic Management'
  | 'Water & Drainage'
  | 'Public Safety'
  | 'Emergency Response';

export interface BoundingBox {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number;
  height: number;
  label: string;
  confidence: number;
}

export interface Detection {
  id: string; // e.g. DET-2026-00128
  type: DetectionType;
  confidence: number; // e.g. 0.942
  severity: SeverityLevel;
  latitude: number;
  longitude: number;
  locationName: string;
  busId: string;
  routeId: string;
  timestamp: string; // ISO string
  status: IncidentStatus;
  department?: Department;
  assignedTo?: string;
  evidenceImage: string; // Simulated frame SVG/canvas URL or key
  source?: 'fleet_camera' | 'mobile_camera';
  gpsAccuracy?: number;
  simulatedBoundingBoxes?: BoundingBox[];
  roadSurfaceMetric?: string;
  speedAtDetection?: number;
  notes?: string;
  history: IncidentHistoryEntry[];
}

export interface IncidentHistoryEntry {
  id: string;
  detectionId: string;
  previousStatus: IncidentStatus;
  newStatus: IncidentStatus;
  timestamp: string;
  changedBy: string;
  note?: string;
}

export interface Bus {
  id: string; // e.g. BUS-001
  busNumber: string; // e.g. TN-38-N-2410
  routeId: string;
  routeName: string;
  latitude: number;
  longitude: number;
  heading: number; // 0-360 degrees
  speed: number; // km/h
  status: BusStatus;
  gpsStatus: 'locked' | 'searching' | 'degraded';
  cameraStatus: 'online' | 'warning' | 'offline';
  aiStatus: 'online' | 'throttled' | 'idle';
  fps: number;
  networkStrength: number; // 0-100%
  lastDetection?: {
    type: DetectionType;
    timestamp: string;
  };
  totalDetections: number;
  verifiedDetections: number;
  lastSeen: string;
  driverName: string;
  routeProgress: number; // 0-1 percentage along waypoint path
}

export interface RouteData {
  id: string;
  routeNumber: string;
  name: string;
  color: string;
  waypoints: [number, number][]; // [lat, lng]
}

export interface SystemHealthMetrics {
  webSocketStatus: 'connected' | 'connecting' | 'disconnected';
  apiStatus: 'healthy' | 'degraded' | 'error';
  databaseStatus: 'connected' | 'reconnecting';
  gpsStreamStatus: 'active' | 'degraded';
  aiServiceStatus: 'online' | 'standby';
  fleetConnectivity: string; // "12 / 12"
  averageLatencyMs: number;
  eventProcessingRate: number; // 99.2%
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  messagesPerSecond: number;
  history: {
    timestamp: string;
    cpu: number;
    memory: number;
    latency: number;
    events: number;
  }[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
  read: boolean;
  relatedDetectionId?: string;
  relatedBusId?: string;
}

export interface SimulationControlState {
  isRunning: boolean;
  speed: 1 | 2 | 3;
  activeBusCount: number;
  totalEventsGenerated: number;
  lastEventTime?: string;
}

export interface SystemHealth {
  edgeDeviceModel: string;
  edgeTemp: number;
  cpuUsage: number;
  gpuUsage: number;
  cameraStatus: string;
  gpsReceiver: string;
  satellitesLocked: number;
  networkLatency: number;
  privacyGuard: boolean;
  bandwidthSaved: string;
}

export interface OverviewKPIs {
  activeBuses: number;
  totalBuses: number;
  liveDetections: number;
  recentDetectionsCount: number;
  pendingVerification: number;
  criticalIssues: number;
  resolvedToday: number;
  networkHealth: number;
}
