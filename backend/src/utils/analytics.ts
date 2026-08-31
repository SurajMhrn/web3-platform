import pool from '../config/db';

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
  const result = await pool.query(
    `SELECT date(created_at) AS day, COUNT(*) AS count
     FROM ${table}
     WHERE created_at >= date('now', ?)
     GROUP BY day
     ORDER BY day`,
    [`-${days} days`]
  );
  return result.rows;
};
