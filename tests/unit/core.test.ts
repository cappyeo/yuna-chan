import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConfig, databaseUrlFromEnv } from '../../src/core/config.ts';
import { componentId, parseComponentId } from '../../src/core/component-id.ts';
import { en, vi, isLocale, resolveLocale, t } from '../../src/core/i18n.ts';
import { safeError } from '../../src/core/log.ts';
import { hasPermissions, isAllowedGuild } from '../../src/core/policy.ts';
import { Cooldown } from '../../src/core/rate-limit.ts';
import { createRegistry } from '../../src/discord/registry.ts';
import { readMigrations } from '../../src/db/migrations.ts';
const environment = {
  DISCORD_TOKEN: 'test-only-not-a-real-token',
  DISCORD_APPLICATION_ID: '123456789012345678',
  DISCORD_GUILD_IDS: '123456789012345679,123456789012345680',
  DATABASE_URL: 'postgresql://test:secret@localhost/yuna_test',
};
test('config: two guilds and safe defaults', () => {
  const config = parseConfig(environment);
  assert.equal(config.guildIds.size, 2);
  assert.equal(config.defaultLocale, 'en');
  assert.equal(config.auditRetentionDays, 90);
  assert.equal(config.healthHost, '127.0.0.1');
});
test('config: allowlist is mandatory and not an implicit public mode', () => {
  assert.throws(() => parseConfig({ ...environment, DISCORD_GUILD_IDS: '' }));
});
test('config: rejects partially malformed allowlist', () => {
  assert.throws(() => parseConfig({ ...environment, DISCORD_GUILD_IDS: '123456789012345679,nope' }));
});
test('config: removes duplicate server IDs', () => {
  assert.equal(parseConfig({ ...environment, DISCORD_GUILD_IDS: '123456789012345679,123456789012345679' }).guildIds.size, 1);
});
test('config: rejects numeric truncation and invalid port', () => {
  for (const port of ['3000x', '1.5', '-1', '65536']) assert.throws(() => parseConfig({ ...environment, HEALTH_PORT: port }));
});
test('config: rejects invalid retention and unsupported locale', () => {
  assert.throws(() => parseConfig({ ...environment, AUDIT_RETENTION_DAYS: '0' }));
  assert.throws(() => parseConfig({ ...environment, DEFAULT_LOCALE: 'ko' }));
});
test('config: errors never echo secret database values', () => {
  assert.throws(() => parseConfig({ ...environment, DATABASE_URL: 'https://secret.example/private' }), { message: 'Invalid DATABASE_URL' });
  assert.throws(() => databaseUrlFromEnv({ DATABASE_URL: 'not-a-url-with-secret' }), { message: 'Invalid DATABASE_URL' });
});
test('config: database-only CLI does not require a Discord token', () => {
  assert.equal(databaseUrlFromEnv({ DATABASE_URL: environment.DATABASE_URL }), environment.DATABASE_URL);
});
test('locale: English regional variants', () => { assert.equal(resolveLocale('en-US'), 'en'); assert.equal(resolveLocale('en-GB'), 'en'); });
test('locale: Vietnamese variants', () => { assert.equal(resolveLocale('vi'), 'vi'); assert.equal(resolveLocale('VI-vn'), 'vi'); });
test('locale: unknown values use explicit fallback', () => { assert.equal(resolveLocale('fr'), 'en'); assert.equal(resolveLocale(null, 'vi'), 'vi'); });
test('locale: only supported language values can be stored', () => { assert.ok(isLocale('vi')); assert.ok(!isLocale('VI')); assert.ok(!isLocale(null)); });
test('translations: Vietnamese has exactly the English keys', () => { assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort()); });
test('translations: placeholders agree across dictionaries', () => {
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    assert.deepEqual([...en[key].matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort(), [...vi[key].matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort());
  }
});
test('translations: values interpolate, missing arguments fail visibly', () => {
  assert.match(t('vi', 'system.uptime', { seconds: 42 }), /42/);
  assert.throws(() => t('en', 'system.uptime'));
});
test('component IDs: namespaced roundtrip with an entity', () => {
  assert.deepEqual(parseComponentId(componentId('tickets', 'close', '123_abc')), { module: 'tickets', action: 'close', entityId: '123_abc' });
});
test('component IDs: a stateless route has no entity property', () => { assert.deepEqual(parseComponentId('y1:system:refresh'), { module: 'system', action: 'refresh' }); });
test('component IDs: reject wrong versions, delimiters, extra fields and empty identifiers', () => {
  for (const id of ['y0:system:refresh', 'y1:system', 'y1:system:refresh:', 'y1:system:refresh:x:y', 'y1:../system:refresh', 'y1:system:refresh:' + 'a'.repeat(90)]) assert.equal(parseComponentId(id), null);
});
test('component IDs: builder rejects oversized or unsafe segments', () => {
  assert.throws(() => componentId('a'.repeat(25), 'refresh'));
  assert.throws(() => componentId('system', 'refresh', 'a:b'));
});
test('permissions: require every requested bit', () => {
  assert.ok(hasPermissions(32n | 64n, 32n | 64n));
  assert.ok(!hasPermissions(32n, 32n | 64n));
});
test('permissions: administrator, missing permissions and public actions', () => {
  assert.ok(hasPermissions(8n, 32n));
  assert.ok(!hasPermissions(null, 32n));
  assert.ok(hasPermissions(null, 0n));
});
test('permissions: no DM or unapproved guild access', () => {
  const allowed = new Set(['123456789012345679']);
  assert.ok(isAllowedGuild('123456789012345679', allowed));
  assert.ok(!isAllowedGuild(null, allowed));
  assert.ok(!isAllowedGuild('123456789012345680', allowed));
});
test('cooldown: blocks repeated requests, then expires', () => {
  const limiter = new Cooldown();
  assert.ok(limiter.take('guild:user', 0, 1500));
  assert.ok(!limiter.take('guild:user', 1499, 1500));
  assert.ok(limiter.take('guild:user', 1500, 1500));
});
test('cooldown: independent guild/user keys', () => {
  const limiter = new Cooldown();
  assert.ok(limiter.take('g1:u', 0)); assert.ok(limiter.take('g2:u', 0));
});
test('cooldown: bounded capacity fails closed and reclaims expired entries', () => {
  const limiter = new Cooldown(1);
  assert.ok(limiter.take('a', 0, 10)); assert.ok(!limiter.take('b', 1, 10));
  assert.ok(limiter.take('b', 10, 10));
});
test('cooldown: rejects unsafe clock values and capacities', () => {
  assert.throws(() => new Cooldown(0)); assert.throws(() => new Cooldown().take('x', NaN));
});
test('logs: error metadata excludes messages and credentials', () => {
  const error = Object.assign(new Error('token=secret sql=private'), { code: 'ECONNRESET' });
  assert.deepEqual(safeError(error), { errorName: 'Error', errorCode: 'ECONNRESET' });
  assert.deepEqual(safeError({ code: 'postgres://secret@db' }), {});
});
test('registry: duplicate module IDs fail fast', () => {
  assert.throws(() => createRegistry([{ id: 'system' }, { id: 'system' }]), /Duplicate module/);
});
test('registry: duplicate handlers fail fast', () => {
  const handler = { action: 'refresh', userPermissions: 0n, botPermissions: 0n, async execute() {} };
  assert.throws(() => createRegistry([{ id: 'system', buttons: [handler, handler] }]), /Duplicate route/);
});
test('registry: button and modal may use the same logical action', () => {
  const handler = { action: 'close', userPermissions: 0n, botPermissions: 0n, async execute() {} };
  const registry = createRegistry([{ id: 'tickets', buttons: [handler], modals: [handler] }]);
  assert.ok(registry.buttons.has('y1:tickets:close')); assert.ok(registry.modals.has('y1:tickets:close'));
});
test('migrations: checksum and ordering are deterministic', async () => {
  const migrations = await readMigrations();
  assert.equal(migrations.length, 1);
  assert.equal(migrations[0]?.name, '0001_foundation.sql');
  assert.match(migrations[0]?.checksum ?? '', /^[a-f0-9]{64}$/);
  assert.deepEqual(await readMigrations(), migrations);
});
test('config: database CLI rejects missing host and database name', () => {
  for (const value of ['postgresql://localhost', 'postgresql:///yuna']) {
    assert.throws(() => databaseUrlFromEnv({ DATABASE_URL: value }), { message: 'Invalid DATABASE_URL' });
  }
});
