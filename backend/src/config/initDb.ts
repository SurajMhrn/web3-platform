import pool from './db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { env } from './env';

export const initDb = async () => {
  try {
    // ── Users table ──────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        username TEXT,
        bio TEXT,
        profile_picture TEXT,
        wallet_address TEXT UNIQUE,
        nonce TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        refresh_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add role column if it doesn't exist (for existing DBs)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`);
    } catch (_) {
      // Column already exists – safe to ignore
    }

    // Add refresh_token column if it doesn't exist
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN refresh_token TEXT;`);
    } catch (_) {
      // Column already exists – safe to ignore
    }

    console.log('[Database]: Users table initialized.');

    // ── Tokens table ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        initial_supply REAL NOT NULL,
        contract_address TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        chain_id TEXT NOT NULL DEFAULT '31337',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('[Database]: Tokens table initialized.');

    // ── Transactions table ────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        tx_hash TEXT NOT NULL,
        chain_id TEXT NOT NULL DEFAULT '31337',
        description TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('[Database]: Transactions table initialized.');

    // ── Notifications table ───────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('[Database]: Notifications table initialized.');

    // ── Seed default admin user ───────────────────────────────────────────────
    const existing = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (!existing.rows || existing.rows.length === 0) {
      const id = crypto.randomUUID();
      const usedGeneratedPassword = !env.adminPassword;
      const adminPassword = env.adminPassword || crypto.randomBytes(12).toString('base64url');
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        `INSERT OR IGNORE INTO users (id, email, password, username, role) VALUES (?, ?, ?, ?, ?)`,
        [id, env.adminEmail, hashedPassword, 'Admin', 'admin']
      );

      if (usedGeneratedPassword) {
        console.warn(
          '[Database]: ADMIN_PASSWORD was not set — generated a one-time admin password.\n' +
            `[Database]: Default admin seeded → ${env.adminEmail} / ${adminPassword}\n` +
            '[Database]: Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env to control this on future resets.'
        );
      } else {
        console.log(`[Database]: Default admin user seeded → ${env.adminEmail}`);
      }
    }
  } catch (error) {
    console.error('[Database Error]: Failed to initialize tables', error);
  }
};
