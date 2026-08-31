import { Request, Response, NextFunction } from 'express';
import jwt, { VerifyErrors } from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/user.model';

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

/** Express `Request` augmented with the decoded JWT payload set by `authenticateJWT`. */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Verifies the `accessToken` httpOnly cookie and attaches the decoded
 * payload to `req.user`. The access token is never exposed to client-side
 * JS — it travels only as a cookie, mirroring the existing refresh-token
 * pattern, so an XSS bug can't exfiltrate it from localStorage.
 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.cookies?.accessToken;
  if (!token) {
    res.sendStatus(401);
    return;
  }
  jwt.verify(token, env.jwtSecret, (err: VerifyErrors | null, decoded: unknown) => {
    if (err) {
      res.sendStatus(403);
      return;
    }
    req.user = decoded as JwtPayload;
    next();
  });
};

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER `authenticateJWT`.
 *
 * @example
 * router.get('/admin/stats', authenticateJWT, authorize('admin'), getAdminStats);
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
};
