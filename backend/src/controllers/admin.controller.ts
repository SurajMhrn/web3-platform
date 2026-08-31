import { Response } from 'express';
import {
  getAllUsers,
  getTotalUserCount,
  updateUserRole,
  deleteUserById,
  getUserById,
} from '../models/user.model';
import type { UserRole } from '../models/user.model';
import { getTopTokenCreators } from '../models/token.model';
import { getCountsByDay } from '../utils/analytics';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sanitizeUser } from '../utils/sanitizeUser';
import { parsePagination } from '../utils/pagination';
import type { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/admin/stats
 * Returns platform-level statistics (admin only).
 */
export const getAdminStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const totalUsers = await getTotalUserCount();
  const allUsers = await getAllUsers(1000, 0);
  const totalAdmins = allUsers.filter(u => u.role === 'admin').length;
  const totalModerators = allUsers.filter(u => u.role === 'moderator').length;
  const walletLinked = allUsers.filter(u => !!u.wallet_address).length;

  res.json({
    stats: {
      totalUsers,
      totalAdmins,
      totalModerators,
      walletLinked,
      regularUsers: totalUsers - totalAdmins - totalModerators,
    }
  });
});

/**
 * GET /api/admin/analytics?days=14
 * Returns basic day-by-day activity series plus the top token creators
 * (admin only). `days` is clamped to [1, 90], defaulting to 14.
 */
export const getAdminAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rawDays = parseInt(req.query.days as string, 10);
  const days = Math.min(Math.max(Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 14, 1), 90);

  const [signups, tokensCreated, transactions, topCreators] = await Promise.all([
    getCountsByDay('users', days),
    getCountsByDay('tokens', days),
    getCountsByDay('transactions', days),
    getTopTokenCreators(5),
  ]);

  res.json({ days, signups, tokensCreated, transactions, topCreators });
});

/**
 * GET /api/admin/users?limit=20&offset=0
 * Returns a paginated list of all users (admin only).
 */
export const getAdminUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit, offset } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

  const users = await getAllUsers(limit, offset);
  const total = await getTotalUserCount();

  res.json({ users, total, limit, offset });
});

/**
 * PATCH /api/admin/users/:id/role
 * Updates a user's role (admin only). Body validated by `validateBody(patchUserRoleSchema)`.
 */
export const patchUserRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body as { role: UserRole };

  // Prevent self-demotion
  const requestingUserId = req.user!.id;
  if (requestingUserId === id && role !== 'admin') {
    throw new AppError(400, 'Admins cannot demote themselves.');
  }

  const target = await getUserById(id);
  if (!target) throw new AppError(404, 'User not found');

  const updated = await updateUserRole(id, role);
  console.warn(`[Security] Role change: admin=${requestingUserId} target=${id} ${target.role} -> ${role}`);
  res.json({ user: sanitizeUser(updated) });
});

/**
 * DELETE /api/admin/users/:id
 * Deletes a user account (admin only).
 */
export const removeUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const requestingUserId = req.user!.id;

  if (requestingUserId === id) {
    throw new AppError(400, 'Admins cannot delete their own account.');
  }

  const target = await getUserById(id);
  if (!target) throw new AppError(404, 'User not found');

  await deleteUserById(id);
  console.warn(`[Security] User deleted: admin=${requestingUserId} target=${id} (${target.email})`);
  res.json({ message: 'User deleted successfully' });
});
