export const snowflakePattern = /^[0-9]{17,20}$/;
export type Locale = 'en' | 'vi';
export interface Config {
  readonly token: string;
  readonly applicationId: string;
  readonly guildIds: ReadonlySet<string>;
  readonly databaseUrl: string;
  readonly defaultLocale: Locale;
  readonly healthHost: string;
  readonly healthPort: number;
  readonly auditRetentionDays: number;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export function parseConfig(env: Record<string, string | undefined>): Config {
  const required = (key: string): string => {
    const value = env[key]?.trim();
    if (!value || value === 'replace_me') throw new Error(`Missing configuration: ${key}`);
    return value;
  };
  const integer = (key: string, fallback: number, min: number, max: number): number => {
    const raw = env[key] ?? String(fallback);
    if (!/^\d+$/.test(raw)) throw new Error(`Invalid integer: ${key}`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`Out of range: ${key}`);
    }
    return value;
  };
  const token = required('DISCORD_TOKEN');
  const applicationId = required('DISCORD_APPLICATION_ID');
  const ids = required('DISCORD_GUILD_IDS').split(',').map((s) => s.trim());
  if (!snowflakePattern.test(applicationId)) throw new Error('Invalid DISCORD_APPLICATION_ID');
  if (!ids.every((id) => snowflakePattern.test(id))) throw new Error('Invalid DISCORD_GUILD_IDS');
  const databaseUrl = required('DATABASE_URL');
  let url: URL;
  try { url = new URL(databaseUrl); } catch { throw new Error('Invalid DATABASE_URL'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('Invalid DATABASE_URL');
  }
  const defaultLocale = env['DEFAULT_LOCALE'] ?? 'en';
  if (defaultLocale !== 'en' && defaultLocale !== 'vi') throw new Error('Invalid DEFAULT_LOCALE');
  const logLevel = env['LOG_LEVEL'] ?? 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) throw new Error('Invalid LOG_LEVEL');
  return Object.freeze({
    token, applicationId, guildIds: new Set(ids), databaseUrl, defaultLocale,
    healthHost: env['HEALTH_HOST'] ?? '127.0.0.1',
    healthPort: integer('HEALTH_PORT', 3000, 1, 65535),
    auditRetentionDays: integer('AUDIT_RETENTION_DAYS', 90, 1, 3650),
    logLevel: logLevel as Config['logLevel'],
  });
}
export function databaseUrlFromEnv(env: Record<string, string | undefined>): string {
  const value = env['DATABASE_URL'];
  if (!value) throw new Error('Missing configuration: DATABASE_URL');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid DATABASE_URL'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('Invalid DATABASE_URL');
  }
  return value;
}
