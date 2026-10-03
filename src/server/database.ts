import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

type SqlValue = string | number | boolean | null | Date | Buffer | object | undefined;
type RunResult = { changes: number; lastInsertRowid: number | bigint | undefined };
function getRequire() {
  if (typeof require !== 'undefined') return require;
  try {
    return createRequire(import.meta.url);
  } catch {
    return null;
  }
}

const isVercel = Boolean(process.env.VERCEL);
const dbDir = isVercel ? '/tmp' : process.cwd();
const sqliteFile = process.env.SQLITE_PATH || path.join(dbDir, 'urbannex.db');
const jsonFallbackFile = path.join(dbDir, 'urbannex-store.json');

// Resilient in-memory/JSON store fallback for serverless environments where SQLite binary is missing
class ResilientStore {
  private users: any[] = [];
  private sessions: any[] = [];
  private mobile_detections: any[] = [];
  private detection_state: Map<string, { id: string; payload: string; updated_at: string }> = new Map();
  private password_resets: any[] = [];
  private realtime_events: any[] = [];
  private app_settings: Map<string, { key: string; value: string; updated_at: string }> = new Map();
  private nextUserId = 1;
  private nextEventId = 1;
  private storageFile: string | null = null;

  constructor(filePath?: string) {
    if (filePath) {
      this.storageFile = filePath;
      this.load();
    }
  }

