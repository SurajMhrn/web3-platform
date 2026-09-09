import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { Pool, PoolClient, types as pgTypes } from 'pg';

/**
 * One `pool.query(text, params)` interface over two engines.
 *
 * Postgres is used whenever DATABASE_URL is set, so a deployment and a local
 * machine can share one hosted database. Everything else falls back to a
 * SQLite file. Tests always use SQLite regardless: they must stay hermetic and
 * offline, and pointing them at the shared database would let a test run
 * delete real rows.
 *
 * The model layer is written against neither dialect in particular — it mixes
 * `?` and `$1` placeholders — so the Postgres path normalizes `?` to `$n`
 * before sending. Adding a query is therefore the same work either way; only
 * genuinely dialect-specific SQL (see `isPostgres` consumers) needs a branch.
 */

const isTest = process.env.NODE_ENV === 'test';
const databaseUrl = process.env.DATABASE_URL;

export const isPostgres = !!databaseUrl && !isTest;

// ── Postgres value parsing ──────────────────────────────────────────────────
// Two defaults would otherwise diverge from the SQLite path and silently
// change API responses: COUNT(*) arrives as a string (int8), and timestamps
// arrive as Date objects that JSON-encode to a different shape than SQLite's
// "YYYY-MM-DD HH:MM:SS" strings.
pgTypes.setTypeParser(20, (value: string) => parseInt(value, 10)); // int8
pgTypes.setTypeParser(1114, (value: string) => value); // timestamp
pgTypes.setTypeParser(1184, (value: string) => value); // timestamptz

let pgPool: Pool | null = null;
const getPgPool = () => {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: databaseUrl,
      // Hosted Postgres providers terminate TLS with their own CA; the
      // connection is still encrypted.
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pgPool;
};

/** Holds the client belonging to the innermost active transaction, if any. */
const transactionStore = new AsyncLocalStorage<PoolClient>();

/** `?, ?` → `$1, $2`. Leaves queries that already use `$n` untouched. */
const toPositionalParams = (text: string): string => {
  if (!text.includes('?')) return text;
  let index = 0;
  return text.replace(/\?/g, () => `$${++index}`);
};

// ── SQLite ──────────────────────────────────────────────────────────────────
let dbPromise: ReturnType<typeof open> | null = null;

// Tests set SQLITE_FILE=":memory:" (see tests/env.setup.ts) so they never
// touch the real dev database file.
const DB_FILE = process.env.SQLITE_FILE || path.join(__dirname, '../../web3_db.sqlite');

const getDb = () => {
  if (!dbPromise) {
    dbPromise = open({ filename: DB_FILE, driver: sqlite3.Database });
  }
  return dbPromise;
};

const querySqlite = async (text: string, params: any[]) => {
  const db = await getDb();

  // Convert PostgreSQL $1, $2, etc., to SQLite ?, ?
  let sqliteText = text.replace(/\$\d+/g, '?');

  // Mock PostgreSQL's SELECT NOW()
  if (sqliteText.trim() === 'SELECT NOW()') {
    sqliteText = "SELECT datetime('now') as now";
  }

  const isSelectOrReturning =
    sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.includes('RETURNING');

  if (isSelectOrReturning) {
    const rows = await db.all(sqliteText, params);
    return { rows };
  }

  await db.run(sqliteText, params);
  return { rows: [] };
};

const queryPostgres = async (text: string, params: any[]) => {
  const sql = toPositionalParams(text);
  const client = transactionStore.getStore();
  const result = client ? await client.query(sql, params) : await getPgPool().query(sql, params);
  return { rows: result.rows };
};

const pool = {
  query: async (text: string, params: any[] = []) =>
    isPostgres ? queryPostgres(text, params) : querySqlite(text, params),
};

/**
 * Runs `fn` inside a transaction. Every `pool.query` call made from within
 * `fn` — directly or via a model function — participates in it, so a partial
 * multi-table write (e.g. token + transaction + notification) can never be
 * left half-committed. Rolls back and rethrows on any failure.
 *
 * On Postgres the active client is carried in async local storage rather than
 * threaded through every call site, which is what keeps the model layer
 * identical between the two engines.
 */
export const withTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (isPostgres) {
    const client = await getPgPool().connect();
    try {
      await client.query('BEGIN');
      const result = await transactionStore.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const db: Database = await getDb();
  await db.exec('BEGIN');
  try {
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
};

export default pool;
