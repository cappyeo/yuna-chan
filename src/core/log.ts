import type { Config } from './config.ts';
type Level = Config['logLevel'];
const rank: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
export interface LogFields {
  event: string;
  reference?: string;
  route?: string;
  errorName?: string;
  errorCode?: string;
  count?: number;
}
/** Deliberately omit error messages, stacks, request bodies, SQL and environment values. */
export function safeError(error: unknown): Pick<LogFields, 'errorName' | 'errorCode'> {
  const result: Pick<LogFields, 'errorName' | 'errorCode'> = {};
  if (error instanceof Error && /^[A-Za-z0-9_]{1,64}$/.test(error.name)) result.errorName = error.name;
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (/^[A-Z0-9_]{1,32}$/.test(code)) result.errorCode = code;
  }
  return result;
}
export function createLogger(level: Level = 'info') {
  return (severity: Level, fields: LogFields): void => {
    if (rank[severity] < rank[level]) return;
    process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level: severity, ...fields })}\n`);
  };
}
export type Logger = ReturnType<typeof createLogger>;
