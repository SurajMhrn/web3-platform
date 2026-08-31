import { Router } from 'express';
import {
  register,
  login,
  setupProfile,
  getNonce,
  linkWallet,
  unlinkWallet,
  getProfile,
  refreshToken,
  logout,
} from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { registerSchema, loginSchema, setupProfileSchema, linkWalletSchema } from '../validation/schemas';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Create a new account with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201:
 *         description: Account created. Sets `accessToken` + `refreshToken` httpOnly cookies.
 *       400:
 *         description: Invalid input or email already in use
 */
router.post('/register', authLimiter, validateBody(registerSchema), register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Logged in. Sets `accessToken` + `refreshToken` httpOnly cookies.
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, validateBody(loginSchema), login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate the access + refresh tokens using the refreshToken cookie
 *     tags: [Auth]
 *     responses:
 *       200: { description: Tokens rotated and re-issued as cookies }
 *       401: { description: Refresh token missing }
 *       403: { description: Refresh token invalid, expired, or revoked }
 */
router.post('/refresh', refreshLimiter, refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current refresh token and clear auth cookies
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', logout);

/**
 * @openapi
 * /auth/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/profile', authenticateJWT, getProfile);

/**
 * @openapi
 * /auth/setup-profile:
 *   post:
 *     summary: Set the authenticated user's username/bio/profile picture
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username: { type: string, minLength: 2, maxLength: 50 }
 *               bio: { type: string, maxLength: 300 }
 *               profilePicture: { type: string, format: uri }
 *     responses:
 *       200: { description: Updated user }
 */
router.post('/setup-profile', authenticateJWT, validateBody(setupProfileSchema), setupProfile);

/**
 * @openapi
 * /auth/nonce:
 *   post:
 *     summary: Issue a fresh nonce for wallet-signature linking
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: One-time nonce to embed in the message the wallet signs }
 */
router.post('/nonce', authenticateJWT, getNonce);

/**
 * @openapi
 * /auth/link-wallet:
 *   post:
 *     summary: Link a wallet address after verifying a signed nonce message
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, signature]
 *             properties:
 *               walletAddress: { type: string, description: "0x-prefixed EVM address" }
 *               signature: { type: string, description: "Signature over the nonce message from /auth/nonce" }
 *     responses:
 *       200: { description: Wallet linked }
 *       400: { description: Nonce missing/expired, or wallet already linked to another account }
 *       401: { description: Signature does not match walletAddress }
 */
router.post('/link-wallet', authenticateJWT, validateBody(linkWalletSchema), linkWallet);

/**
 * @openapi
 * /auth/unlink-wallet:
 *   post:
 *     summary: Remove the wallet linked to the authenticated account
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Wallet unlinked }
 *       400: { description: No wallet is currently linked }
 */
router.post('/unlink-wallet', authenticateJWT, unlinkWallet);

export default router;
