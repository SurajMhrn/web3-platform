import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

/**
 * This project runs on SQLite for local development (see backend/README.md
 * for why — docker-compose.yml provisions Postgres for future/optional use,
 * but nothing here currently connects to it). This module exposes a
 * `pool.query(text, params)` shim with the same shape as `pg`'s Pool so the
 * model layer reads like plain parameterized SQL either way.
 */

let dbPromise: ReturnType<typeof open> | null = null;

// Tests set SQLITE_FILE=":memory:" (see tests/env.setup.ts) so they never
// touch the real dev database file.
const DB_FILE = process.env.SQLITE_FILE || path.join(__dirname, '../../web3_db.sqlite');

const getDb = () => {
  if (!dbPromise) {
    dbPromise = open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });
  }
  return dbPromise;
};

const pool = {
  query: async (text: string, params: any[] = []) => {
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
  }
};

/**
 * Runs `fn` inside a SQLite transaction. All `pool.query` calls made from
 * within `fn` (directly or via model functions) share the same underlying
 * connection, so they participate in the same transaction. Rolls back and
 * rethrows on any failure, so a partial multi-table write (e.g. token +
 * transaction + notification) can never be left half-committed.
 */
export const withTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
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
