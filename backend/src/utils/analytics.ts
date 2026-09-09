import pool, { isPostgres } from '../config/db';

export interface DayCount {
  day: string;
  count: number;
}

/** Tables analytics is allowed to query — a closed set, never user input. */
type CountableTable = 'users' | 'tokens' | 'transactions';

/**
 * Per-day row counts for the last `days` days from one of the app's own
 * tables. `table` is restricted to a compile-time union (never a request
 * value), so interpolating it into the query is safe — there is no
 * parameter placeholder for identifiers like table names in SQL.
 */
export const getCountsByDay = async (table: CountableTable, days: number): Promise<DayCount[]> => {
  // Date handling is where the two engines differ most. Both branches return
  // `day` as a 'YYYY-MM-DD' string, because the client charts group on that
  // exact shape — Postgres would otherwise hand back a Date that serializes
  // with a time component and silently split each day into its own bucket.
  const result = isPostgres
    ? await pool.query(
        `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
         FROM ${table}
         WHERE created_at >= NOW() - ($1 || ' days')::interval
         GROUP BY day
         ORDER BY day`,
        [String(days)]
      )
    : await pool.query(
        `SELECT date(created_at) AS day, COUNT(*) AS count
         FROM ${table}
         WHERE created_at >= date('now', ?)
         GROUP BY day
         ORDER BY day`,
        [`-${days} days`]
      );
  return result.rows;
};