  private load() {
    if (!this.storageFile) return;
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf-8'));
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
        this.nextUserId = (this.users.reduce((max: number, u: any) => Math.max(max, Number(u.id) || 0), 0) || 0) + 1;
        this.nextEventId = (this.realtime_events.reduce((max: number, e: any) => Math.max(max, Number(e.id) || 0), 0) || 0) + 1;
      }
    } catch (err) {
      console.warn('[ResilientStore] Could not load state from disk:', err);
    }
  }

  private save() {
    if (!this.storageFile) return;
    try {
      const data = {
        users: this.users,
        sessions: this.sessions,
        mobile_detections: this.mobile_detections,
        detection_state: Object.fromEntries(this.detection_state),
        app_settings: Object.fromEntries(this.app_settings),
        password_resets: this.password_resets,
        realtime_events: this.realtime_events,
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data), 'utf-8');
    } catch {}
  }

  get(sql: string, params: SqlValue[] = []): any {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    if (cleanSql.startsWith('SELECT 1')) {
      return { 1: 1 };
    }
    if (cleanSql.includes('FROM users WHERE email = ?')) {
      const email = String(params[0] || '').toLowerCase();
      const user = this.users.find(u => u.email.toLowerCase() === email);
      return user ? { ...user } : undefined;
    }
    if (cleanSql.includes('FROM users WHERE id = ?')) {
      const id = Number(params[0]);
      const user = this.users.find(u => Number(u.id) === id);
      return user ? { ...user } : undefined;
    }
    if (cleanSql.includes('FROM sessions') && cleanSql.includes('users') && cleanSql.includes('sessions.token = ?')) {
      const token = String(params[0]);
      const session = this.sessions.find(s => s.token === token);
      if (!session) return undefined;
      const user = this.users.find(u => u.id === session.user_id);
      return user ? { ...user } : undefined;
    }
    if (cleanSql.startsWith('SELECT value FROM app_settings WHERE key = ?')) {
      const key = String(params[0]);
      const item = this.app_settings.get(key);
      return item ? { value: item.value } : undefined;
    }
    if (cleanSql.includes('FROM password_resets') && cleanSql.includes('user_id = ?')) {
      const userId = Number(params[0]);
      const item = this.password_resets.find(r => r.user_id === userId);
      return item ? { ...item } : undefined;
    }
    if (cleanSql.includes('FROM password_resets') && cleanSql.includes('token_hash = ?')) {
      const tokenHash = String(params[0]);
      const item = this.password_resets.find(r => r.token_hash === tokenHash);
      return item ? { token_hash: item.token_hash } : undefined;
    }
    return undefined;
  }

  all(sql: string, params: SqlValue[] = []): any[] {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    if (cleanSql.includes('PRAGMA table_info(users)')) {
      return [
        { name: 'id' }, { name: 'name' }, { name: 'email' },
        { name: 'password_hash' }, { name: 'password_salt' },
        { name: 'role' }, { name: 'department' },
        { name: 'requested_department' }, { name: 'approved' },
        { name: 'created_at' }
      ];
    }
    if (cleanSql.includes('FROM detection_state')) {
      return Array.from(this.detection_state.values()).map(d => ({ payload: d.payload }));
    }
    if (cleanSql.includes('FROM mobile_detections')) {
      return this.mobile_detections.map(d => ({ payload: d.payload }));
    }
    if (cleanSql.includes("FROM users WHERE role = 'main' AND approved = 1") || cleanSql.includes("FROM users WHERE role = 'main' AND approved = TRUE")) {
      return this.users.filter(u => u.role === 'main' && Boolean(u.approved)).map(u => ({ email: u.email }));
    }
    if (cleanSql.includes("role = 'department'") && cleanSql.includes("approved = 1")) {
      const dept = params[0];
      return this.users
        .filter(u => u.role === 'department' && u.department === dept && Boolean(u.approved))
        .map(u => ({ email: u.email }));
    }
    if (cleanSql.includes("role = 'department'") && (cleanSql.includes("approved = 0") || cleanSql.includes("approved = FALSE"))) {
      return this.users
        .filter(u => u.role === 'department' && (u.approved === 0 || u.approved === false || !u.approved))
        .map(u => ({
          id: Number(u.id),
          name: u.name,
          email: u.email,
          requested_department: u.requested_department,
          requestedDepartment: u.requested_department,
          created_at: u.created_at,
          createdAt: u.created_at,
        }));
    }
    if (cleanSql.includes("FROM users WHERE approved = TRUE") || cleanSql.includes("FROM users WHERE approved = 1") || cleanSql.includes("(approved = TRUE OR approved = 1)")) {
      return this.users
        .filter(u => Boolean(u.approved))
        .map(u => ({
          id: Number(u.id),
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          created_at: u.created_at,
          createdAt: u.created_at,
        }));
    }
    if (cleanSql.includes('FROM realtime_events')) {
      if (cleanSql.includes("event_type = 'auth:login'")) {
        return this.realtime_events
          .filter(e => e.event_type === 'auth:login')
          .sort((a, b) => Number(b.id) - Number(a.id))
          .slice(0, 20)
          .map(e => ({
            id: Number(e.id),
            payload: typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload),
            created_at: e.created_at,
            createdAt: e.created_at,
          }));
      }
      const afterId = Number(params[0] || 0);
      let limit = 100;
      let deptFilter: string | null = null;
      if (params.length > 2) {
        deptFilter = String(params[1]);
        limit = Number(params[2] || 100);
      } else if (params.length === 2) {
        limit = Number(params[1] || 100);
      }
      return this.realtime_events
        .filter(e => Number(e.id) > afterId && (!deptFilter || e.target_department === deptFilter))
        .slice(0, limit);
    }
    return [];
  }

  run(sql: string, params: SqlValue[] = []): RunResult {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    let changes = 0;
    let lastInsertRowid: number | bigint | undefined = undefined;

    if (cleanSql.startsWith('INSERT INTO users')) {
      const email = String(params[1] || '').toLowerCase();
      const existingIndex = this.users.findIndex(u => u.email.toLowerCase() === email);
      const isMain = cleanSql.includes("'main'") || params[4] === 'main';
      const role = cleanSql.includes("'main'") ? 'main' : (cleanSql.includes("'department'") ? 'department' : String(params[4] || 'department'));

      let dept: string | null = null;
      let reqDept: string | null = null;
      let approved = 0;

      // Handle seeding queries: INSERT INTO users (..., approved, created_at) VALUES (?, ..., 1, ?)
      if (cleanSql.includes("1, ?") || cleanSql.includes("1,?") || isMain) {
        dept = params[5] ? String(params[5]) : null;
        reqDept = params[6] ? String(params[6]) : null;
        approved = 1;
      } else {
        // Signup query: INSERT INTO users (name, email, password_hash, password_salt, role, department, requested_department, approved, created_at)
        dept = null;
        reqDept = params[4] ? String(params[4]) : null;
        approved = 0;
      }

      const newUser = {
        id: existingIndex >= 0 ? this.users[existingIndex].id : this.nextUserId++,
        name: params[0],
        email,
        password_hash: params[2],
        password_salt: params[3],
        role,
        department: dept,
        requested_department: reqDept,
        approved,
        created_at: String(params[params.length - 1] || new Date().toISOString()),
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
      const user = this.users.find(u => Number(u.id) === Number(id));
      if (user) {
        user.password_hash = params[0];
        user.password_salt = params[1];
        if (cleanSql.includes("role = 'main'")) {
          user.role = 'main';
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
    } else if (cleanSql.includes('UPDATE users SET department = ?')) {
      const targetDept = String(params[0]);
      const id = Number(params[1]);
      const user = this.users.find(u => Number(u.id) === id);
      if (user) {
        user.department = targetDept;
        user.approved = 1;
        changes = 1;
        this.save();
      }
    } else if (cleanSql.startsWith('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')) {
      const id = Number(params[2]);
      const user = this.users.find(u => u.id === id);
      if (user) {
        user.password_hash = params[0];
        user.password_salt = params[1];
        changes = 1;
        this.save();
      }
    } else if (cleanSql.startsWith('INSERT INTO sessions')) {
      this.sessions.push({ token: params[0], user_id: params[1], created_at: params[2] });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith('DELETE FROM sessions WHERE token = ?')) {
      const before = this.sessions.length;
      this.sessions = this.sessions.filter(s => s.token !== params[0]);
      changes = before - this.sessions.length;
      this.save();
    } else if (cleanSql.startsWith('DELETE FROM sessions WHERE user_id = ?')) {
      const before = this.sessions.length;
      this.sessions = this.sessions.filter(s => s.user_id !== params[0]);
      changes = before - this.sessions.length;
      this.save();
    } else if (cleanSql.startsWith('INSERT INTO detection_state')) {
      const id = String(params[0]);
      this.detection_state.set(id, { id, payload: String(params[1]), updated_at: String(params[2]) });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith('INSERT INTO mobile_detections')) {
      this.mobile_detections.push({ id: params[0], user_id: params[1], payload: params[2], created_at: params[3] });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith('INSERT INTO app_settings')) {
      const key = String(params[0]);
      this.app_settings.set(key, { key, value: String(params[1]), updated_at: String(params[2]) });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith('INSERT INTO realtime_events')) {
      const event = {
        id: this.nextEventId++,
        event_type: params[0],
        payload: params[1],
        target_department: params[2] || null,
        created_at: params[3],
      };
      this.realtime_events.push(event);
      if (this.realtime_events.length > 500) {
        this.realtime_events = this.realtime_events.slice(-500);
      }
      changes = 1;
      lastInsertRowid = event.id;
      this.save();
    } else if (cleanSql.startsWith('INSERT INTO password_resets')) {
      this.password_resets.push({ token_hash: params[0], user_id: params[1], expires_at: params[2], created_at: params[3] });
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith('DELETE FROM password_resets WHERE user_id = ?')) {
      this.password_resets = this.password_resets.filter(r => r.user_id !== params[0]);
      changes = 1;
      this.save();
    } else if (cleanSql.startsWith('DELETE FROM password_resets WHERE token_hash = ?')) {
      this.password_resets = this.password_resets.filter(r => r.token_hash !== params[0]);
      changes = 1;
      this.save();
    }

    return { changes, lastInsertRowid };
  }
}

let sqlite: any = null;
let postgres: Pool | null = null;
let resilientStore: ResilientStore | null = null;
let initPromise: Promise<void> | null = null;

export function databaseProvider() {
  if (postgres) return 'postgresql';
  if (sqlite) return 'sqlite';
  return 'resilient-store';
}

export function isPostgres() {
  return postgres !== null;
}

function postgresPlaceholders(sql: string) {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let output = '';
  for (let cursor = 0; cursor < sql.length; cursor += 1) {
    const character = sql[cursor];
    if (character === "'" && !inDouble && sql[cursor - 1] !== '\\') inSingle = !inSingle;
    if (character === '"' && !inSingle && sql[cursor - 1] !== '\\') inDouble = !inDouble;
    if (character === '?' && !inSingle && !inDouble) {
      index += 1;
      output += `$${index}`;
    } else {
      output += character;
    }
  }
  return output;
}

async function applyPostgresMigrations(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const migrationDirectory = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationDirectory)) return;

  const migrations = fs.readdirSync(migrationDirectory)
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  for (const file of migrations) {
    const version = file.split('_')[0];
    const applied = await pool.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
    if (applied.rowCount) continue;

    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const sql = fs.readFileSync(path.join(migrationDirectory, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function initializeSqliteTables(db: any) {
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

  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  for (const [column, definition] of [
    ['role', "TEXT NOT NULL DEFAULT 'department'"],
    ['department', 'TEXT'],
    ['requested_department', 'TEXT'],
    ['approved', 'INTEGER NOT NULL DEFAULT 0'],
  ] as const) {
    if (!columns.some((item) => item.name === column)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
}

export function initializeDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (process.env.DATABASE_URL) {
        try {
          postgres = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: Number(process.env.PG_POOL_MAX || 3),
            idleTimeoutMillis: 10_000,
            connectionTimeoutMillis: 10_000,
            ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
          });
          await postgres.query('SELECT 1');
          await applyPostgresMigrations(postgres);
          console.log('[Database] Connected to PostgreSQL successfully.');
          return;
        } catch (pgError) {
          console.warn('[Database] PostgreSQL connection failed, falling back to embedded store:', pgError);
          postgres = null;
        }
      }

      // Try better-sqlite3 first
      try {
        let DatabaseConstructor: any = null;
        try {
          const req = getRequire();
          if (req) {
            DatabaseConstructor = req('better-sqlite3');
          }
        } catch (requireErr) {
          console.warn('[Database] better-sqlite3 module not available in this environment.');
        }

        if (DatabaseConstructor) {
          if (isVercel) {
            const seedDb = path.join(process.cwd(), 'urbannex.db');
            if (fs.existsSync(seedDb) && !fs.existsSync(sqliteFile)) {
              try {
                fs.copyFileSync(seedDb, sqliteFile);
              } catch (copyErr) {
                console.warn('[Database] Could not copy seed urbannex.db to /tmp:', copyErr);
              }
            }
          }

          const db = new DatabaseConstructor(sqliteFile);
          try { db.pragma('journal_mode = WAL'); } catch {}
          initializeSqliteTables(db);
          sqlite = db;
          console.log(`[Database] SQLite connected at ${sqliteFile}`);
          return;
        }
      } catch (sqliteErr) {
        console.warn('[Database] SQLite initialization failed, activating resilient store:', sqliteErr);
        sqlite = null;
      }

      // Activate resilient store fallback
      resilientStore = new ResilientStore(jsonFallbackFile);
      console.log(`[Database] Resilient memory/JSON store activated at ${jsonFallbackFile}`);
    })();
  }
  return initPromise;
}

