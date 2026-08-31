import { Router } from 'express';
import { authenticateJWT, authorize } from '../middleware/auth.middleware';
import { adminMutationLimiter } from '../middleware/rateLimit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { patchUserRoleSchema } from '../validation/schemas';
import {
  getAdminStats,
  getAdminAnalytics,
  getAdminUsers,
  patchUserRole,
  removeUser,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateJWT, authorize('admin'));

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Platform-level statistics
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Aggregate user/role/wallet counts }
 *       403: { description: Not an admin }
 */
router.get('/stats', getAdminStats);

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     summary: Basic day-by-day activity (signups, tokens, transactions) and top token creators
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 14, minimum: 1, maximum: 90 }
 *     responses:
 *       200: { description: Day-series counts plus the top 5 token creators }
 *       403: { description: Not an admin }
 */
router.get('/analytics', getAdminAnalytics);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List all users (paginated)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Paginated user list }
 */
router.get('/users', getAdminUsers);

/**
 * @openapi
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Change a user's role
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [user, admin, moderator] }
 *     responses:
 *       200: { description: Updated user }
 *       400: { description: Invalid role, or an admin attempting to self-demote }
 *       404: { description: User not found }
 */
router.patch('/users/:id/role', adminMutationLimiter, validateBody(patchUserRoleSchema), patchUserRole);

/**
 * @openapi
 * /admin/users/{id}:
 *   delete:
 *     summary: Delete a user account
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User deleted }
 *       400: { description: An admin attempting to delete their own account }
 *       404: { description: User not found }
 */
router.delete('/users/:id', adminMutationLimiter, removeUser);

export default router;
