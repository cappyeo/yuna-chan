import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';
import { createDatabase } from '../../src/db/client.ts';
import { applyMigrations, assertMigrationsApplied } from '../../src/db/migrations.ts';
import { createSettingsStore } from '../../src/db/settings.ts';
test('PostgreSQL migrations, tenancy, audit and idempotency', async (suite) => {
  const connectionString = process.env['TEST_DATABASE_URL'];
  assert.ok(connectionString, 'Set TEST_DATABASE_URL to a dedicated disposable test database.');
  const admin = new Pool({ connectionString });
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const { pool, db } = createDatabase(url.toString());
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await suite.test('new database is not reported as migrated', async () => { await assert.rejects(() => assertMigrationsApplied(pool)); });
    await suite.test('migrations apply once and are idempotent', async () => {
      assert.equal(await applyMigrations(pool), 1); assert.equal(await applyMigrations(pool), 0);
      await assertMigrationsApplied(pool);
    });
    const settings = createSettingsStore(db, 'en');
    const a = '123456789012345678'; const b = '123456789012345679'; const actor = '223456789012345678';
    await suite.test('server configuration is isolated', async () => {
      assert.equal(await settings.getLocale(a), 'en');
      await settings.setLocale(a, 'vi', actor, '323456789012345678');
      assert.equal(await settings.getLocale(a), 'vi'); assert.equal(await settings.getLocale(b), 'en');
    });
    await suite.test('duplicate interaction cannot replay an old setting', async () => {
      await settings.setLocale(a, 'en', actor, '323456789012345679');
      await settings.setLocale(a, 'vi', actor, '323456789012345678');
      assert.equal(await settings.getLocale(a), 'en');
      const result = await pool.query<{ count: string }>('SELECT count(*) FROM audit_events');
      assert.equal(result.rows[0]?.count, '2');
    });
    await suite.test('changed migration checksums fail closed', async () => {
      await pool.query("UPDATE yuna_migrations SET checksum = 'changed'");
      await assert.rejects(() => assertMigrationsApplied(pool));
      await assert.rejects(() => applyMigrations(pool));
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
