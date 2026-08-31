import { Router } from 'express';
import {
  getUserTransactions,
  getAdminTransactions,
} from '../controllers/transaction.controller';
import { authenticateJWT, authorize } from '../middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /transactions:
 *   get:
 *     summary: List the authenticated user's transaction history
 *     tags: [Transactions]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Paginated transaction list scoped to this user }
 */
router.get('/', authenticateJWT, getUserTransactions);

/**
 * @openapi
 * /transactions/admin:
 *   get:
 *     summary: List all transactions platform-wide (admin only)
 *     tags: [Transactions]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Paginated transaction list, all users }
 *       403: { description: Not an admin }
 */
router.get('/admin', authenticateJWT, authorize('admin'), getAdminTransactions);

export default router;
