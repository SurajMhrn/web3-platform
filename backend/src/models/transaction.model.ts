import pool from '../config/db';
import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionType =
  | 'token_creation'
  | 'token_transfer'
  | 'token_mint'
  | 'token_burn'
  | 'wallet_link'
  | 'chain_registration';

export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  status: TransactionStatus;
  tx_hash: string;
  chain_id: string;
  description: string;
  metadata?: string; // JSON string with extra info (e.g., token name, recipient)
  created_at: Date;
  updated_at: Date;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const getTransactionsByUserId = async (
  userId: string,
  limit = 50,
  offset = 0
): Promise<Transaction[]> => {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  return result.rows;
};

export const getTransactionById = async (id: string): Promise<Transaction | null> => {
  const result = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
  return result.rows[0] || null;
};

export const getAllTransactions = async (limit = 100, offset = 0): Promise<Transaction[]> => {
  const result = await pool.query(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return result.rows;
};

export const getTransactionCountByUserId = async (userId: string): Promise<number> => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
    [userId]
  );
  return result.rows[0]?.count ?? 0;
};

export const getTotalTransactionCount = async (): Promise<number> => {
  const result = await pool.query('SELECT COUNT(*) as count FROM transactions');
  return result.rows[0]?.count ?? 0;
};

// ─── Create & Update ──────────────────────────────────────────────────────────

export const createTransaction = async (
  userId: string,
  type: TransactionType,
  txHash: string,
  chainId: string,
  description: string,
  metadata?: Record<string, unknown>,
  status: TransactionStatus = 'success'
): Promise<Transaction> => {
  const id = crypto.randomUUID();
  const metaString = metadata ? JSON.stringify(metadata) : null;
  const result = await pool.query(
    `INSERT INTO transactions (id, user_id, type, status, tx_hash, chain_id, description, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [id, userId, type, status, txHash, chainId, description, metaString]
  );
  return result.rows[0];
};

export const updateTransactionStatus = async (
  id: string,
  status: TransactionStatus
): Promise<Transaction> => {
  const result = await pool.query(
    'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
    [status, id]
  );
  return result.rows[0];
};
