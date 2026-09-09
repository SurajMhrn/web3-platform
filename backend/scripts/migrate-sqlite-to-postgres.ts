/**
 * One-time copy of the local SQLite database into the shared Postgres one.
 *
 * Run with:  npm run migrate:pg          (add --force to overwrite existing rows)
 *
 * Reads DATABASE_URL from backend/.env. Safe to re-run: it skips rows whose id
 * already exists unless --force is passed, and it never deletes anything.
 */
import 'dotenv/config';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { Pool } from 'pg';

const TABLES = ['users', 'tokens', 'transactions', 'notifications'] as const;

const force = process.argv.includes('--force');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in backend/.env — nothing to migrate into.');
    process.exit(1);
  }

  const sqlitePath = process.env.SQLITE_FILE || path.join(__dirname, '../web3_db.sqlite');
  const sqlite = await open({ filename: sqlitePath, driver: sqlite3.Database });
  const pg = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 3 });

  console.log(`Source: ${sqlitePath}`);
  console.log(`Target: ${databaseUrl.replace(/:\/\/[^@]+@/, '://***@')}\n`);

  const client = await pg.connect();
  let copied = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    for (const table of TABLES) {
      const rows = await sqlite.all(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        console.log(`${table}: nothing to copy`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const conflict = force
        ? `ON CONFLICT (id) DO UPDATE SET ${columns
            .filter((c) => c !== 'id')
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ')}`
        : 'ON CONFLICT DO NOTHING';

      let tableCopied = 0;
      for (const row of rows) {
        const result = await client.query(
          `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ${conflict}`,
          columns.map((c) => row[c])
        );
        if (result.rowCount && result.rowCount > 0) tableCopied += 1;
      }

      copied += tableCopied;
      skipped += rows.length - tableCopied;
      console.log(`${table}: ${tableCopied} copied, ${rows.length - tableCopied} already present`);
    }

    await client.query('COMMIT');
    console.log(`\nDone — ${copied} rows copied, ${skipped} skipped.`);
    if (skipped > 0 && !force) {
      console.log('Re-run with --force to overwrite the rows that already exist.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed and was rolled back — nothing was written.');
    throw err;
  } finally {
    client.release();
    await pg.end();
    await sqlite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
