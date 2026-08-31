import { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

/**
 * Validates `req.body` against a zod schema before the request reaches the
 * controller, rejecting with 400 + the first validation issue. On success,
 * `req.body` is replaced with the parsed (and coerced/trimmed) value.
 */
export const validateBody = (schema: ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message || 'Invalid request body' });
    return;
  }
  req.body = result.data;
  next();
};
