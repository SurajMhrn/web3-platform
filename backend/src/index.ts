import app from './app';
import pool from './config/db';

import { initDb } from './config/initDb';

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`[Server]: Running on port ${PORT}`);
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`[Database]: Connected to SQLite at ${res.rows[0].now}`);
    await initDb();
  } catch (err) {
    console.error(`[Database Error]: Failed to connect to DB`, err);
  }
});