export async function dbGet<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
  await initializeDatabase();
  if (postgres) {
    const result = await postgres.query(postgresPlaceholders(sql), params);
    return result.rows[0] as T | undefined;
  }
  if (sqlite) {
    return sqlite.prepare(sql).get(...params) as T | undefined;
  }
  return resilientStore!.get(sql, params) as T | undefined;
}

export async function dbAll<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  await initializeDatabase();
  if (postgres) {
    const result = await postgres.query(postgresPlaceholders(sql), params);
    return result.rows as T[];
  }
  if (sqlite) {
    return sqlite.prepare(sql).all(...params) as T[];
  }
  return resilientStore!.all(sql, params) as T[];
}

export async function dbRun(sql: string, params: SqlValue[] = []): Promise<RunResult> {
  await initializeDatabase();
  if (postgres) {
    const result: QueryResult = await postgres.query(postgresPlaceholders(sql), params);
    return { changes: result.rowCount || 0, lastInsertRowid: undefined };
  }
  if (sqlite) {
    const result = sqlite.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }
  return resilientStore!.run(sql, params);
}

export async function dbTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  await initializeDatabase();
  if (!postgres) {
    // In SQLite or resilient store, execute directly
    return operation(null as any);
  }
  const client = await postgres.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (postgres) await postgres.end();
  sqlite?.close?.();
}