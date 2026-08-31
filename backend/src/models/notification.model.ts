import pool from '../config/db';
import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'token_created'
  | 'token_transferred'
  | 'token_minted'
  | 'token_burned'
  | 'wallet_linked'
  | 'chain_registered'
  | 'info'
  | 'warning';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: number; // SQLite stores booleans as 0/1
  link?: string;   // Optional navigation link
  created_at: Date;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const getNotificationsByUserId = async (
  userId: string,
  limit = 30,
  offset = 0
): Promise<Notification[]> => {
  const result = await pool.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  return result.rows;
};

export const getUnreadCountByUserId = async (userId: string): Promise<number> => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return result.rows[0]?.count ?? 0;
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<Notification> => {
  const id = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO notifications (id, user_id, type, title, message, is_read, link)
     VALUES (?, ?, ?, ?, ?, 0, ?) RETURNING *`,
    [id, userId, type, title, message, link ?? null]
  );
  return result.rows[0];
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const markNotificationRead = async (id: string, userId: string): Promise<void> => {
  await pool.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [id, userId]
  );
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  await pool.query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [userId]
  );
};

export const deleteNotification = async (id: string, userId: string): Promise<void> => {
  await pool.query(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [id, userId]
  );
};
