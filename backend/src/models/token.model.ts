import pool from '../config/db';
import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Token {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  initial_supply: number;
  contract_address: string;
  tx_hash: string;
  chain_id: string;
  created_at: Date;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const getTokensByUserId = async (userId: string): Promise<Token[]> => {
  const result = await pool.query(
    'SELECT * FROM tokens WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
};

export const getTokenById = async (id: string): Promise<Token | null> => {
  const result = await pool.query('SELECT * FROM tokens WHERE id = ?', [id]);
  return result.rows[0] || null;
};

export const getTokenByContractAddress = async (address: string): Promise<Token | null> => {
  const result = await pool.query(
    'SELECT * FROM tokens WHERE contract_address = ? COLLATE NOCASE',
    [address.toLowerCase()]
  );
  return result.rows[0] || null;
};

export const getAllTokens = async (limit = 50, offset = 0): Promise<Token[]> => {
  const result = await pool.query(
    'SELECT * FROM tokens ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return result.rows;
};

export const getTotalTokenCount = async (): Promise<number> => {
  const result = await pool.query('SELECT COUNT(*) as count FROM tokens');
  return result.rows[0]?.count ?? 0;
};

export interface TopTokenCreator {
  user_id: string;
  email: string;
  username: string | null;
  token_count: number;
}

export const getTopTokenCreators = async (limit = 5): Promise<TopTokenCreator[]> => {
  const result = await pool.query(
    `SELECT tokens.user_id AS user_id, users.email AS email, users.username AS username, COUNT(*) AS token_count
     FROM tokens
     JOIN users ON users.id = tokens.user_id
     GROUP BY tokens.user_id
     ORDER BY token_count DESC
     LIMIT ?`,
    [limit]
  );
  return result.rows;
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createToken = async (
  userId: string,
  name: string,
  symbol: string,
  initialSupply: number,
  contractAddress: string,
  txHash: string,
  chainId: string
): Promise<Token> => {
  const id = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO tokens (id, user_id, name, symbol, initial_supply, contract_address, tx_hash, chain_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [id, userId, name, symbol, initialSupply, contractAddress.toLowerCase(), txHash, chainId]
  );
  return result.rows[0];
};
