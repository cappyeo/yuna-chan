import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';
const migrationDirectory = new URL('../../migrations/', import.meta.url);
interface Migration { name: string; checksum: string; sql: string }
export async function readMigrations(): Promise<Migration[]> {
  const names = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0 || names.some((name) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new Error('Invalid or missing migration files');
  }
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(new URL(name, migrationDirectory), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}
export async function assertMigrationsApplied(pool: Pool): Promise<void> {
  const expected = await readMigrations();
  const applied = await pool.query<{ name: string; checksum: string }>('SELECT name, checksum FROM yuna_migrations ORDER BY name');
  if (applied.rows.length !== expected.length || expected.some((item, index) => {
    const row = applied.rows[index];
    return row?.name !== item.name || row.checksum !== item.checksum;
  })) throw new Error('Database migrations are missing, changed, or newer than this build');
}
export async function applyMigrations(pool: Pool): Promise<number> {
  const migrations = await readMigrations();
  const client: PoolClient = await pool.connect();
  let count = 0;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('yuna-chan:migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS yuna_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query<{ name: string; checksum: string }>('SELECT name, checksum FROM yuna_migrations ORDER BY name');
    // Applied files must be an exact prefix: reject edits, removals and backdated inserts.
    for (const [index, row] of applied.rows.entries()) {
      const file = migrations[index];
      if (file?.name !== row.name || file.checksum !== row.checksum) throw new Error('Migration history mismatch');
    }
    for (const migration of migrations.slice(applied.rows.length)) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO yuna_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]);
        await client.query('COMMIT');
        count += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return count;
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(hashtext('yuna-chan:migrations'))"); }
    finally { client.release(); }
  }
}
