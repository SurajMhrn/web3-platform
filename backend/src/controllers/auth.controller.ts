import { Response } from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sanitizeUser } from '../utils/sanitizeUser';
import type { AuthRequest, JwtPayload } from '../middleware/auth.middleware';
import {
  getUserByEmail,
  createUserByEmail,
  updateUserProfile,
  getUserById,
  linkWalletAddress,
  unlinkWalletAddress,
  updateUserNonce,
  getUserByWalletAddress,
  getUserByRefreshToken,
  updateRefreshToken,
} from '../models/user.model';

const ACCESS_TOKEN_EXPIRY = '15m';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });

const signRefreshToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.refreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });

/** Shared flags for both auth cookies — kept identical between set and clear so browsers actually drop them on logout. */
const authCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict' as const,
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, { ...authCookieOptions, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refreshToken', refreshToken, { ...authCookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', authCookieOptions);
  res.clearCookie('refreshToken', authCookieOptions);
};

const issueSession = async (user: { id: string; email: string; role: JwtPayload['role'] }, res: Response) => {
  const payload: JwtPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await updateRefreshToken(user.id, refreshToken);
  setAuthCookies(res, accessToken, refreshToken);
};

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Creates a new email/password account and immediately logs it in (issues
 * an access + refresh cookie pair, see `issueSession`).
 * Errors: 400 if the email is already registered (body pre-validated by
 * `validateBody(registerSchema)` before this runs).
 */
export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const existingUser = await getUserByEmail(email);
  if (existingUser) throw new AppError(400, 'Email already in use');

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await createUserByEmail(email, hashedPassword);

  await issueSession(user, res);
  res.status(201).json({ user: sanitizeUser(user) });
});

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Verifies email/password and issues a new session (access + refresh cookies).
 * Errors: 401 for an unknown email, missing password hash (e.g. a
 * wallet-only account), or a wrong password — all collapsed into the same
 * generic "Invalid credentials" message so the response can't be used to
 * enumerate which emails are registered.
 */
export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user = await getUserByEmail(email);
  if (!user || !user.password) {
    console.warn(`[Security] Failed login: email=${email} ip=${req.ip} reason=no-account-or-password`);
    throw new AppError(401, 'Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.warn(`[Security] Failed login: email=${email} ip=${req.ip} reason=wrong-password`);
    throw new AppError(401, 'Invalid credentials');
  }

  await issueSession(user, res);
  res.json({ user: sanitizeUser(user) });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Rotates both tokens using the `refreshToken` cookie: verifies its
 * signature, then confirms it's still the one on record for that user
 * (so a logged-out/rotated-away token can't be replayed even if it hasn't
 * expired yet). Issues a fresh access + refresh pair on success.
 * Errors: 401 if no refresh cookie is present, 403 if it's invalid,
 * expired, or has been superseded/revoked.
 */
export const refreshToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError(401, 'Refresh token not found');

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.refreshSecret) as JwtPayload;
  } catch {
    throw new AppError(403, 'Invalid or expired refresh token');
  }

  const user = await getUserByRefreshToken(token);
  if (!user) throw new AppError(403, 'Refresh token revoked');

  await issueSession(user, res);
  res.json({ message: 'Token refreshed' });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Revokes the refresh token server-side (nulls `refresh_token` on the user
 * row, so it can no longer be used even if the cookie survives) and clears
 * both auth cookies. Always succeeds, even if the refresh cookie was
 * already missing/invalid — logging out is idempotent by design.
 */
export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const user = await getUserByRefreshToken(token);
    if (user) await updateRefreshToken(user.id, null);
  }
  clearAuthCookies(res);
  res.json({ message: 'Logged out successfully' });
});

// ─── Profile ──────────────────────────────────────────────────────────────────

export const setupProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { username, bio, profilePicture } = req.body;

  const user = await updateUserProfile(userId, username, bio, profilePicture);
  res.json({ user: sanitizeUser(user) });
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const user = await getUserById(userId);
  if (!user) throw new AppError(404, 'User not found');
  res.json({ user: sanitizeUser(user) });
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

/**
 * Issues a fresh one-time nonce for the wallet-link signature flow.
 * `linkWallet` verifies the wallet signed a message embedding this exact
 * nonce, then rotates it, so a captured signature can't be replayed.
 */
export const getNonce = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const nonce = crypto.randomBytes(16).toString('hex');
  await updateUserNonce(userId, nonce);
  res.json({ nonce });
});

/**
 * Links a wallet address to the authenticated account after verifying the
 * caller controls it: recovers the signer of a fixed message containing
 * the user's current nonce (from `getNonce`) via `ethers.verifyMessage`
 * and checks it matches the claimed `walletAddress`. Rotates the nonce
 * afterward so the signature can't be reused.
 * Errors: 400 if no nonce was requested yet, or the address is already
 * linked to a different account; 401 if the signature doesn't recover to
 * the claimed address.
 */
export const linkWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { walletAddress, signature } = req.body;

  const user = await getUserById(userId);
  if (!user || !user.nonce)
    throw new AppError(400, 'User or nonce not found. Request nonce first.');

  const existingWalletUser = await getUserByWalletAddress(walletAddress);
  if (existingWalletUser && existingWalletUser.id !== userId)
    throw new AppError(400, 'Wallet is already linked to another account.');

  const message = `Please sign this message to link your wallet. Nonce: ${user.nonce}`;
  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch {
    throw new AppError(401, 'Invalid signature');
  }
  if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase())
    throw new AppError(401, 'Invalid signature');

  const updatedUser = await linkWalletAddress(userId, walletAddress);
  await updateUserNonce(userId, crypto.randomBytes(16).toString('hex'));

  res.json({ user: sanitizeUser(updatedUser) });
});

/**
 * Removes the wallet linked to the authenticated account, freeing that
 * address to be linked elsewhere and letting this account link a
 * different one afterward. This only clears the off-chain association —
 * it has no on-chain effect and doesn't touch the browser's live wallet
 * connection (that's a separate, wallet-side concern).
 * Errors: 400 if no wallet is currently linked.
 */
export const unlinkWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const user = await getUserById(userId);
  if (!user) throw new AppError(404, 'User not found');
  if (!user.wallet_address) throw new AppError(400, 'No wallet is linked to this account.');

  const updatedUser = await unlinkWalletAddress(userId);
  res.json({ user: sanitizeUser(updatedUser) });
});
