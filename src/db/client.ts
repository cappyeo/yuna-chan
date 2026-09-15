import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';
export function createDatabase(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30_000, statement_timeout: 5000, application_name: 'yuna-chan',
  });
  return { pool, db: drizzle(pool, { schema }) };
}
export type Database = ReturnType<typeof createDatabase>['db'];
