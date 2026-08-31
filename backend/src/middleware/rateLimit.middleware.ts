import rateLimit, { Options } from 'express-rate-limit';
import { RequestHandler } from 'express';

// Rate limiting is disabled under automated tests: a single test file
// legitimately calls /auth/register or /auth/login far more than a human
// would in 15 minutes, and express-rate-limit's in-memory store persists
// across `it()` blocks within a file, so leaving it on would make tests
// fail on request *volume* rather than on the behavior actually under test.
const isTest = process.env.NODE_ENV === 'test';

const buildLimiter = (options: Partial<Options> & { windowMs: number; max: number }): RequestHandler =>
  isTest
    ? (_req, _res, next) => next()
    : rateLimit({ standardHeaders: true, legacyHeaders: false, ...options });

/**
 * Rate limiter for authentication endpoints (login, register).
 * Allows a maximum of 10 requests per 15-minute window per IP.
 */
export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for the refresh-token endpoint. Looser than `authLimiter`
 * since a legitimate client refreshes silently and periodically, but this
 * is still a token-issuing endpoint and was previously unprotected.
 */
export const refreshLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many token refresh attempts. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for admin mutation endpoints (role changes, deletions).
 * These are already gated behind authentication + the admin role, so this
 * is a defense-in-depth measure against a compromised/malicious admin
 * session or a buggy client hammering the API.
 */
export const adminMutationLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: {
    error: 'Too many admin operations from this session. Please slow down.'
  }
});

/**
 * App-wide fallback limiter, mounted on every request. Everything above
 * this targets a specific sensitive route; before this change, routes
 * like /tokens, /transactions, and /notifications (the last one polled
 * every 30s by the notification bell) had no rate limiting at all. Kept
 * loose — 300 requests per 15 minutes per IP, well above any normal usage
 * pattern including polling — so it only catches actual flooding.
 */
export const apiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    error: 'Too many requests from this IP. Please try again later.'
  }
});
