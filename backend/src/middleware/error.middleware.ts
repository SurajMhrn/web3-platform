import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Central error handler — must be registered last, after all routes.
 * Replaces the ~25 hand-rolled `try { ... } catch (e) { res.status(500)... }`
 * blocks that used to live in every controller. Controllers now `throw new
 * AppError(status, message)` for expected failures and let anything else
 * (a genuine bug) bubble up here as a generic 500, so no stack trace or
 * internal error detail is ever sent to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Known library-thrown HTTP errors — e.g. body-parser's 413 when a
  // request exceeds express.json()'s size limit, or its 400 on malformed
  // JSON — carry a numeric status/statusCode. Honor those instead of
  // collapsing every non-AppError into a generic 500; still no internal
  // detail (message, stack) is ever forwarded to the client.
  const libError = err as { status?: unknown; statusCode?: unknown; type?: unknown };
  const status = typeof libError?.status === 'number' ? libError.status : libError?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message = libError.type === 'entity.too.large' ? 'Request body too large' : 'Invalid request';
    res.status(status).json({ error: message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};

/**
 * Catches requests to routes that don't exist (must be registered after all
 * real routes, before the error handler).
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
};
