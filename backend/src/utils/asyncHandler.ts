import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so a rejected promise is forwarded to
 * Express's error-handling middleware instead of crashing the process
 * (Express does not await handlers, so an unhandled rejection inside one
 * would otherwise be silently swallowed pre-Express-5).
 */
export const asyncHandler = <Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler =>
  (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
