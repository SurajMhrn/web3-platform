import pool from '../config/db';
import crypto from 'crypto';

export type UserRole = 'user' | 'admin' | 'moderator';

export interface User {
  id: string;
  email: string;
  password?: string;
  username?: string;
  bio?: string;
  profile_picture?: string;
  wallet_address?: string;
  nonce?: string;
  role: UserRole;
  refresh_token?: string;
  created_at: Date;
  updated_at: Date;
}

// ─── Basic Lookups ────────────────────────────────────────────────────────────

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  return result.rows[0] || null;
};

export const getUserById = async (id: string): Promise<User | null> => {
  const result = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return result.rows[0] || null;
};

export const getUserByWalletAddress = async (walletAddress: string): Promise<User | null> => {
  const result = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [walletAddress.toLowerCase()]);
  return result.rows[0] || null;
};

export const getUserByRefreshToken = async (token: string): Promise<User | null> => {
  const result = await pool.query('SELECT * FROM users WHERE refresh_token = ?', [token]);
  return result.rows[0] || null;
};

// ─── Create & Update ──────────────────────────────────────────────────────────

export const createUserByEmail = async (email: string, passwordHash: string): Promise<User> => {
  const id = crypto.randomUUID();
  const result = await pool.query(
    'INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?) RETURNING *',
    [id, email.toLowerCase(), passwordHash, 'user']
  );
  return result.rows[0];
};

export const updateUserProfile = async (id: string, username: string, bio: string, profilePicture: string): Promise<User> => {
  const result = await pool.query(
    'UPDATE users SET username = ?, bio = ?, profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
    [username, bio, profilePicture, id]
  );
  return result.rows[0];
};

export const linkWalletAddress = async (id: string, walletAddress: string): Promise<User> => {
  const result = await pool.query(
    'UPDATE users SET wallet_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
    [walletAddress.toLowerCase(), id]
  );
  return result.rows[0];
};

export const unlinkWalletAddress = async (id: string): Promise<User> => {
  const result = await pool.query(
    'UPDATE users SET wallet_address = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
    [id]
  );
  return result.rows[0];
};

export const updateUserNonce = async (id: string, newNonce: string): Promise<User> => {
  const result = await pool.query(
    'UPDATE users SET nonce = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
    [newNonce, id]
  );
  return result.rows[0];
};

export const updateRefreshToken = async (id: string, token: string | null): Promise<void> => {
  await pool.query(
    'UPDATE users SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [token, id]
  );
};

// ─── Admin Operations ─────────────────────────────────────────────────────────

export const getAllUsers = async (limit = 50, offset = 0): Promise<User[]> => {
  const result = await pool.query(
    'SELECT id, email, username, bio, profile_picture, wallet_address, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return result.rows;
};

export const getTotalUserCount = async (): Promise<number> => {
  const result = await pool.query('SELECT COUNT(*) as count FROM users');
  return result.rows[0]?.count ?? 0;
};

export interface UserRoleCounts {
  admins: number;
  moderators: number;
  users: number;
  walletLinked: number;
}

/**
 * Role and wallet-link totals, counted by the database rather than by fetching
 * rows and counting them in the API process — which silently under-reported
 * once the table grew past the page size being fetched.
 */
export const getUserRoleCounts = async (): Promise<UserRoleCounts> => {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'admin')        AS admins,
       COUNT(*) FILTER (WHERE role = 'moderator')    AS moderators,
       COUNT(*) FILTER (WHERE role = 'user')         AS users,
       COUNT(*) FILTER (WHERE wallet_address IS NOT NULL) AS wallet_linked
     FROM users`
  );
  const row = result.rows[0] ?? {};
  return {
    admins: Number(row.admins ?? 0),
    moderators: Number(row.moderators ?? 0),
    users: Number(row.users ?? 0),
    walletLinked: Number(row.wallet_linked ?? 0),
  };
};

export const updateUserRole = async (id: string, role: UserRole): Promise<User> => {
  const result = await pool.query(
    'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
    [role, id]
  );
  return result.rows[0];
};

export const deleteUserById = async (id: string): Promise<void> => {
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
};
