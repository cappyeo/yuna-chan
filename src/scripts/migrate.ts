import { databaseUrlFromEnv } from '../core/config.ts';
import { createDatabase } from '../db/client.ts';
import { applyMigrations } from '../db/migrations.ts';
const { pool } = createDatabase(databaseUrlFromEnv(process.env));
try { console.log(`Applied ${await applyMigrations(pool)} migration(s).`); }
catch { console.error('Migration failed. Check connectivity, database permissions and immutable migration history.'); process.exitCode = 1; }
finally { await pool.end(); }
