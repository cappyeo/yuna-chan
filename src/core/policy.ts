const administrator = 1n << 3n;
export function hasPermissions(actual: bigint | null, required: bigint): boolean {
  if (required === 0n) return true;
  return actual !== null && ((actual & administrator) !== 0n || (actual & required) === required);
}
export function isAllowedGuild(guildId: string | null, allowed: ReadonlySet<string>): guildId is string {
  return guildId !== null && allowed.has(guildId);
}
