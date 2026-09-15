import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const guildSettings = pgTable('guild_settings', {
  guildId: text('guild_id').primaryKey(),
  locale: text('locale').$type<'en' | 'vi'>().notNull().default('en'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey(),
  interactionId: text('interaction_id').notNull().unique(),
  guildId: text('guild_id').notNull().references(() => guildSettings.guildId, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('audit_events_guild_time_idx').on(table.guildId, table.createdAt), index('audit_events_time_idx').on(table.createdAt)]);
