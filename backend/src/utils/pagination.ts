import { Request } from 'express';

export interface Pagination {
  limit: number;
  offset: number;
}

/**
 * Parses `?limit=&offset=` query params with sane defaults and an upper
 * bound on `limit`, so a client can't request an unbounded result set.
 */
export const parsePagination = (
  req: Request,
  { defaultLimit = 20, maxLimit = 100 }: { defaultLimit?: number; maxLimit?: number } = {}
): Pagination => {
  const rawLimit = parseInt(req.query.limit as string, 10);
  const rawOffset = parseInt(req.query.offset as string, 10);

  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit, maxLimit);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return { limit, offset };
};
