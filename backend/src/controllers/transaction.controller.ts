import { Response } from 'express';
import {
  getTransactionsByUserId,
  getTransactionCountByUserId,
  getAllTransactions,
  getTotalTransactionCount,
} from '../models/transaction.model';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import type { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/transactions?limit=20&offset=0
 * Returns the current user's transaction history (scoped to req.user.id —
 * a user can never see another user's transactions through this route).
 */
export const getUserTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { limit, offset } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

  const [transactions, total] = await Promise.all([
    getTransactionsByUserId(userId, limit, offset),
    getTransactionCountByUserId(userId),
  ]);

  res.json({ transactions, total, limit, offset });
});

/**
 * GET /api/transactions/admin?limit=50&offset=0
 * Returns all platform transactions (admin only).
 */
export const getAdminTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

  const [transactions, total] = await Promise.all([
    getAllTransactions(limit, offset),
    getTotalTransactionCount(),
  ]);

  res.json({ transactions, total, limit, offset });
});
