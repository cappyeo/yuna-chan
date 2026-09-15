/** Single-process cooldown, not a distributed rate limit or a durable job store. */
export class Cooldown {
  private readonly entries = new Map<string, number>();
  private readonly capacity: number;
  constructor(capacity = 10_000) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid cooldown capacity');
    this.capacity = capacity;
  }
  take(key: string, now: number, durationMs = 1500): boolean {
    if (!Number.isFinite(now) || !Number.isFinite(durationMs) || durationMs < 1) throw new Error('Invalid cooldown time');
    const until = this.entries.get(key);
    if (until !== undefined && until > now) return false;
    if (this.entries.size >= this.capacity) this.prune(now);
    // Fail closed rather than evicting an active user's limit under a flood.
    if (!this.entries.has(key) && this.entries.size >= this.capacity) return false;
    this.entries.set(key, now + durationMs);
    return true;
  }
  prune(now: number): void {
    for (const [key, until] of this.entries) if (until <= now) this.entries.delete(key);
  }
}
