import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Locale } from '../core/config.ts';
import type { Database } from './client.ts';
import { auditEvents, guildSettings } from './schema.ts';
export interface SettingsStore {
  getLocale(guildId: string): Promise<Locale>;
  setLocale(guildId: string, locale: Locale, actorId: string, interactionId: string): Promise<void>;
}
export function createSettingsStore(db: Database, defaultLocale: Locale): SettingsStore {
  return {
    async getLocale(guildId) {
      const [row] = await db.select({ locale: guildSettings.locale }).from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
      return row?.locale ?? defaultLocale;
    },
    async setLocale(guildId, locale, actorId, interactionId) {
      await db.transaction(async (tx) => {
        await tx.insert(guildSettings).values({ guildId, locale: defaultLocale }).onConflictDoNothing();
        const inserted = await tx.insert(auditEvents).values({
          id: randomUUID(), interactionId, guildId, actorId,
          action: 'settings.language.set', value: locale,
        }).onConflictDoNothing({ target: auditEvents.interactionId }).returning({ id: auditEvents.id });
        // A duplicate delivery must not replay a stale state change.
        if (inserted.length === 0) return;
        await tx.update(guildSettings).set({ locale, updatedAt: new Date() }).where(eq(guildSettings.guildId, guildId));
      });
    },
  };
}
