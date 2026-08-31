import pool from '../src/config/db';
import { initDb } from '../src/config/initDb';

/**
 * Drops and recreates all tables (re-seeding the default admin), so each
 * test starts from a clean, known state. Safe to call in `beforeEach` since
 * it runs against the in-memory DB configured by `tests/env.setup.ts` —
 * never the real `web3_db.sqlite`.
 */
export const resetDatabase = async (): Promise<void> => {
  await pool.query('DROP TABLE IF EXISTS notifications');
  await pool.query('DROP TABLE IF EXISTS transactions');
  await pool.query('DROP TABLE IF EXISTS tokens');
  await pool.query('DROP TABLE IF EXISTS users');
  await initDb();
};
