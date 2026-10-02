CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'department',
  department TEXT,
  requested_department TEXT,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_department_approved_idx ON users (department, approved);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mobile_detections (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detection_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  route_number TEXT,
  name TEXT,
  path TEXT
);

CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY,
  bus_number TEXT,
  route_id TEXT REFERENCES routes(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  speed DOUBLE PRECISION DEFAULT 30,
  status TEXT DEFAULT 'active',
  gps_status TEXT DEFAULT 'locked',
  camera_status TEXT DEFAULT 'online',
  ai_status TEXT DEFAULT 'online',
  fps DOUBLE PRECISION DEFAULT 28.6,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS detections (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  severity TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  bus_id TEXT REFERENCES buses(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  evidence_image TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  department TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS detections_status_idx ON detections (status);
CREATE INDEX IF NOT EXISTS detections_department_idx ON detections (department);

CREATE TABLE IF NOT EXISTS incident_history (
  id BIGSERIAL PRIMARY KEY,
  detection_id TEXT NOT NULL REFERENCES detections(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS realtime_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  target_department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS realtime_events_created_idx ON realtime_events (created_at, id);
CREATE INDEX IF NOT EXISTS realtime_events_department_idx ON realtime_events (target_department, id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);