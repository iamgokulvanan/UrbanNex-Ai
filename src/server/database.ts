import Database from 'better-sqlite3';
import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

type SqlValue = string | number | boolean | null | Date | Buffer | object;
type RunResult = { changes: number; lastInsertRowid: number | bigint | undefined };

let sqlite: Database.Database | null = null;
let postgres: Pool | null = null;
let initPromise: Promise<void> | null = null;

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

export function databaseProvider() {
  return postgres ? 'postgresql' : 'sqlite';
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

function initializeSqlite() {
  const databasePath = process.env.SQLITE_PATH || path.join(process.cwd(), 'urbannex.db');
  sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(`
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

  const columns = sqlite.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  for (const [column, definition] of [
    ['role', "TEXT NOT NULL DEFAULT 'department'"],
    ['department', 'TEXT'],
    ['requested_department', 'TEXT'],
    ['approved', 'INTEGER NOT NULL DEFAULT 0'],
  ] as const) {
    if (!columns.some((item) => item.name === column)) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
}

export function initializeDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      if (process.env.DATABASE_URL) {
        postgres = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: Number(process.env.PG_POOL_MAX || 3),
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 10_000,
          ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
        });
        await postgres.query('SELECT 1');
        await applyPostgresMigrations(postgres);
        return;
      }
      if (isProductionRuntime()) {
        throw new Error('DATABASE_URL is required in production; SQLite is development-only.');
      }
      initializeSqlite();
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
  return sqlite!.prepare(sql).get(...params) as T | undefined;
}

export async function dbAll<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  await initializeDatabase();
  if (postgres) {
    const result = await postgres.query(postgresPlaceholders(sql), params);
    return result.rows as T[];
  }
  return sqlite!.prepare(sql).all(...params) as T[];
}

export async function dbRun(sql: string, params: SqlValue[] = []): Promise<RunResult> {
  await initializeDatabase();
  if (postgres) {
    const result: QueryResult = await postgres.query(postgresPlaceholders(sql), params);
    return { changes: result.rowCount || 0, lastInsertRowid: undefined };
  }
  const result = sqlite!.prepare(sql).run(...params);
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
}

export async function dbTransaction<T>(operation: (client: PoolClient) => Promise<T>) {
  await initializeDatabase();
  if (!postgres) throw new Error('Transactions through this helper are only for PostgreSQL operations.');
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

export async function closeDatabase() {
  if (postgres) await postgres.end();
  sqlite?.close();
}