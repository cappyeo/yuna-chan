import { createHash } from 'node:crypto';
import { Client, Events, GatewayIntentBits, Options } from 'discord.js';
import type { Server } from 'node:http';
import type { PoolClient } from 'pg';
import { parseConfig } from './core/config.ts';
import { createLogger, safeError } from './core/log.ts';
import { createDatabase } from './db/client.ts';
import { assertMigrationsApplied } from './db/migrations.ts';
import { createSettingsStore } from './db/settings.ts';
import { createRegistry } from './discord/registry.ts';
import { createRouter } from './discord/router.ts';
import { modules } from './modules/index.ts';
import { startHealthServer } from './ops/health.ts';
const config = parseConfig(process.env);
const log = createLogger(config.logLevel);
const { pool, db } = createDatabase(config.databaseUrl);
// No MessageContent, GuildMembers or Presence privileged intents in the foundation.
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [], repliedUser: false },
  makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 0 }) });
const pending = new Set<Promise<void>>();
let stopping = false;
let server: Server | undefined;
let maintenance: ReturnType<typeof setInterval> | undefined;
let lease: PoolClient | undefined;
let maintenanceBusy = false;
async function shutdown(exitCode = 0): Promise<void> {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  log('info', { event: 'application.stopping' });
  const deadline = setTimeout(() => process.exit(1), 15_000);
  deadline.unref();
  if (maintenance) clearInterval(maintenance);
  try {
    const httpClosed = new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    await Promise.allSettled([...pending]);
    const results = await Promise.allSettled([
      client.destroy(), httpClosed,
      (async () => {
        try { lease?.release(true); } // Destroy session: release the singleton advisory lock.
        finally { await pool.end(); }
      })(),
    ]);
    if (results.some((result) => result.status === 'rejected')) process.exitCode = 1;
  } catch (error) {
    log('error', { event: 'application.shutdown_failed', ...safeError(error) });
    process.exitCode = 1;
  } finally { clearTimeout(deadline); }
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
process.on('unhandledRejection', (error) => { log('error', { event: 'application.unhandled_rejection', ...safeError(error) }); void shutdown(1); });
process.on('uncaughtException', (error) => { log('error', { event: 'application.uncaught_exception', ...safeError(error) }); void shutdown(1); });
pool.on('error', (error) => { log('error', { event: 'database.pool_error', ...safeError(error) }); });
client.on(Events.Error, (error) => { log('error', { event: 'discord.client_error', ...safeError(error) }); });
client.once(Events.ClientReady, (readyClient) => {
  if (readyClient.application.id !== config.applicationId) {
    log('error', { event: 'discord.application_id_mismatch' });
    void shutdown(1);
    return;
  }
  log('info', { event: 'discord.ready', count: readyClient.guilds.cache.size });
});
async function cleanupAudit(): Promise<void> {
  if (maintenanceBusy || stopping) return;
  maintenanceBusy = true;
  try {
    const cutoff = new Date(Date.now() - config.auditRetentionDays * 86400_000);
    const result = await pool.query('DELETE FROM audit_events WHERE id IN (SELECT id FROM audit_events WHERE created_at < $1 ORDER BY created_at LIMIT 1000)', [cutoff]);
    log('info', { event: 'audit.retention_cleanup', count: result.rowCount ?? 0 });
  } finally { maintenanceBusy = false; }
}
function track(task: Promise<void>): void {
  pending.add(task);
  void task.catch((error: unknown) => log('error', { event: 'application.task_failed', ...safeError(error) })).finally(() => pending.delete(task));
}
try {
  await assertMigrationsApplied(pool);
  if (stopping) throw new Error('Startup interrupted');
  // One application instance per token/database. No accidental double gateway consumers.
  lease = await pool.connect();
  lease.on('error', (error) => { log('error', { event: 'application.lease_lost', ...safeError(error) }); void shutdown(1); });
  const lockKey = createHash('sha256').update(`yuna:${config.applicationId}`).digest().readBigInt64BE().toString();
  const lock = await lease.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS locked', [lockKey]);
  if (stopping) throw new Error('Startup interrupted');
  if (!lock.rows[0]?.locked) throw new Error('Another application instance holds the database lease');
  const router = createRouter(config, createRegistry(modules), createSettingsStore(db, config.defaultLocale), log);
  client.on(Events.InteractionCreate, (interaction) => { if (!stopping) track(router(interaction)); });
  server = await startHealthServer(config, async () => {
    if (stopping || !client.isReady()) return false;
    await pool.query('SELECT 1');
    return true;
  });
  if (stopping) throw new Error('Startup interrupted');
  await client.login(config.token);
  if (stopping) throw new Error('Startup interrupted');
  track(cleanupAudit());
  maintenance = setInterval(() => track(cleanupAudit()), 3600_000);
  maintenance.unref();
} catch (error) {
  log('error', { event: 'application.startup_failed', ...safeError(error) });
  await shutdown(1);
}
