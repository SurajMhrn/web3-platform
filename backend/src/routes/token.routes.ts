import { Router } from 'express';
import {
  getUserTokens,
  recordToken,
  recordTokenTransfer,
  getAdminTokens,
} from '../controllers/token.controller';
import { authenticateJWT, authorize } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { recordTokenSchema, recordTokenTransferSchema } from '../validation/schemas';

const router = Router();

/**
 * @openapi
 * /tokens:
 *   get:
 *     summary: List the authenticated user's tokens
 *     tags: [Tokens]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Tokens created by this user }
 */
router.get('/', authenticateJWT, getUserTokens);

/**
 * @openapi
 * /tokens/record:
 *   post:
 *     summary: Record a token that was just deployed on-chain
 *     tags: [Tokens]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, symbol, initialSupply, contractAddress, txHash, chainId]
 *             properties:
 *               name: { type: string }
 *               symbol: { type: string, maxLength: 10 }
 *               initialSupply: { type: number }
 *               contractAddress: { type: string, description: "0x-prefixed EVM address" }
 *               txHash: { type: string, description: "0x-prefixed 32-byte transaction hash" }
 *               chainId: { type: string }
 *     responses:
 *       201: { description: Token, transaction, and notification recorded atomically }
 *       400: { description: Invalid body }
 */
router.post('/record', authenticateJWT, validateBody(recordTokenSchema), recordToken);

/**
 * @openapi
 * /tokens/transfer-record:
 *   post:
 *     summary: Record a token transfer that was just executed on-chain
 *     tags: [Tokens]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractAddress, toAddress, amount, txHash, chainId]
 *             properties:
 *               tokenName: { type: string }
 *               tokenSymbol: { type: string }
 *               contractAddress: { type: string }
 *               toAddress: { type: string }
 *               amount: { type: number }
 *               txHash: { type: string }
 *               chainId: { type: string }
 *     responses:
 *       200: { description: Transaction + notification recorded atomically }
 *       400: { description: Invalid body }
 */
router.post('/transfer-record', authenticateJWT, validateBody(recordTokenTransferSchema), recordTokenTransfer);

/**
 * @openapi
 * /tokens/admin:
 *   get:
 *     summary: List all tokens platform-wide (admin only)
 *     tags: [Tokens]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Paginated token list }
 *       403: { description: Not an admin }
 */
router.get('/admin', authenticateJWT, authorize('admin'), getAdminTokens);

export default router;
