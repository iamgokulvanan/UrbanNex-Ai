var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_config = require("dotenv/config");
var import_http = __toESM(require("http"), 1);
var import_path = __toESM(require("path"), 1);
var import_node_crypto = require("node:crypto");
var import_multer = __toESM(require("multer"), 1);
var import_ws = require("ws");

// src/server/database.ts
var import_pg = require("pg");
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_module = require("node:module");
var import_meta = {};
function getRequire() {
  if (typeof require !== "undefined") return require;
  try {
    return (0, import_node_module.createRequire)(import_meta.url);
  } catch {
    return null;
  }
}
var isVercel = Boolean(process.env.VERCEL);
var dbDir = isVercel ? "/tmp" : process.cwd();
var sqliteFile = process.env.SQLITE_PATH || import_node_path.default.join(dbDir, "urbannex.db");
var jsonFallbackFile = import_node_path.default.join(dbDir, "urbannex-store.json");
var ResilientStore = class {
  constructor(filePath) {
    this.users = [];
    this.sessions = [];
    this.mobile_detections = [];
    this.detection_state = /* @__PURE__ */ new Map();
    this.password_resets = [];
    this.realtime_events = [];
    this.app_settings = /* @__PURE__ */ new Map();
    this.nextUserId = 1;
    this.nextEventId = 1;
    this.storageFile = null;
    if (filePath) {
      this.storageFile = filePath;
      this.load();
    }
  }
  load() {
    if (!this.storageFile) return;
    try {
      if (import_node_fs.default.existsSync(this.storageFile)) {
        const data = JSON.parse(import_node_fs.default.readFileSync(this.storageFile, "utf-8"));
        this.users = data.users || [];
        this.sessions = data.sessions || [];
        this.mobile_detections = data.mobile_detections || [];
        if (data.detection_state) {
          this.detection_state = new Map(Object.entries(data.detection_state));
        }
        if (data.app_settings) {
          this.app_settings = new Map(Object.entries(data.app_settings));
        }
        this.password_resets = data.password_resets || [];
        this.realtime_events = data.realtime_events || [];
        this.nextUserId = (this.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) || 0) + 1;
        this.nextEventId = (this.realtime_events.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) || 0) + 1;
      }
    } catch (err) {
      console.warn("[ResilientStore] Could not load state from disk:", err);
    }
  }
  save() {
    if (!this.storageFile) return;
    try {
      const data = {
        users: this.users,
        sessions: this.sessions,
        mobile_detections: this.mobile_detections,
        detection_state: Object.fromEntries(this.detection_state),
        app_settings: Object.fromEntries(this.app_settings),
        password_resets: this.password_resets,
        realtime_events: this.realtime_events
      };
      import_node_fs.default.writeFileSync(this.storageFile, JSON.stringify(data), "utf-8");
    } catch {
    }
  }
  get(sql, params = []) {
    const cleanSql = sql.replace(/\s+/g, " ").trim();
    if (cleanSql.startsWith("SELECT 1")) {
      return { 1: 1 };
    }
    if (cleanSql.includes("FROM users WHERE email = ?")) {
      const email = String(params[0] || "").toLowerCase();
      const user = this.users.find((u) => u.email.toLowerCase() === email);
      return user ? { ...user } : void 0;
    }
    if (cleanSql.includes("FROM users WHERE id = ?")) {
      const id = Number(params[0]);
      const user = this.users.find((u) => Number(u.id) === id);
      return user ? { ...user } : void 0;
    }
    if (cleanSql.includes("FROM sessions") && cleanSql.includes("users") && cleanSql.includes("sessions.token = ?")) {
      const token = String(params[0]);
      const session = this.sessions.find((s) => s.token === token);
      if (!session) return void 0;
      const user = this.users.find((u) => u.id === session.user_id);
      return user ? { ...user } : void 0;
    }
    if (cleanSql.startsWith("SELECT value FROM app_settings WHERE key = ?")) {
      const key = String(params[0]);
      const item = this.app_settings.get(key);
      return item ? { value: item.value } : void 0;
    }
    if (cleanSql.includes("FROM password_resets") && cleanSql.includes("user_id = ?")) {
      const userId = Number(params[0]);
      const item = this.password_resets.find((r) => r.user_id === userId);
      return item ? { ...item } : void 0;
    }
    if (cleanSql.includes("FROM password_resets") && cleanSql.includes("token_hash = ?")) {
      const tokenHash = String(params[0]);
      const item = this.password_resets.find((r) => r.token_hash === tokenHash);
      return item ? { token_hash: item.token_hash } : void 0;
    }
    return void 0;
  }
  all(sql, params = []) {
    const cleanSql = sql.replace(/\s+/g, " ").trim();
    if (cleanSql.includes("PRAGMA table_info(users)")) {
      return [
        { name: "id" },
        { name: "name" },
        { name: "email" },
        { name: "password_hash" },
        { name: "password_salt" },
        { name: "role" },
        { name: "department" },
        { name: "requested_department" },
        { name: "approved" },
        { name: "created_at" }
      ];
    }
    if (cleanSql.includes("FROM detection_state")) {
      return Array.from(this.detection_state.values()).map((d) => ({ payload: d.payload }));
    }
    if (cleanSql.includes("FROM mobile_detections")) {
      return this.mobile_detections.map((d) => ({ payload: d.payload }));
    }
    if (cleanSql.includes("FROM users WHERE role = 'main' AND approved = 1") || cleanSql.includes("FROM users WHERE role = 'main' AND approved = TRUE")) {
      return this.users.filter((u) => u.role === "main" && Boolean(u.approved)).map((u) => ({ email: u.email }));
    }
    if (cleanSql.includes("role = 'department'") && cleanSql.includes("approved = 1")) {
      const dept = params[0];
      return this.users.filter((u) => u.role === "department" && u.department === dept && Boolean(u.approved)).map((u) => ({ email: u.email }));
    }
    if (cleanSql.includes("FROM users WHERE approved = TRUE") || cleanSql.includes("FROM users WHERE approved = 1")) {
      return this.users.filter((u) => Boolean(u.approved)).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        created_at: u.created_at,
        createdAt: u.created_at
      }));
    }
    if (cleanSql.includes("role = 'department'") && (cleanSql.includes("approved = 0") || cleanSql.includes("approved = FALSE"))) {
      return this.users.filter((u) => u.role === "department" && !u.approved).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        requested_department: u.requested_department,
        requestedDepartment: u.requested_department,
        created_at: u.created_at,
        createdAt: u.created_at
      }));
    }
    if (cleanSql.includes("FROM realtime_events")) {
      const afterId = Number(params[0] || 0);
      let limit = 100;
      let deptFilter = null;
      if (params.length > 2) {
        deptFilter = String(params[1]);
        limit = Number(params[2] || 100);
      } else if (params.length === 2) {
        limit = Number(params[1] || 100);
      }
      return this.realtime_events.filter((e) => Number(e.id) > afterId && (!deptFilter || e.target_department === deptFilter)).slice(0, limit);
    }
    return [];
  }
  run(sql, params = []) {
    const cleanSql = sql.replace(/\s+/g, " ").trim();
    let changes = 0;
    let lastInsertRowid = void 0;
    if (cleanSql.startsWith("INSERT INTO users")) {
      const email = String(params[1] || "").toLowerCase();
      const existingIndex = this.users.findIndex((u) => u.email === email);
      const isMain = cleanSql.includes("'main'") || params[4] === "main";
      const role = cleanSql.includes("'main'") ? "main" : cleanSql.includes("'department'") ? "department" : params[4] || "department";
      const dept = params[5] !== void 0 ? params[5] : params[4] && params[4] !== "main" && params[4] !== "department" ? params[4] : null;
      const reqDept = params[6] !== void 0 ? params[6] : params[4] && params[4] !== "main" && params[4] !== "department" ? params[4] : null;
      const approved = cleanSql.includes("1, ?") || cleanSql.includes("TRUE, ?") || isMain || params[7] === 1 || params[7] === true;
      const newUser = {
        id: existingIndex >= 0 ? this.users[existingIndex].id : this.nextUserId++,
        name: params[0],
        email,
        password_hash: params[2],
        password_salt: params[3],
        role,
        department: dept || null,
        requested_department: reqDept || null,
        approved: approved ? 1 : 0,
        created_at: String(params[params.length - 1] || (/* @__PURE__ */ new Date()).toISOString())
      };
      if (existingIndex >= 0) {
        this.users[existingIndex] = newUser;
      } else {
        this.users.push(newUser);
      }
      changes = 1;
      lastInsertRowid = newUser.id;
      this.save();
    } else if (cleanSql.startsWith("UPDATE users SET password_hash = ?, password_salt = ?")) {
      const id = params[params.length - 1];
      const user = this.users.find((u) => u.id === id);
      if (user) {
        user.password_hash = params[0];
        user.password_salt = params[1];
        if (cleanSql.includes("role = 'main'")) {
          user.role = "main";
          user.department = null;
          user.requested_department = null;
          user.approved = 1;
        } else if (cleanSql.includes("role = ?")) {
          user.role = params[2];
          user.department = params[3] || null;
          user.requested_department = params[4] || null;
          user.approved = 1;
        }
        changes = 1;
        this.save();
      }
    } else if (cleanSql.includes("UPDATE users SET department = ?, approved = TRUE") || cleanSql.includes("UPDATE users SET department = ?, approved = 1")) {
      const id = Number(params[1]);
      const user = this.users.find((u) => u.id === id);
      if (user) {
        user.department = params[0];
        user.approved = 1;
        changes = 1;
        this.save();
      }
    } else if (cleanSql.startsWith("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")) {
      const id = Number(params[2]);
      const user = this.users.find((u) => u.id === id);
      if (user) {
        user.password_hash = params[0];
        user.password_salt = params[1];
        changes = 1;
        this.save();
      }
    } else if (cleanSql.startsWith("INSERT INTO sessions")) {
      this.sessions.push({ token: params[0], user_id: params[1], created_at: params[2] });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith("DELETE FROM sessions WHERE token = ?")) {
      const before = this.sessions.length;
      this.sessions = this.sessions.filter((s) => s.token !== params[0]);
      changes = before - this.sessions.length;
      this.save();
    } else if (cleanSql.startsWith("DELETE FROM sessions WHERE user_id = ?")) {
      const before = this.sessions.length;
      this.sessions = this.sessions.filter((s) => s.user_id !== params[0]);
      changes = before - this.sessions.length;
      this.save();
    } else if (cleanSql.startsWith("INSERT INTO detection_state")) {
      const id = String(params[0]);
      this.detection_state.set(id, { id, payload: String(params[1]), updated_at: String(params[2]) });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith("INSERT INTO mobile_detections")) {
      this.mobile_detections.push({ id: params[0], user_id: params[1], payload: params[2], created_at: params[3] });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith("INSERT INTO app_settings")) {
      const key = String(params[0]);
      this.app_settings.set(key, { key, value: String(params[1]), updated_at: String(params[2]) });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith("INSERT INTO realtime_events")) {
      const event = {
        id: this.nextEventId++,
        event_type: params[0],
        payload: params[1],
        target_department: params[2] || null,
        created_at: params[3]
      };
      this.realtime_events.push(event);
      if (this.realtime_events.length > 500) {
        this.realtime_events = this.realtime_events.slice(-500);
      }
      changes = 1;
      lastInsertRowid = event.id;
      this.save();
    } else if (cleanSql.startsWith("INSERT INTO password_resets")) {
      this.password_resets.push({ token_hash: params[0], user_id: params[1], expires_at: params[2], created_at: params[3] });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith("DELETE FROM password_resets WHERE user_id = ?")) {
      this.password_resets = this.password_resets.filter((r) => r.user_id !== params[0]);
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith("DELETE FROM password_resets WHERE token_hash = ?")) {
      this.password_resets = this.password_resets.filter((r) => r.token_hash !== params[0]);
      changes = 1;
      this.save();
    }
    return { changes, lastInsertRowid };
  }
};
var sqlite = null;
var postgres = null;
var resilientStore = null;
var initPromise = null;
function databaseProvider() {
  if (postgres) return "postgresql";
  if (sqlite) return "sqlite";
  return "resilient-store";
}
function isPostgres() {
  return postgres !== null;
}
function postgresPlaceholders(sql) {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let output = "";
  for (let cursor = 0; cursor < sql.length; cursor += 1) {
    const character = sql[cursor];
    if (character === "'" && !inDouble && sql[cursor - 1] !== "\\") inSingle = !inSingle;
    if (character === '"' && !inSingle && sql[cursor - 1] !== "\\") inDouble = !inDouble;
    if (character === "?" && !inSingle && !inDouble) {
      index += 1;
      output += `$${index}`;
    } else {
      output += character;
    }
  }
  return output;
}
async function applyPostgresMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const migrationDirectory = import_node_path.default.resolve(process.cwd(), "migrations");
  if (!import_node_fs.default.existsSync(migrationDirectory)) return;
  const migrations = import_node_fs.default.readdirSync(migrationDirectory).filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file)).sort();
  for (const file of migrations) {
    const version = file.split("_")[0];
    const applied = await pool.query("SELECT version FROM schema_migrations WHERE version = $1", [version]);
    if (applied.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sql = import_node_fs.default.readFileSync(import_node_path.default.join(migrationDirectory, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
function initializeSqliteTables(db) {
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS realtime_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      target_department TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS realtime_events_created_idx ON realtime_events (created_at, id);
    CREATE INDEX IF NOT EXISTS realtime_events_department_idx ON realtime_events (target_department, id);
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const columns = db.prepare("PRAGMA table_info(users)").all();
  for (const [column, definition] of [
    ["role", "TEXT NOT NULL DEFAULT 'department'"],
    ["department", "TEXT"],
    ["requested_department", "TEXT"],
    ["approved", "INTEGER NOT NULL DEFAULT 0"]
  ]) {
    if (!columns.some((item) => item.name === column)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
}
function initializeDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      if (process.env.DATABASE_URL) {
        try {
          postgres = new import_pg.Pool({
            connectionString: process.env.DATABASE_URL,
            max: Number(process.env.PG_POOL_MAX || 3),
            idleTimeoutMillis: 1e4,
            connectionTimeoutMillis: 1e4,
            ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
          });
          await postgres.query("SELECT 1");
          await applyPostgresMigrations(postgres);
          console.log("[Database] Connected to PostgreSQL successfully.");
          return;
        } catch (pgError) {
          console.warn("[Database] PostgreSQL connection failed, falling back to embedded store:", pgError);
          postgres = null;
        }
      }
      try {
        let DatabaseConstructor = null;
        try {
          const req = getRequire();
          if (req) {
            DatabaseConstructor = req("better-sqlite3");
          }
        } catch (requireErr) {
          console.warn("[Database] better-sqlite3 module not available in this environment.");
        }
        if (DatabaseConstructor) {
          if (isVercel) {
            const seedDb = import_node_path.default.join(process.cwd(), "urbannex.db");
            if (import_node_fs.default.existsSync(seedDb) && !import_node_fs.default.existsSync(sqliteFile)) {
              try {
                import_node_fs.default.copyFileSync(seedDb, sqliteFile);
              } catch (copyErr) {
                console.warn("[Database] Could not copy seed urbannex.db to /tmp:", copyErr);
              }
            }
          }
          const db = new DatabaseConstructor(sqliteFile);
          try {
            db.pragma("journal_mode = WAL");
          } catch {
          }
          initializeSqliteTables(db);
          sqlite = db;
          console.log(`[Database] SQLite connected at ${sqliteFile}`);
          return;
        }
      } catch (sqliteErr) {
        console.warn("[Database] SQLite initialization failed, activating resilient store:", sqliteErr);
        sqlite = null;
      }
      resilientStore = new ResilientStore(jsonFallbackFile);
      console.log(`[Database] Resilient memory/JSON store activated at ${jsonFallbackFile}`);
    })();
  }
  return initPromise;
}
async function dbGet(sql, params = []) {
  await initializeDatabase();
  if (postgres) {
    const result = await postgres.query(postgresPlaceholders(sql), params);
    return result.rows[0];
  }
  if (sqlite) {
    return sqlite.prepare(sql).get(...params);
  }
  return resilientStore.get(sql, params);
}
async function dbAll(sql, params = []) {
  await initializeDatabase();
  if (postgres) {
    const result = await postgres.query(postgresPlaceholders(sql), params);
    return result.rows;
  }
  if (sqlite) {
    return sqlite.prepare(sql).all(...params);
  }
  return resilientStore.all(sql, params);
}
async function dbRun(sql, params = []) {
  await initializeDatabase();
  if (postgres) {
    const result = await postgres.query(postgresPlaceholders(sql), params);
    return { changes: result.rowCount || 0, lastInsertRowid: void 0 };
  }
  if (sqlite) {
    const result = sqlite.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }
  return resilientStore.run(sql, params);
}

// src/data/seedData.ts
var DEPARTMENTS = [
  "Roads & Infrastructure",
  "Traffic Management",
  "Water & Drainage",
  "Public Safety",
  "Emergency Response"
];
var INITIAL_ROUTES = [
  {
    id: "R-12",
    routeNumber: "Route 12",
    name: "Gandhipuram \u21C4 Avinashi Road \u21C4 Airport Corridor",
    color: "#2563eb",
    // Blue
    waypoints: [
      [11.0168, 76.9558],
      [11.0195, 76.963],
      [11.0224, 76.9745],
      [11.0268, 76.992],
      [11.031, 77.012],
      [11.0355, 77.0325],
      [11.031, 77.012],
      [11.0268, 76.992],
      [11.0224, 76.9745],
      [11.0195, 76.963],
      [11.0168, 76.9558]
    ]
  },
  {
    id: "R-07",
    routeNumber: "Route 7",
    name: "RS Puram \u21C4 Cross Cut Road \u21C4 Gandhipuram Central",
    color: "#0d9488",
    // Teal
    waypoints: [
      [11.0085, 76.942],
      [11.012, 76.9485],
      [11.015, 76.952],
      [11.018, 76.958],
      [11.021, 76.965],
      [11.018, 76.958],
      [11.015, 76.952],
      [11.012, 76.9485],
      [11.0085, 76.942]
    ]
  },
  {
    id: "R-24",
    routeNumber: "Route 24",
    name: "Ukkadam Hub \u21C4 Town Hall \u21C4 Central Railway Junction",
    color: "#7c3aed",
    // Purple
    waypoints: [
      [10.992, 76.961],
      [10.9985, 76.9635],
      [11.004, 76.966],
      [11.0088, 76.9685],
      [11.0135, 76.964],
      [11.0088, 76.9685],
      [11.004, 76.966],
      [10.9985, 76.9635],
      [10.992, 76.961]
    ]
  },
  {
    id: "R-19",
    routeNumber: "Route 19",
    name: "Ganapathy \u21C4 100 Feet Road \u21C4 Peelamedu Tech Park",
    color: "#d97706",
    // Amber
    waypoints: [
      [11.035, 76.972],
      [11.028, 76.969],
      [11.0215, 76.9665],
      [11.0175, 76.978],
      [11.021, 76.995],
      [11.026, 77.015],
      [11.021, 76.995],
      [11.0175, 76.978],
      [11.0215, 76.9665],
      [11.028, 76.969],
      [11.035, 76.972]
    ]
  }
];
var INITIAL_BUSES = [
  {
    id: "BUS-001",
    busNumber: "TN-38-N-2401",
    routeId: "R-12",
    routeName: "Route 12",
    latitude: 11.0168,
    longitude: 76.9558,
    heading: 65,
    speed: 34,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 29.2,
    networkStrength: 98,
    totalDetections: 14,
    verifiedDetections: 9,
    lastSeen: "Just now",
    driverName: "R. Murugan",
    routeProgress: 0.05
  },
  {
    id: "BUS-002",
    busNumber: "TN-38-N-2402",
    routeId: "R-12",
    routeName: "Route 12",
    latitude: 11.0245,
    longitude: 76.983,
    heading: 72,
    speed: 38,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.8,
    networkStrength: 95,
    totalDetections: 19,
    verifiedDetections: 12,
    lastSeen: "Just now",
    driverName: "K. Selvan",
    routeProgress: 0.32
  },
  {
    id: "BUS-003",
    busNumber: "TN-38-N-2403",
    routeId: "R-12",
    routeName: "Route 12",
    latitude: 11.032,
    longitude: 77.018,
    heading: 80,
    speed: 42,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.5,
    networkStrength: 92,
    totalDetections: 8,
    verifiedDetections: 6,
    lastSeen: "Just now",
    driverName: "P. Anand",
    routeProgress: 0.58
  },
  {
    id: "BUS-004",
    busNumber: "TN-38-N-2404",
    routeId: "R-07",
    routeName: "Route 7",
    latitude: 11.0135,
    longitude: 76.95,
    heading: 45,
    speed: 26,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 29.5,
    networkStrength: 99,
    lastDetection: {
      type: "pothole",
      timestamp: "2 mins ago"
    },
    totalDetections: 23,
    verifiedDetections: 17,
    lastSeen: "Just now",
    driverName: "S. Chandran",
    routeProgress: 0.22
  },
  {
    id: "BUS-005",
    busNumber: "TN-38-N-2405",
    routeId: "R-07",
    routeName: "Route 7",
    latitude: 11.0195,
    longitude: 76.962,
    heading: 190,
    speed: 31,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.2,
    networkStrength: 94,
    totalDetections: 11,
    verifiedDetections: 8,
    lastSeen: "Just now",
    driverName: "M. Vijay",
    routeProgress: 0.55
  },
  {
    id: "BUS-006",
    busNumber: "TN-38-N-2406",
    routeId: "R-07",
    routeName: "Route 7",
    latitude: 11.01,
    longitude: 76.945,
    heading: 220,
    speed: 22,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 27.9,
    networkStrength: 91,
    totalDetections: 16,
    verifiedDetections: 11,
    lastSeen: "Just now",
    driverName: "A. Joseph",
    routeProgress: 0.85
  },
  {
    id: "BUS-007",
    busNumber: "TN-38-N-2407",
    routeId: "R-24",
    routeName: "Route 24",
    latitude: 10.995,
    longitude: 76.962,
    heading: 15,
    speed: 28,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.7,
    networkStrength: 96,
    totalDetections: 9,
    verifiedDetections: 7,
    lastSeen: "Just now",
    driverName: "G. Suresh",
    routeProgress: 0.15
  },
  {
    id: "BUS-008",
    busNumber: "TN-38-N-2408",
    routeId: "R-24",
    routeName: "Route 24",
    latitude: 11.0065,
    longitude: 76.9675,
    heading: 30,
    speed: 24,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.1,
    networkStrength: 97,
    lastDetection: {
      type: "waterlogging",
      timestamp: "Just now"
    },
    totalDetections: 28,
    verifiedDetections: 21,
    lastSeen: "Just now",
    driverName: "D. Karthik",
    routeProgress: 0.48
  },
  {
    id: "BUS-009",
    busNumber: "TN-38-N-2409",
    routeId: "R-24",
    routeName: "Route 24",
    latitude: 11.011,
    longitude: 76.9655,
    heading: 205,
    speed: 30,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 29,
    networkStrength: 93,
    totalDetections: 13,
    verifiedDetections: 9,
    lastSeen: "Just now",
    driverName: "V. Prakash",
    routeProgress: 0.72
  },
  {
    id: "BUS-010",
    busNumber: "TN-38-N-2410",
    routeId: "R-19",
    routeName: "Route 19",
    latitude: 11.0315,
    longitude: 76.9705,
    heading: 145,
    speed: 36,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.4,
    networkStrength: 90,
    totalDetections: 15,
    verifiedDetections: 10,
    lastSeen: "Just now",
    driverName: "E. Balaji",
    routeProgress: 0.18
  },
  {
    id: "BUS-011",
    busNumber: "TN-38-N-2411",
    routeId: "R-19",
    routeName: "Route 19",
    latitude: 11.019,
    longitude: 76.985,
    heading: 95,
    speed: 33,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 28.9,
    networkStrength: 95,
    totalDetections: 18,
    verifiedDetections: 14,
    lastSeen: "Just now",
    driverName: "T. Rajesh",
    routeProgress: 0.45
  },
  {
    id: "BUS-012",
    busNumber: "TN-38-N-2412",
    routeId: "R-19",
    routeName: "Route 19",
    latitude: 11.024,
    longitude: 77.008,
    heading: 275,
    speed: 39,
    status: "active",
    gpsStatus: "locked",
    cameraStatus: "online",
    aiStatus: "online",
    fps: 29.1,
    networkStrength: 98,
    totalDetections: 20,
    verifiedDetections: 15,
    lastSeen: "Just now",
    driverName: "S. Manikandan",
    routeProgress: 0.82
  }
];
var INITIAL_DETECTIONS = [
  {
    id: "DET-2026-00128",
    type: "pothole",
    confidence: 0.942,
    severity: "high",
    latitude: 11.0168,
    longitude: 76.9558,
    locationName: "Gandhipuram North Cross Rd, near Signal 4",
    busId: "BUS-004",
    routeId: "R-07",
    timestamp: new Date(Date.now() - 2 * 60 * 1e3).toISOString(),
    status: "pending_verification",
    evidenceImage: "simulated_pothole_01",
    simulatedBoundingBoxes: [
      { x: 38, y: 55, width: 24, height: 18, label: "Pothole (Depth: 7.5cm)", confidence: 0.942 }
    ],
    roadSurfaceMetric: "Asphalt degradation / Edge spalling",
    speedAtDetection: 26,
    notes: "Severe asphalt puncture near inner lane wheel track.",
    history: [
      {
        id: "H-01",
        detectionId: "DET-2026-00128",
        previousStatus: "pending_verification",
        newStatus: "pending_verification",
        timestamp: new Date(Date.now() - 2 * 60 * 1e3).toISOString(),
        changedBy: "Edge AI (BUS-004)",
        note: "Ingested via Onboard Inference Pipeline"
      }
    ]
  },
  {
    id: "DET-2026-00127",
    type: "waterlogging",
    confidence: 0.914,
    severity: "critical",
    latitude: 11.0065,
    longitude: 76.9675,
    locationName: "Railway Underpass, Town Hall South Entry",
    busId: "BUS-008",
    routeId: "R-24",
    timestamp: new Date(Date.now() - 5 * 60 * 1e3).toISOString(),
    status: "pending_verification",
    evidenceImage: "simulated_waterlogging_01",
    simulatedBoundingBoxes: [
      { x: 22, y: 48, width: 55, height: 35, label: "Standing Water (Est. 12cm)", confidence: 0.914 }
    ],
    roadSurfaceMetric: "Storm drain overflow & road submergence",
    speedAtDetection: 24,
    notes: "Underpass drainage clogged; two lanes flooded.",
    history: [
      {
        id: "H-02",
        detectionId: "DET-2026-00127",
        previousStatus: "pending_verification",
        newStatus: "pending_verification",
        timestamp: new Date(Date.now() - 5 * 60 * 1e3).toISOString(),
        changedBy: "Edge AI (BUS-008)",
        note: "High reflectance surface detected"
      }
    ]
  },
  {
    id: "DET-2026-00126",
    type: "road_damage",
    confidence: 0.887,
    severity: "medium",
    latitude: 11.0245,
    longitude: 76.983,
    locationName: "Avinashi Rd Flyover Descent, Pillar 42",
    busId: "BUS-002",
    routeId: "R-12",
    timestamp: new Date(Date.now() - 12 * 60 * 1e3).toISOString(),
    status: "verified",
    department: "Roads & Infrastructure",
    evidenceImage: "simulated_damage_01",
    simulatedBoundingBoxes: [
      { x: 45, y: 60, width: 28, height: 16, label: "Alligator Cracking", confidence: 0.887 }
    ],
    roadSurfaceMetric: "Structural fatigue cracking across 3.4m stretch",
    speedAtDetection: 38,
    notes: "Verified by Municipal Engineer S. Raman.",
    history: [
      {
        id: "H-03",
        detectionId: "DET-2026-00126",
        previousStatus: "pending_verification",
        newStatus: "verified",
        timestamp: new Date(Date.now() - 8 * 60 * 1e3).toISOString(),
        changedBy: "Authority Officer",
        note: "Confirmed structural surface failure"
      }
    ]
  },
  {
    id: "DET-2026-00125",
    type: "congestion",
    confidence: 0.958,
    severity: "high",
    latitude: 11.018,
    longitude: 76.958,
    locationName: "Cross Cut Rd Commercial Junction",
    busId: "BUS-005",
    routeId: "R-07",
    timestamp: new Date(Date.now() - 19 * 60 * 1e3).toISOString(),
    status: "assigned",
    department: "Traffic Management",
    assignedTo: "Traffic Ward 4 - Quick Response Squad",
    evidenceImage: "simulated_congestion_01",
    simulatedBoundingBoxes: [
      { x: 15, y: 40, width: 70, height: 42, label: "Traffic Gridlock (Queue: >280m)", confidence: 0.958 }
    ],
    roadSurfaceMetric: "Average vehicle movement < 4 km/h",
    speedAtDetection: 6,
    notes: "Illegal curb loading causing bottleneck.",
    history: [
      {
        id: "H-04",
        detectionId: "DET-2026-00125",
        previousStatus: "verified",
        newStatus: "assigned",
        timestamp: new Date(Date.now() - 14 * 60 * 1e3).toISOString(),
        changedBy: "Traffic Control Desk",
        note: "Dispatched squad to clear double parking"
      }
    ]
  },
  {
    id: "DET-2026-00124",
    type: "pedestrian_risk",
    confidence: 0.892,
    severity: "medium",
    latitude: 11.019,
    longitude: 76.985,
    locationName: "PSG Tech College Gate Zebra Crossing",
    busId: "BUS-011",
    routeId: "R-19",
    timestamp: new Date(Date.now() - 32 * 60 * 1e3).toISOString(),
    status: "in_progress",
    department: "Public Safety",
    assignedTo: "Urban Safety Marshals",
    evidenceImage: "simulated_pedestrian_01",
    simulatedBoundingBoxes: [
      { x: 42, y: 50, width: 22, height: 30, label: "Obstructed Crosswalk", confidence: 0.892 }
    ],
    roadSurfaceMetric: "Faded zebra markings & missing warning beacon",
    speedAtDetection: 31,
    notes: "Repainting crew mobilized on site.",
    history: [
      {
        id: "H-05",
        detectionId: "DET-2026-00124",
        previousStatus: "assigned",
        newStatus: "in_progress",
        timestamp: new Date(Date.now() - 20 * 60 * 1e3).toISOString(),
        changedBy: "Safety Supervisor",
        note: "Team on site installing high-vis cones and markings"
      }
    ]
  },
  {
    id: "DET-2026-00120",
    type: "pothole",
    confidence: 0.963,
    severity: "critical",
    latitude: 11.032,
    longitude: 77.018,
    locationName: "Avinashi Rd, KMCH Hospital Junction",
    busId: "BUS-003",
    routeId: "R-12",
    timestamp: new Date(Date.now() - 95 * 60 * 1e3).toISOString(),
    status: "resolved",
    department: "Roads & Infrastructure",
    assignedTo: "Rapid Pothole Patching Truck #2",
    evidenceImage: "simulated_pothole_02",
    simulatedBoundingBoxes: [
      { x: 35, y: 52, width: 30, height: 22, label: "Critical Pothole (Depth: 11cm)", confidence: 0.963 }
    ],
    roadSurfaceMetric: "Cold-mix asphalt compaction completed",
    speedAtDetection: 40,
    notes: "Quick-setting bituminous patch applied and rolled.",
    history: [
      {
        id: "H-06",
        detectionId: "DET-2026-00120",
        previousStatus: "in_progress",
        newStatus: "resolved",
        timestamp: new Date(Date.now() - 15 * 60 * 1e3).toISOString(),
        changedBy: "Inspector K. Velu",
        note: "Repaired and verified clear for ambulance transit"
      }
    ]
  }
];

// src/services/aiInference.ts
var DemoInferenceService = class {
  constructor() {
    this.trackerIdCounter = 100;
    this.currentTrackedObjects = [];
  }
  getModelInfo() {
    return {
      name: "DemoInferenceService (UrbanNex-Edge-v2)",
      version: "2.4.0-sih2026",
      architecture: "Lightweight MobileNet-SSD / YOLO-Nano Edge Prototype",
      hardwareTarget: "NVIDIA Jetson Orin Nano / RPi5 Onboard Unit",
      fpsTarget: 28.6,
      isEdgeHosted: true,
      isSimulated: true
    };
  }
  calculate_confidence(features) {
    const base = 0.85;
    const boost = features.signalToNoise * 0.05 + features.clarity * 0.05 + features.sizeRatio * 0.04;
    const score = Math.min(0.985, Math.max(0.72, base + boost));
    return parseFloat(score.toFixed(3));
  }
  calculate_severity(type, confidence, roadMetric) {
    if (type === "waterlogging") {
      return confidence > 0.9 ? "critical" : "high";
    }
    if (type === "pothole") {
      if (roadMetric && roadMetric.includes("depth > 8cm")) return "critical";
      return confidence > 0.92 ? "high" : "medium";
    }
    if (type === "congestion") {
      return confidence > 0.9 ? "high" : "medium";
    }
    if (type === "pedestrian_risk") {
      return confidence > 0.94 ? "critical" : "medium";
    }
    return "medium";
  }
  track(objects) {
    this.currentTrackedObjects = objects.map((obj) => ({
      ...obj,
      dwellFrames: obj.dwellFrames + 1
    }));
    return this.currentTrackedObjects;
  }
  async detect(frame) {
    const startTime = performance.now();
    const types = ["pothole", "road_damage", "waterlogging", "congestion", "pedestrian_risk"];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    const clarity = 0.75 + Math.random() * 0.24;
    const signalToNoise = 0.8 + Math.random() * 0.18;
    const sizeRatio = 0.6 + Math.random() * 0.35;
    const confidence = this.calculate_confidence({ signalToNoise, clarity, sizeRatio });
    let metric = "Standard asphalt pavement inspection";
    let boxes = [];
    let evidenceKey = "simulated_pothole_01";
    let notes = "";
    if (chosenType === "pothole") {
      const depth = (5 + Math.random() * 7).toFixed(1);
      metric = `Asphalt cavity (depth approx. ${depth}cm, width 42cm)`;
      evidenceKey = "simulated_pothole_01";
      notes = `Localized pavement breach with exposed aggregate base. Depth: ${depth}cm.`;
      boxes = [
        {
          x: 35 + Math.floor(Math.random() * 15),
          y: 52 + Math.floor(Math.random() * 10),
          width: 26,
          height: 18,
          label: `Pothole (${(confidence * 100).toFixed(1)}%)`,
          confidence
        }
      ];
    } else if (chosenType === "waterlogging") {
      const depthEst = (8 + Math.random() * 10).toFixed(1);
      metric = `Standing water pool covering vehicle lane (est. ${depthEst}cm)`;
      evidenceKey = "simulated_waterlogging_01";
      notes = `High specular water reflectance detected. Depth: ${depthEst}cm, potential hydroplaning risk.`;
      boxes = [
        {
          x: 20 + Math.floor(Math.random() * 10),
          y: 45 + Math.floor(Math.random() * 10),
          width: 55,
          height: 32,
          label: `Waterlogging (${(confidence * 100).toFixed(1)}%)`,
          confidence
        }
      ];
    } else if (chosenType === "road_damage") {
      metric = "Longitudinal and alligator surface cracking across 4.2m";
      evidenceKey = "simulated_damage_01";
      notes = "Surface fatigue failure with potential for rapid hole development under monsoonal rain.";
      boxes = [
        {
          x: 30 + Math.floor(Math.random() * 15),
          y: 55 + Math.floor(Math.random() * 8),
          width: 38,
          height: 20,
          label: `Surface Damage (${(confidence * 100).toFixed(1)}%)`,
          confidence
        }
      ];
    } else if (chosenType === "congestion") {
      metric = `Traffic bottleneck speed < ${frame.speed} km/h`;
      evidenceKey = "simulated_congestion_01";
      notes = "Dense cluster of stationary vehicles causing transit slowdown.";
      boxes = [
        {
          x: 18,
          y: 38,
          width: 65,
          height: 38,
          label: `Gridlock (${(confidence * 100).toFixed(1)}%)`,
          confidence
        }
      ];
    } else {
      metric = "Pedestrian crossing zone safety alert";
      evidenceKey = "simulated_pedestrian_01";
      notes = "Pedestrians navigating obstructed sidewalk edge in live bus lane.";
      boxes = [
        {
          x: 40,
          y: 48,
          width: 24,
          height: 32,
          label: `Pedestrian Risk (${(confidence * 100).toFixed(1)}%)`,
          confidence
        }
      ];
    }
    const severity = this.calculate_severity(chosenType, confidence, metric);
    this.track([
      {
        trackId: ++this.trackerIdCounter,
        label: chosenType,
        box: boxes[0],
        dwellFrames: 1,
        confidence
      }
    ]);
    const latencyMs = parseFloat((performance.now() - startTime + (15 + Math.random() * 12)).toFixed(1));
    return {
      hasDetection: true,
      type: chosenType,
      confidence,
      severity,
      boundingBoxes: boxes,
      roadSurfaceMetric: metric,
      evidenceKey,
      notes,
      latencyMs
    };
  }
};

// server.ts
var app = (0, import_express.default)();
var PORT = Number(process.env.PORT || 3e3);
var server = import_http.default.createServer(app);
var allowedOrigins = new Set(
  [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ].filter(Boolean).flatMap((value) => value.split(",").map((entry) => entry.trim()).filter(Boolean))
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || allowedOrigins.has(origin) || !origin && req.method === "OPTIONS";
  if (isAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use((req, res, next) => {
  if (req.url.startsWith("/index")) {
    req.url = req.url.replace(/^\/index/, "");
  }
  if (!req.url.startsWith("/api") && req.url !== "/" && !req.url.startsWith("/ws")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});
app.use(import_express.default.json({ limit: "5mb" }));
app.get("/api", (_req, res) => {
  res.json({ status: "ok", message: "UrbanNex AI API is running", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var databaseInitializationError;
var databaseReady = initializeDatabase().then(async () => {
  await bootstrapMainBranch();
  detections = await loadPersistedDetections();
  await loadSimulationState();
}).catch((error) => {
  databaseInitializationError = error;
  console.error("[Database] Initialization failed:", error);
});
app.use(async (_req, res, next) => {
  await databaseReady;
  if (databaseInitializationError) {
    return res.status(503).json({
      code: "DATABASE_UNAVAILABLE",
      error: "Persistent database is unavailable."
    });
  }
  if (process.env.VERCEL) {
    try {
      detections = await loadPersistedDetections();
    } catch (error) {
      console.warn("[Database] Failed to refresh persisted incidents, keeping in-memory:", error);
    }
  }
  next();
});
var upload = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});
function publicUser(user) {
  return { ...user };
}
async function bootstrapMainBranch() {
  const accountsToEnsure = [
    {
      email: "iamgokulvanan@gmail.com",
      password: "gokul123@",
      role: "main",
      department: null,
      name: "Main Branch Director (Gokulvanan)"
    },
    {
      email: "admin@urbannex.ai",
      password: "admin123",
      role: "main",
      department: null,
      name: "Main Branch Authority"
    },
    {
      email: "roads@urbannex.ai",
      password: "roads123@",
      role: "department",
      department: "Roads & Infrastructure",
      name: "Eng. K. Rajesh (Roads & Infrastructure)"
    },
    {
      email: "water@urbannex.ai",
      password: "water123@",
      role: "department",
      department: "Water & Drainage",
      name: "Officer M. Senthil (Water & Drainage)"
    },
    {
      email: "traffic@urbannex.ai",
      password: "traffic123@",
      role: "department",
      department: "Traffic Management",
      name: "Inspector P. Kumar (Traffic Management)"
    },
    {
      email: "safety@urbannex.ai",
      password: "safety123@",
      role: "department",
      department: "Public Safety",
      name: "Officer R. Anand (Public Safety)"
    },
    {
      email: "emergency@urbannex.ai",
      password: "emergency123@",
      role: "department",
      department: "Emergency Response",
      name: "Captain S. Vijay (Emergency Response)"
    }
  ];
  const envEmail = process.env.URBANNEX_ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.URBANNEX_ADMIN_PASSWORD;
  if (envEmail && envPassword && !accountsToEnsure.some((a) => a.email === envEmail)) {
    accountsToEnsure.push({
      email: envEmail,
      password: envPassword,
      role: "main",
      department: null,
      name: "Main Branch Authority"
    });
  }
  for (const account of accountsToEnsure) {
    if (account.password.length < 4) continue;
    const existing = await dbGet("SELECT id FROM users WHERE email = ?", [account.email]);
    const credentials = hashPassword(account.password);
    if (existing) {
      await dbRun(
        "UPDATE users SET password_hash = ?, password_salt = ?, role = ?, department = ?, requested_department = ?, approved = 1 WHERE id = ?",
        [credentials.hash, credentials.salt, account.role, account.department, account.department, existing.id]
      );
      console.log(`[Auth] Account updated (${account.email} \xB7 ${account.role}).`);
    } else {
      await dbRun(`
        INSERT INTO users (name, email, password_hash, password_salt, role, department, requested_department, approved, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [account.name, account.email, credentials.hash, credentials.salt, account.role, account.department, account.department, (/* @__PURE__ */ new Date()).toISOString()]);
      console.log(`[Auth] Account bootstrapped (${account.email} \xB7 ${account.role}).`);
    }
  }
}
function hashPassword(password, salt = (0, import_node_crypto.randomBytes)(16).toString("hex")) {
  return {
    salt,
    hash: (0, import_node_crypto.scryptSync)(password, salt, 64).toString("hex")
  };
}
async function sendAuthorityEmail(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[Email] Resend is not configured; authority email was not delivered.");
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text })
  });
  if (!response.ok) throw new Error(`Email provider responded with ${response.status}`);
  return true;
}
function getApplicationUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
async function notifyDepartmentOfIncident(detection, changedBy) {
  if (!detection.department) return;
  const recipients = await dbAll(`
    SELECT email FROM users WHERE role = 'department' AND department = ? AND approved = 1
  `, [detection.department]);
  const subject = `UrbanNex incident ${detection.id}: ${detection.status.replace("_", " ")}`;
  const text = [
    `Incident ${detection.id} has been updated.`,
    `Type: ${detection.type.replace("_", " ")}`,
    `Severity: ${detection.severity}`,
    `Status: ${detection.status.replace("_", " ")}`,
    `Department: ${detection.department}`,
    `Location: ${detection.locationName}`,
    `Coordinates: ${detection.latitude}, ${detection.longitude}`,
    `Bus / route: ${detection.busId} / ${detection.routeId}`,
    `Updated by: ${changedBy}`,
    detection.notes ? `Notes: ${detection.notes}` : "",
    `Open UrbanNex: ${getApplicationUrl()}`
  ].filter(Boolean).join("\n");
  for (const recipient of recipients) {
    void sendAuthorityEmail(recipient.email, subject, text).catch((error) => {
      console.error(`[Email] Incident notification delivery failed for ${detection.id}:`, error);
    });
  }
}
function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || "urbannex-prod-security-secret-2026-cbe";
}
function hashSessionToken(token) {
  const secret = getSessionSecret();
  return (0, import_node_crypto.createHash)("sha256").update(`${secret}:${token}`).digest("hex");
}
function createSignedSessionToken(user) {
  const secret = getSessionSecret();
  const payload = JSON.stringify({
    id: user.id,
    email: user.email.toLowerCase(),
    role: user.role,
    department: user.department,
    ts: Date.now(),
    rnd: (0, import_node_crypto.randomBytes)(8).toString("hex")
  });
  const b64Payload = Buffer.from(payload).toString("base64url");
  const sig = (0, import_node_crypto.createHmac)("sha256", secret).update(b64Payload).digest("base64url");
  return `${b64Payload}.${sig}`;
}
function verifySignedSessionToken(token) {
  try {
    const [b64Payload, sig] = token.split(".");
    if (!b64Payload || !sig) return null;
    const secret = getSessionSecret();
    const expectedSig = (0, import_node_crypto.createHmac)("sha256", secret).update(b64Payload).digest("base64url");
    if (sig !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    return data;
  } catch {
    return null;
  }
}
async function getUserByToken(token) {
  if (!token) return null;
  const lookupToken = hashSessionToken(token);
  const dbUser = await dbGet(`
    SELECT users.id, users.name, users.email, users.role, users.department, users.approved
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `, [lookupToken]);
  if (dbUser) return { ...dbUser, approved: Boolean(dbUser.approved) };
  const verified = verifySignedSessionToken(token);
  if (!verified) return null;
  const user = await dbGet(`
    SELECT id, name, email, role, department, approved FROM users WHERE email = ?
  `, [verified.email.toLowerCase()]);
  if (user) return { ...user, approved: Boolean(user.approved) };
  return null;
}
function getBearerToken(req) {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : void 0;
}
async function createSession(user) {
  const token = createSignedSessionToken(user);
  const storedToken = hashSessionToken(token);
  await dbRun("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [storedToken, user.id, (/* @__PURE__ */ new Date()).toISOString()]);
  return { token, user: publicUser(user) };
}
async function requireUser(req, res) {
  const user = await getUserByToken(getBearerToken(req));
  if (!user || !user.approved) {
    res.status(401).json({ error: "Please sign in with an approved authority account." });
    return null;
  }
  return user;
}
async function requireMainBranch(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== "main") {
    res.status(403).json({ error: "Main-branch authority is required for this action." });
    return null;
  }
  return user;
}
function canAccessDetection(user, detection) {
  return user.role === "main" || detection.department === user.department;
}
var buses = JSON.parse(JSON.stringify(INITIAL_BUSES));
async function loadPersistedDetections() {
  const rows = [
    ...await dbAll("SELECT payload FROM detection_state ORDER BY updated_at DESC"),
    ...await dbAll("SELECT payload FROM mobile_detections ORDER BY created_at DESC")
  ];
  const byId = /* @__PURE__ */ new Map();
  for (const row of rows) {
    try {
      const detection = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      if (detection?.id && !byId.has(detection.id)) byId.set(detection.id, detection);
    } catch {
      console.error("[Database] Skipping malformed persisted detection payload.");
    }
  }
  for (const detection of INITIAL_DETECTIONS) {
    if (!byId.has(detection.id)) byId.set(detection.id, detection);
  }
  return [...byId.values()].slice(0, 200);
}
async function persistDetection(detection) {
  await dbRun(`
    INSERT INTO detection_state (id, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `, [detection.id, JSON.stringify(detection), (/* @__PURE__ */ new Date()).toISOString()]);
  if (isPostgres()) {
    await dbRun(`
      INSERT INTO detections (id, type, confidence, severity, latitude, longitude, location_name, bus_id, timestamp, evidence_image, status, department, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type, confidence = excluded.confidence, severity = excluded.severity,
        latitude = excluded.latitude, longitude = excluded.longitude, location_name = excluded.location_name,
        bus_id = excluded.bus_id, timestamp = excluded.timestamp, evidence_image = excluded.evidence_image,
        status = excluded.status, department = excluded.department, notes = excluded.notes
    `, [
      detection.id,
      detection.type,
      detection.confidence,
      detection.severity,
      detection.latitude,
      detection.longitude,
      detection.locationName,
      detection.busId,
      detection.timestamp,
      detection.evidenceImage,
      detection.status,
      detection.department || null,
      detection.notes || null
    ]);
    const latestHistory = detection.history[0];
    if (latestHistory) {
      const alreadyStored = await dbGet(
        "SELECT id FROM incident_history WHERE detection_id = ? AND timestamp = ? AND new_status = ?",
        [detection.id, latestHistory.timestamp, latestHistory.newStatus]
      );
      if (!alreadyStored) {
        await dbRun(`
          INSERT INTO incident_history (detection_id, previous_status, new_status, timestamp, changed_by, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          detection.id,
          latestHistory.previousStatus,
          latestHistory.newStatus,
          latestHistory.timestamp,
          latestHistory.changedBy,
          latestHistory.note || null
        ]);
      }
    }
  }
}
var detections = [...INITIAL_DETECTIONS];
var simulationRunning = true;
var simulationSpeedMultiplier = 1;
var detectionCounter = 129;
async function loadSimulationState() {
  const setting = await dbGet("SELECT value FROM app_settings WHERE key = ?", ["simulation"]);
  if (!setting) return;
  const value = typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value;
  if (typeof value.isRunning === "boolean") simulationRunning = value.isRunning;
  if ([1, 2, 3].includes(Number(value.speed))) simulationSpeedMultiplier = Number(value.speed);
}
async function persistSimulationState() {
  await dbRun(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `, ["simulation", JSON.stringify({ isRunning: simulationRunning, speed: simulationSpeedMultiplier }), (/* @__PURE__ */ new Date()).toISOString()]);
}
var demoInference = new DemoInferenceService();
var liveWebSocketClients = /* @__PURE__ */ new Set();
var wss = new import_ws.WebSocketServer({ noServer: true });
wss.on("connection", (ws) => {
  liveWebSocketClients.add(ws);
  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(String(raw));
      if (message?.action === "ping") {
        ws.send(JSON.stringify({ type: "pong", data: { ok: true } }));
      }
    } catch {
    }
  });
  ws.on("close", () => liveWebSocketClients.delete(ws));
  ws.on("error", () => liveWebSocketClients.delete(ws));
});
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  if (pathname !== "/ws/live") {
    socket.destroy();
    return;
  }
  const token = new URL(request.url || "/", "http://localhost").searchParams.get("token");
  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    void (async () => {
      const user = await getUserByToken(token);
      if (!user || !user.approved) {
        ws.send(JSON.stringify({ type: "auth:error", data: { code: "SESSION_EXPIRED", error: "Session expired." } }));
        ws.close();
        return;
      }
      wss.emit("connection", ws, request);
      ws.send(JSON.stringify({ type: "init:state", data: { buses, detections, routes: INITIAL_ROUTES, simulation: { isRunning: simulationRunning, speed: simulationSpeedMultiplier } } }));
    })().catch(() => {
      ws.close();
    });
  });
});
async function broadcast(type, payload) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (!["detection:new", "detection:status_changed"].includes(type)) return;
  const detection = payload.detection;
  const targetDepartment = detection?.department || null;
  await dbRun(
    "INSERT INTO realtime_events (event_type, payload, target_department, created_at) VALUES (?, ?, ?, ?)",
    [type, JSON.stringify({ ...payload, timestamp }), targetDepartment, timestamp]
  );
  const eventPayload = JSON.stringify({ type, data: payload });
  for (const client of [...liveWebSocketClients]) {
    if (client.readyState === 1) {
      client.send(eventPayload);
    }
  }
}
function calculateHeading(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) - Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return Math.round((brng + 360) % 360);
}
function tickSimulation() {
  if (!simulationRunning) return;
  const stepDistanceKm = 0.018 * simulationSpeedMultiplier;
  buses = buses.map((bus) => {
    const route = INITIAL_ROUTES.find((r) => r.id === bus.routeId);
    if (!route || route.waypoints.length < 2) return bus;
    const waypoints = route.waypoints;
    const totalSegments = waypoints.length - 1;
    let newProgress = bus.routeProgress + 8e-3 * simulationSpeedMultiplier;
    if (newProgress >= 1) {
      newProgress = 1e-3;
    }
    const currentSegmentIndex = Math.min(
      totalSegments - 1,
      Math.floor(newProgress * totalSegments)
    );
    const segmentSubProgress = newProgress * totalSegments - currentSegmentIndex;
    const p1 = waypoints[currentSegmentIndex];
    const p2 = waypoints[currentSegmentIndex + 1] || waypoints[0];
    const newLat = p1[0] + (p2[0] - p1[0]) * segmentSubProgress;
    const newLng = p1[1] + (p2[1] - p1[1]) * segmentSubProgress;
    const newHeading = calculateHeading(p1[0], p1[1], p2[0], p2[1]) || bus.heading;
    const speedVariation = Math.floor(Math.sin(Date.now() / 1e4 + parseInt(bus.id.replace("BUS-", ""))) * 5);
    const speed = Math.max(15, Math.min(52, 32 + speedVariation));
    const fps = parseFloat((28.2 + Math.random() * 1.6).toFixed(1));
    return {
      ...bus,
      latitude: parseFloat(newLat.toFixed(6)),
      longitude: parseFloat(newLng.toFixed(6)),
      heading: newHeading,
      speed,
      fps,
      routeProgress: newProgress,
      lastSeen: "Just now"
    };
  });
}
async function triggerSimulatedDetection(selectedBusId, forcedType) {
  const targetBus = selectedBusId ? buses.find((b) => b.id === selectedBusId) : buses[Math.floor(Math.random() * buses.length)];
  if (!targetBus) return null;
  const result = await demoInference.detect({
    busId: targetBus.id,
    routeId: targetBus.routeId,
    latitude: targetBus.latitude,
    longitude: targetBus.longitude,
    speed: targetBus.speed,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  const detectionId = `DET-2026-00${++detectionCounter}`;
  const detectionType = forcedType || result.type || "pothole";
  const locationNames = [
    "Gandhipuram North Cross Rd, Near Signal 4",
    "Avinashi Rd, KMCH Junction",
    "Peelamedu Tech Park Entry, Fun Mall Cross",
    "RS Puram West DB Road",
    "Town Hall South Underpass Corridor",
    "100 Feet Road Elevated Flyover Ramp",
    "Ukkadam Bypass Bus Terminal Access",
    "Cross Cut Commercial District, Ward 12"
  ];
  const locationName = locationNames[Math.floor(Math.random() * locationNames.length)];
  const newDetection = {
    id: detectionId,
    type: detectionType,
    confidence: result.confidence || 0.935,
    severity: result.severity || "high",
    latitude: parseFloat((targetBus.latitude + (Math.random() - 0.5) * 6e-4).toFixed(6)),
    longitude: parseFloat((targetBus.longitude + (Math.random() - 0.5) * 6e-4).toFixed(6)),
    locationName,
    busId: targetBus.id,
    routeId: targetBus.routeId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status: "pending_verification",
    evidenceImage: result.evidenceKey || "simulated_pothole_01",
    simulatedBoundingBoxes: result.boundingBoxes,
    roadSurfaceMetric: result.roadSurfaceMetric,
    speedAtDetection: targetBus.speed,
    notes: result.notes || "Autonomous Edge AI detection via bus forward stereoscopic optical sensor.",
    history: [
      {
        id: `H-${Date.now()}`,
        detectionId,
        previousStatus: "pending_verification",
        newStatus: "pending_verification",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        changedBy: `Edge AI (${targetBus.id})`,
        note: "High-confidence inference matched urban hazard model"
      }
    ]
  };
  detections = [newDetection, ...detections.slice(0, 199)];
  await persistDetection(newDetection);
  targetBus.totalDetections += 1;
  targetBus.lastDetection = {
    type: detectionType,
    timestamp: "Just now"
  };
  await broadcast("detection:new", {
    detection: newDetection,
    bus: targetBus,
    notification: {
      id: `NOTIF-${Date.now()}`,
      title: `New ${detectionType.replace("_", " ").toUpperCase()} Detected`,
      message: `${targetBus.id} detected ${detectionType.replace("_", " ")} at ${locationName} (Confidence: ${(newDetection.confidence * 100).toFixed(1)}%)`,
      type: newDetection.severity === "critical" ? "critical" : "warning",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      relatedDetectionId: detectionId,
      relatedBusId: targetBus.id
    }
  });
  return newDetection;
}
async function updateIncidentStatus(id, newStatus, changedBy, department, note) {
  const index = detections.findIndex((d) => d.id === id);
  if (index === -1) return null;
  const current = detections[index];
  const prevStatus = current.status;
  const allowedPreviousStatuses = {
    verified: ["pending_verification"],
    rejected: ["pending_verification"],
    assigned: ["verified"],
    in_progress: ["assigned"],
    resolved: ["in_progress"]
  };
  if (allowedPreviousStatuses[newStatus] && !allowedPreviousStatuses[newStatus]?.includes(prevStatus)) return null;
  if (newStatus === "assigned" && (!department || !DEPARTMENTS.includes(department))) return null;
  const historyEntry = {
    id: `H-${Date.now()}`,
    detectionId: id,
    previousStatus: prevStatus,
    newStatus,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    changedBy,
    note: note || (department ? `Assigned to ${department}` : `Status transitioned to ${newStatus}`)
  };
  const updated = {
    ...current,
    status: newStatus,
    department: department || current.department,
    notes: note ? `${current.notes ? current.notes + " | " : ""}${note}` : current.notes,
    history: [historyEntry, ...current.history]
  };
  detections[index] = updated;
  await persistDetection(updated);
  if (["assigned", "in_progress", "resolved"].includes(newStatus)) {
    await notifyDepartmentOfIncident(updated, changedBy);
  }
  await broadcast("detection:status_changed", {
    detection: updated,
    notification: {
      id: `NOTIF-${Date.now()}`,
      title: `Incident ${id} Updated`,
      message: `${id} moved to ${newStatus.replace("_", " ").toUpperCase()}${department ? ` (${department})` : ""}`,
      type: newStatus === "resolved" ? "success" : "info",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      relatedDetectionId: id
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
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  const busTimer = setInterval(tickSimulation, 2e3);
  const detectionTimer = setInterval(() => {
    if (simulationRunning && Math.random() > 0.45) void triggerSimulatedDetection();
  }, 18e3);
  busTimer.unref();
  detectionTimer.unref();
}
function makeDetectionSvg(x1, y1, x2, y2, confidence, frame, label) {
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
function inferVideoIssueType(fileName) {
  const lower = fileName.toLowerCase();
  if (/(water|flood|logging|drain|pond|storm)/.test(lower)) return "waterlogging";
  if (/(traffic|jam|congestion|queue|gridlock|vehicle)/.test(lower)) return "congestion";
  if (/(pedestrian|people|crosswalk|crowd|walking)/.test(lower)) return "pedestrian_risk";
  if (/(road|crack|damage|pavement|surface)/.test(lower)) return "road_damage";
  return "pothole";
}
function mapSeverity(type, confidence) {
  if (type === "waterlogging") return confidence > 0.9 ? "critical" : "high";
  if (type === "pedestrian_risk") return confidence > 0.94 ? "critical" : "medium";
  if (type === "congestion") return "high";
  if (type === "pothole") return confidence > 0.92 ? "high" : "medium";
  if (type === "road_damage") return confidence > 0.9 ? "high" : "medium";
  return "medium";
}
function buildSyntheticVideoAnalysis(fileName) {
  const issueType = inferVideoIssueType(fileName);
  const detectionCount = 2 + Math.floor(Math.random() * 3);
  const detections2 = Array.from({ length: detectionCount }, (_, index) => {
    const normalizedIndex = index + 1;
    const confidence = Number(Math.min(0.99, 0.82 + normalizedIndex * 0.06 + Math.random() * 0.08).toFixed(3));
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
      frame_image: makeDetectionSvg(x1, y1, x2, y2, confidence, frame, issueType)
    };
  });
  return {
    success: true,
    video_name: fileName,
    detections: detections2,
    total_detections: detections2.length,
    confidence_threshold: 0.4,
    frame_interval: 3
  };
}
function buildSyntheticImageAnalysis(fileName, dataUri) {
  const issueType = inferVideoIssueType(fileName);
  const confidence = Number((0.89 + Math.random() * 0.09).toFixed(3));
  const x1 = 120 + Math.round(Math.random() * 80);
  const y1 = 140 + Math.round(Math.random() * 60);
  const x2 = x1 + 220 + Math.round(Math.random() * 80);
  const y2 = y1 + 130 + Math.round(Math.random() * 70);
  const severity = mapSeverity(issueType, confidence);
  const descriptions = {
    pothole: "Severe pavement depression and asphalt cavitation detected in transit lane.",
    road_damage: "Extensive structural asphalt cracking and lateral degradation observed.",
    waterlogging: "Stormwater accumulation impeding vehicular traction and pedestrian safety.",
    congestion: "High-density vehicle accumulation creating bottleneck at urban arterial.",
    pedestrian_risk: "Pedestrian in close proximity to active transit roadway without designated crossing."
  };
  const departments = {
    pothole: "Roads & Infrastructure",
    road_damage: "Roads & Infrastructure",
    waterlogging: "Water & Drainage",
    congestion: "Traffic Management",
    pedestrian_risk: "Public Safety"
  };
  const detection = {
    class: issueType,
    type: issueType,
    severity,
    confidence,
    bbox: { x1, y1, x2, y2 },
    frame: 1,
    timestamp: 0,
    description: descriptions[issueType] || "Civic infrastructure anomaly detected.",
    department: departments[issueType] || "Roads & Infrastructure",
    frame_image: dataUri || makeDetectionSvg(x1, y1, x2, y2, confidence, 1, issueType)
  };
  return {
    success: true,
    media_type: "image",
    file_name: fileName,
    video_name: fileName,
    detections: [detection],
    total_detections: 1,
    confidence_threshold: 0.4
  };
}
var handleMediaAnalysis = async (req, res) => {
  const file = req.file;
  const bodyImage = req.body?.image;
  const fileName = (file?.originalname || req.body?.fileName || "analyzed-media").trim();
  const explicitType = req.body?.mediaType;
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".svg"];
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  const extension = import_path.default.extname(fileName).toLowerCase();
  const isImage = explicitType === "image" || Boolean(bodyImage) || imageExtensions.includes(extension) || file?.mimetype?.startsWith("image/");
  const isVideo = explicitType === "video" || videoExtensions.includes(extension) || file?.mimetype?.startsWith("video/");
  if (!file && !bodyImage) {
    return res.status(400).json({ detail: "Upload a video or image file before starting analysis." });
  }
  if (file && file.size > 200 * 1024 * 1024) {
    return res.status(413).json({ detail: "Media file is too large for processing." });
  }
  if (isImage) {
    const dataUri = bodyImage || (file ? `data:${file.mimetype || "image/jpeg"};base64,${file.buffer.toString("base64")}` : void 0);
    const result = buildSyntheticImageAnalysis(fileName, dataUri);
    return res.status(200).json(result);
  }
  if (isVideo || !extension) {
    const result = buildSyntheticVideoAnalysis(fileName);
    return res.status(200).json(result);
  }
  return res.status(400).json({ detail: "Unsupported format. Upload an MP4, MOV, WEBM video or JPG, PNG, WEBP image." });
};
app.post("/api/detections/analyze", async (req, res, next) => {
  if (!await requireMainBranch(req, res)) return;
  next();
}, upload.single("file"), handleMediaAnalysis);
app.post("/api/detections/video", async (req, res, next) => {
  if (!await requireMainBranch(req, res)) return;
  next();
}, upload.single("video"), handleMediaAnalysis);
var healthCheck = async (_req, res) => {
  try {
    await dbGet("SELECT 1");
    res.json({ status: "ok", database: databaseProvider(), time: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (error) {
    console.error("[Health] Database check failed:", error);
    res.status(503).json({ status: "error", database: "unavailable", code: "DATABASE_UNAVAILABLE" });
  }
};
app.get("/health", healthCheck);
app.get("/api/health", healthCheck);
app.post("/api/auth/signup", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const requestedDepartmentValue = String(req.body.department || "").trim();
  const requestedDepartment = requestedDepartmentValue && DEPARTMENTS.includes(requestedDepartmentValue) ? requestedDepartmentValue : null;
  if (!name || !email || password.length < 4 || requestedDepartmentValue && !requestedDepartment) {
    return res.status(400).json({ error: "Name, email, and a password of at least 4 characters are required." });
  }
  const credentials = hashPassword(password);
  try {
    await dbRun(`
      INSERT INTO users (name, email, password_hash, password_salt, role, requested_department, approved, created_at)
      VALUES (?, ?, ?, ?, 'department', ?, FALSE, ?)
    `, [name, email, credentials.hash, credentials.salt, requestedDepartment, (/* @__PURE__ */ new Date()).toISOString()]);
    return res.status(202).json({ pendingApproval: true, message: "Your account request was sent to the main branch for approval." });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ code: "ACCOUNT_EXISTS", error: "An account with this email already exists." });
    }
    console.error("[Auth] Signup failed:", error);
    return res.status(500).json({ code: "DATABASE_UNAVAILABLE", error: "Unable to create the account because the authentication database failed." });
  }
});
function createSignedResetToken(userId, email) {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + 30 * 60 * 1e3;
  const payload = `${userId}:${email.toLowerCase()}:${expiresAt}`;
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = (0, import_node_crypto.createHmac)("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}
function verifySignedResetToken(token, expectedEmail, expectedUserId) {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return false;
    const secret = getSessionSecret();
    const expectedSig = (0, import_node_crypto.createHmac)("sha256", secret).update(b64).digest("base64url");
    if (sig !== expectedSig) return false;
    const decoded = Buffer.from(b64, "base64url").toString("utf-8");
    const [userId, email, expiresAt] = decoded.split(":");
    if (String(userId) !== String(expectedUserId)) return false;
    if (email.toLowerCase() !== expectedEmail.toLowerCase()) return false;
    if (Date.now() > Number(expiresAt)) return false;
    return true;
  } catch {
    return false;
  }
}
app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || email.length > 254) return res.status(400).json({ error: "Enter a valid account email." });
  const genericMessage = "If an account exists for that email, password reset instructions have been sent.";
  const account = await dbGet("SELECT id, email FROM users WHERE email = ?", [email]);
  if (!account) return res.json({ message: genericMessage });
  const resetToken = createSignedResetToken(account.id, account.email);
  const tokenHash = (0, import_node_crypto.createHash)("sha256").update(resetToken).digest("hex");
  const now = /* @__PURE__ */ new Date();
  await dbRun("DELETE FROM password_resets WHERE user_id = ?", [account.id]);
  await dbRun(
    "INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [tokenHash, account.id, new Date(now.getTime() + 30 * 60 * 1e3).toISOString(), now.toISOString()]
  );
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.AUTH_FROM_EMAIL;
  let emailSent = false;
  if (resendKey && fromEmail) {
    try {
      const delivery = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "UrbanNex password reset token",
          text: `Hello,

Use this one-time verification token within 30 minutes to reset your UrbanNex password:

${resetToken}

UrbanNex Command Center: ${getApplicationUrl()}`
        })
      });
      emailSent = delivery.ok;
    } catch (error) {
      console.warn("[Email] Resend delivery encountered an error:", error);
    }
  }
  return res.json({
    message: emailSent ? "Password reset token was sent to your email." : "Reset verification token generated successfully.",
    resetToken,
    emailSent
  });
});
app.post("/api/auth/reset-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const token = String(req.body.token || "").trim();
  const password = String(req.body.newPassword || req.body.password || "");
  if (!email || !token || password.length < 4) {
    return res.status(400).json({ error: "Email, reset token, and a password of at least 4 characters are required." });
  }
  const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) return res.status(400).json({ error: "Reset token is invalid or expired." });
  const tokenHash = (0, import_node_crypto.createHash)("sha256").update(token).digest("hex");
  const reset = await dbGet(`
    SELECT token_hash FROM password_resets
    WHERE token_hash = ? AND user_id = ? AND expires_at > ?
  `, [tokenHash, user.id, (/* @__PURE__ */ new Date()).toISOString()]);
  const isSignedValid = verifySignedResetToken(token, email, user.id);
  if (!reset && !isSignedValid) return res.status(400).json({ error: "Reset token is invalid or expired." });
  const credentials = hashPassword(password);
  await dbRun("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", [credentials.hash, credentials.salt, user.id]);
  await dbRun("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
  await dbRun("DELETE FROM sessions WHERE user_id = ?", [user.id]);
  return res.json({ message: "Password updated. Sign in using your new password." });
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const accountType = req.body.accountType == null ? null : String(req.body.accountType);
    if (accountType !== null && !["main", "department"].includes(accountType)) {
      return res.status(400).json({ code: "INVALID_AUTHORITY_TYPE", error: "Choose a valid authority desk." });
    }
    const record = await dbGet("SELECT id, name, email, password_hash, password_salt, role, department, approved FROM users WHERE email = ?", [email]);
    if (!record || !record.password_hash || !record.password_salt) return res.status(401).json({ code: "INVALID_CREDENTIALS", error: "Invalid email or password." });
    const suppliedHash = Buffer.from(hashPassword(password, record.password_salt).hash, "hex");
    const storedHash = Buffer.from(record.password_hash, "hex");
    if (suppliedHash.length !== storedHash.length || !(0, import_node_crypto.timingSafeEqual)(suppliedHash, storedHash)) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS", error: "Invalid email or password." });
    }
    if (accountType !== null && record.role !== accountType) {
      return res.status(403).json({ code: "AUTHORITY_TYPE_MISMATCH", error: "This account is not authorized for the selected authority desk." });
    }
    if (!record.approved) {
      return res.status(403).json({ code: "DEPARTMENT_PENDING", error: "Your department access is awaiting main-branch approval." });
    }
    const loginTimestamp = (/* @__PURE__ */ new Date()).toISOString();
    const loginNoticeSubject = `[UrbanNex Security] Authority Desk Login: ${record.name} (${record.department || "Main Branch"})`;
    const loginNoticeText = [
      `UrbanNex City Command - Authority Login Alert`,
      `User: ${record.name}`,
      `Email: ${record.email}`,
      `Role: ${record.role === "main" ? "Main Branch Commander" : "Department Authority"}`,
      `Department: ${record.department || "Main Branch Command Center"}`,
      `Timestamp: ${loginTimestamp}`,
      `Portal: ${getApplicationUrl()}`
    ].join("\n");
    void sendAuthorityEmail(record.email, loginNoticeSubject, loginNoticeText).catch(() => {
    });
    if (record.email !== "iamgokulvanan@gmail.com") {
      void sendAuthorityEmail("iamgokulvanan@gmail.com", loginNoticeSubject, loginNoticeText).catch(() => {
      });
    }
    await dbRun(
      "INSERT INTO realtime_events (event_type, payload, target_department, created_at) VALUES (?, ?, ?, ?)",
      ["auth:login", JSON.stringify({ userId: record.id, name: record.name, email: record.email, role: record.role, department: record.department, timestamp: loginTimestamp }), record.department || null, loginTimestamp]
    );
    return res.json(await createSession({
      id: Number(record.id),
      name: record.name,
      email: record.email,
      role: record.role,
      department: record.department,
      approved: Boolean(record.approved)
    }));
  } catch (error) {
    console.error("[Auth] Login failed:", error);
    return res.status(500).json({ code: "DATABASE_UNAVAILABLE", error: "Authentication could not complete because the user database failed." });
  }
});
app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getUserByToken(getBearerToken(req));
    if (!user) return res.status(401).json({ code: "SESSION_EXPIRED", error: "Session expired." });
    if (!user.approved) return res.status(403).json({ code: "DEPARTMENT_PENDING", error: "Your department access is awaiting main-branch approval." });
    return res.json({ user });
  } catch (error) {
    console.error("[Auth] Session lookup failed:", error);
    return res.status(500).json({ code: "DATABASE_UNAVAILABLE", error: "Authentication database is unavailable." });
  }
});
app.get("/api/admin/authorities", async (req, res) => {
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
app.get("/api/admin/authority-requests", async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const requests = await dbAll(`
    SELECT id, name, email, requested_department AS requestedDepartment, created_at AS createdAt
    FROM users WHERE role = 'department' AND approved = FALSE ORDER BY created_at ASC
  `);
  res.json({ requests });
});
app.post("/api/admin/authority-requests/:id/approve", async (req, res) => {
  const approver = await requireMainBranch(req, res);
  if (!approver) return;
  const department = String(req.body.department || "");
  if (!DEPARTMENTS.includes(department)) {
    return res.status(400).json({ error: "Choose a valid department." });
  }
  const result = await dbRun(`
    UPDATE users SET department = ?, approved = TRUE
    WHERE id = ? AND role = 'department' AND approved = FALSE
  `, [department, Number(req.params.id)]);
  if (!result.changes) return res.status(404).json({ error: "Authority request not found." });
  const account = await dbGet("SELECT name, email FROM users WHERE id = ?", [Number(req.params.id)]);
  if (!account) return res.status(404).json({ error: "Authority request not found." });
  let emailSent = false;
  try {
    emailSent = await sendAuthorityEmail(
      account.email,
      "Your UrbanNex department access is approved",
      [
        `Hello ${account.name},`,
        "",
        `Main branch approved your authority account for: ${department}.`,
        "Sign in using the Department authority desk and the password you set during signup.",
        "For security, your password is not included in this email.",
        `Open UrbanNex: ${getApplicationUrl()}`
      ].join("\n")
    );
  } catch (error) {
    console.error("[Email] Authority approval notification failed:", error);
  }
  res.json({ approved: true, department, emailSent, approvedBy: approver.name });
});
app.post("/api/auth/logout", async (req, res) => {
  const token = getBearerToken(req);
  if (token) await dbRun("DELETE FROM sessions WHERE token = ?", [hashSessionToken(token)]);
  return res.status(204).send();
});
app.get("/api/live/state", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const state = {
    buses: user.role === "main" ? buses : [],
    detections: user.role === "main" ? detections : detections.filter((item) => canAccessDetection(user, item)),
    routes: user.role === "main" ? INITIAL_ROUTES : [],
    simulation: user.role === "main" ? { isRunning: simulationRunning, speed: simulationSpeedMultiplier } : void 0,
    modelInfo: demoInference.getModelInfo()
  };
  res.json(state);
});
app.get("/api/live/events", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const afterId = Math.max(0, Number(req.query.after) || 0);
  const requestedLimit = Math.max(1, Number(req.query.limit) || 100);
  const limit = Math.min(250, requestedLimit);
  const events = user.role === "main" ? await dbAll(
    "SELECT id, event_type, payload, created_at FROM realtime_events WHERE id > ? ORDER BY id ASC LIMIT ?",
    [afterId, limit]
  ) : await dbAll(
    "SELECT id, event_type, payload, created_at FROM realtime_events WHERE id > ? AND target_department = ? ORDER BY id ASC LIMIT ?",
    [afterId, user.department, limit]
  );
  res.json({ events: events.map((event) => ({
    id: Number(event.id),
    type: event.event_type,
    data: typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload,
    timestamp: event.created_at
  })) });
});
app.get("/api/buses", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.role !== "main") return res.json({ buses: [], count: 0 });
  res.json({ buses, count: buses.length });
});
app.get("/api/buses/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.role !== "main") return res.status(403).json({ error: "Fleet details are restricted to main branch." });
  const bus = buses.find((b) => b.id === req.params.id);
  if (!bus) return res.status(404).json({ error: "Bus not found" });
  res.json(bus);
});
app.post("/api/detections/mobile", async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const detectionType = req.body.detectionType;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const allowedTypes = ["pothole", "road_damage", "waterlogging", "congestion", "pedestrian_risk"];
  if (!allowedTypes.includes(detectionType) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: "A valid issue type and GPS coordinates are required." });
  }
  const timestamp = String(req.body.timestamp || (/* @__PURE__ */ new Date()).toISOString());
  const result = await demoInference.detect({
    busId: "MOBILE-CAMERA",
    routeId: "MOBILE-01",
    latitude,
    longitude,
    speed: 0,
    timestamp
  });
  const confidence = result.confidence || 0.9;
  const detectionId = `MOB-${(/* @__PURE__ */ new Date()).getUTCFullYear()}-${++detectionCounter}`;
  const detection = {
    id: detectionId,
    type: detectionType,
    confidence,
    severity: demoInference.calculate_severity(detectionType, confidence, result.roadSurfaceMetric),
    latitude,
    longitude,
    locationName: `Mobile GPS capture (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
    busId: "MOBILE-CAMERA",
    routeId: "MOBILE-01",
    timestamp,
    status: "pending_verification",
    evidenceImage: String(req.body.evidenceImage || result.evidenceKey || "mobile-camera-frame"),
    source: "mobile_camera",
    gpsAccuracy: Number(req.body.gpsAccuracy) || void 0,
    simulatedBoundingBoxes: result.boundingBoxes,
    roadSurfaceMetric: result.roadSurfaceMetric,
    notes: `${result.notes || "Mobile camera evidence captured."} Frame analyzed by the UrbanNex edge inference service.`,
    history: [{
      id: `H-${Date.now()}`,
      detectionId,
      previousStatus: "pending_verification",
      newStatus: "pending_verification",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      changedBy: `Mobile Camera (${user.name})`,
      note: "Evidence captured with browser camera and device GPS."
    }]
  };
  detections = [detection, ...detections.slice(0, 199)];
  await dbRun(
    "INSERT INTO mobile_detections (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)",
    [detection.id, user.id, JSON.stringify(detection), (/* @__PURE__ */ new Date()).toISOString()]
  );
  await persistDetection(detection);
  broadcast("detection:new", {
    detection,
    notification: {
      id: `NOTIF-${Date.now()}`,
      title: `Mobile ${detectionType.replace("_", " ").toUpperCase()} Captured`,
      message: `${user.name} submitted a camera capture at ${detection.locationName}.`,
      type: detection.severity === "critical" ? "critical" : "warning",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      relatedDetectionId: detection.id
    }
  });
  return res.status(201).json({ detection });
});
app.get("/api/detections", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const { type, severity, status, bus_id } = req.query;
  let filtered = user.role === "main" ? [...detections] : detections.filter((detection) => canAccessDetection(user, detection));
  if (type) filtered = filtered.filter((d) => d.type === type);
  if (severity) filtered = filtered.filter((d) => d.severity === severity);
  if (status) filtered = filtered.filter((d) => d.status === status);
  if (bus_id) filtered = filtered.filter((d) => d.busId === bus_id);
  res.json({ detections: filtered, total: filtered.length });
});
app.get("/api/detections/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const detection = detections.find((d) => d.id === req.params.id);
  if (!detection) return res.status(404).json({ error: "Detection not found" });
  if (!canAccessDetection(user, detection)) return res.status(404).json({ error: "Detection not found" });
  res.json(detection);
});
app.post("/api/detections/import-video", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const incoming = req.body.detections;
  if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 50) {
    return res.status(400).json({ error: "Submit between 1 and 50 analyzed detections." });
  }
  const allowedTypes = ["pothole", "road_damage", "waterlogging", "congestion", "pedestrian_risk"];
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const imported = [];
  for (const item of incoming) {
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    const confidence = Number(item.confidence);
    if (!allowedTypes.includes(item.type) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || typeof item.locationName !== "string" || typeof item.busId !== "string" || typeof item.routeId !== "string") {
      return res.status(400).json({ error: "Video analysis contains an invalid detection record." });
    }
    const detectionId = `VID-${(/* @__PURE__ */ new Date()).getUTCFullYear()}-${(0, import_node_crypto.randomBytes)(6).toString("hex").toUpperCase()}`;
    const incomingStatus = ["pending_verification", "verified", "assigned", "in_progress", "resolved"].includes(item.status) ? item.status : "pending_verification";
    const resolvedDept = item.department && DEPARTMENTS.includes(item.department) ? item.department : user.role === "department" ? user.department : void 0;
    const incomingDept = resolvedDept && DEPARTMENTS.includes(resolvedDept) ? resolvedDept : void 0;
    const finalStatus = incomingDept ? incomingStatus === "pending_verification" ? "assigned" : incomingStatus : incomingStatus;
    const assignedTo = typeof item.assignedTo === "string" ? item.assignedTo.slice(0, 120) : void 0;
    const detection = {
      id: detectionId,
      type: item.type,
      confidence,
      severity: ["low", "medium", "high", "critical"].includes(item.severity) ? item.severity : "medium",
      latitude,
      longitude,
      locationName: item.locationName.slice(0, 240),
      busId: item.busId.slice(0, 80),
      routeId: item.routeId.slice(0, 80),
      timestamp: createdAt,
      status: finalStatus,
      department: incomingDept,
      assignedTo,
      evidenceImage: typeof item.evidenceImage === "string" ? item.evidenceImage.slice(0, 1e6) : "video-frame-unavailable",
      source: "mobile_camera",
      simulatedBoundingBoxes: Array.isArray(item.simulatedBoundingBoxes) ? item.simulatedBoundingBoxes.slice(0, 20) : [],
      roadSurfaceMetric: typeof item.roadSurfaceMetric === "string" ? item.roadSurfaceMetric.slice(0, 500) : void 0,
      notes: typeof item.notes === "string" ? item.notes.slice(0, 1e3) : incomingDept ? `Work order assigned to ${incomingDept}.` : "Imported from AI Analyzer.",
      history: [{
        id: `H-${Date.now()}-${imported.length}`,
        detectionId,
        previousStatus: "pending_verification",
        newStatus: finalStatus,
        timestamp: createdAt,
        changedBy: assignedTo ? `Authority Dispatch (${assignedTo})` : user.name,
        note: typeof item.notes === "string" ? item.notes.slice(0, 1e3) : incomingDept ? `Work order assigned to ${incomingDept}.` : "Imported from AI Analyzer."
      }]
    };
    imported.push(detection);
  }
  for (const detection of imported) await persistDetection(detection);
  detections = [...imported.reverse(), ...detections].slice(0, 200);
  for (const detection of imported) {
    await broadcast("detection:new", { detection });
  }
  return res.status(201).json({ detections: imported });
});
app.post("/api/detections/:id/verify", async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const updated = await updateIncidentStatus(req.params.id, "verified", user.name);
  if (!updated) return res.status(404).json({ error: "Detection not found" });
  res.json(updated);
});
app.post("/api/detections/:id/reject", async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const updated = await updateIncidentStatus(req.params.id, "rejected", user.name, void 0, req.body.reason || "False positive detection");
  if (!updated) return res.status(404).json({ error: "Detection not found" });
  res.json(updated);
});
app.post("/api/detections/:id/assign", async (req, res) => {
  const user = await requireMainBranch(req, res);
  if (!user) return;
  const { department, note } = req.body;
  if (!department) return res.status(400).json({ error: "Department is required" });
  if (!DEPARTMENTS.includes(department)) return res.status(400).json({ error: "Choose a valid department." });
  const updated = await updateIncidentStatus(req.params.id, "assigned", user.name, department, note);
  if (!updated) return res.status(404).json({ error: "Detection not found" });
  res.json(updated);
});
app.post("/api/detections/:id/in-progress", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const detection = detections.find((item) => item.id === req.params.id);
  if (!detection) return res.status(404).json({ error: "Detection not found" });
  if (user.role !== "main" && (detection.department !== user.department || detection.status !== "assigned")) {
    return res.status(403).json({ error: "You can only mobilize incidents assigned to your department." });
  }
  const updated = await updateIncidentStatus(req.params.id, "in_progress", user.name, void 0, req.body.note || "Field repair units mobilized on site");
  if (!updated) return res.status(404).json({ error: "Detection not found" });
  res.json(updated);
});
app.post("/api/detections/:id/resolve", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const detection = detections.find((item) => item.id === req.params.id);
  if (!detection) return res.status(404).json({ error: "Detection not found" });
  if (user.role !== "main" && (detection.department !== user.department || detection.status !== "in_progress")) {
    return res.status(403).json({ error: "You can only resolve incidents in progress for your department." });
  }
  const updated = await updateIncidentStatus(req.params.id, "resolved", user.name, void 0, req.body.resolutionNotes || "Pavement restored and inspected");
  if (!updated) return res.status(404).json({ error: "Detection not found" });
  res.json(updated);
});
app.get("/api/routes", async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  res.json(INITIAL_ROUTES);
});
app.get("/api/analytics", async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const byType = {
    pothole: 0,
    road_damage: 0,
    waterlogging: 0,
    congestion: 0,
    pedestrian_risk: 0
  };
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };
  const byStatus = {
    pending_verification: 0,
    verified: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0
  };
  detections.forEach((d) => {
    byType[d.type] = (byType[d.type] || 0) + 1;
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  });
  const busPerformance = buses.map((b) => ({
    busId: b.id,
    route: b.routeName,
    detections: b.totalDetections,
    verified: b.verifiedDetections,
    fps: b.fps
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
      totalTrackedKmToday: 1840
    },
    totalDetectionsCount: detections.length,
    activeBusesCount: buses.filter((b) => b.status === "active").length
  });
});
app.get("/api/system/health", async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const activeBuses = buses.filter((b) => b.status === "active").length;
  res.json({
    webSocketStatus: "disconnected",
    apiStatus: "healthy",
    databaseStatus: "connected",
    gpsStreamStatus: "active",
    aiServiceStatus: "online",
    fleetConnectivity: `${activeBuses} / ${buses.length}`,
    averageLatencyMs: 118,
    eventProcessingRate: 99.4,
    cpuUsage: 24.2,
    memoryUsage: 38.6,
    messagesPerSecond: 18,
    activeClients: 0,
    modelName: demoInference.getModelInfo().name
  });
});
app.post("/api/simulation/control", async (req, res) => {
  if (!await requireMainBranch(req, res)) return;
  const { action, speed, busId, detectionType } = req.body;
  if (action === "pause") {
    simulationRunning = false;
    broadcast("simulation:updated", { isRunning: false, speed: simulationSpeedMultiplier });
    return res.json({ status: "paused" });
  } else if (action === "resume") {
    simulationRunning = true;
    broadcast("simulation:updated", { isRunning: true, speed: simulationSpeedMultiplier });
    return res.json({ status: "resumed" });
  } else if (action === "set_speed") {
    if ([1, 2, 3].includes(speed)) {
      simulationSpeedMultiplier = speed;
      broadcast("simulation:updated", { isRunning: simulationRunning, speed: simulationSpeedMultiplier });
      return res.json({ status: "speed_updated", speed });
    }
  } else if (action === "trigger_detection") {
    const d = await triggerSimulatedDetection(busId, detectionType);
    return res.json({ status: "detection_generated", detection: d });
  } else if (action === "reset") {
    resetSimulation();
    return res.json({ status: "reset_complete" });
  }
  res.status(400).json({ error: "Invalid action" });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[UrbanNex AI] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[UrbanNex AI] WebSocket endpoint ready at ws://0.0.0.0:${PORT}/ws/live`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
