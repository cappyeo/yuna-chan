import { randomUUID } from 'node:crypto';
import { MessageFlags, type Interaction } from 'discord.js';
import { componentId, parseComponentId } from '../core/component-id.ts';
import type { Config } from '../core/config.ts';
import { resolveLocale, t, type TranslationKey } from '../core/i18n.ts';
import { safeError, type Logger } from '../core/log.ts';
import { hasPermissions, isAllowedGuild } from '../core/policy.ts';
import { Cooldown } from '../core/rate-limit.ts';
import type { SettingsStore } from '../db/settings.ts';
import type { Context, Handler, SupportedInteraction } from './module.ts';
import type { Registry } from './registry.ts';
import { editReply, panel, privateReply } from './ui.ts';
export function createRouter(config: Config, registry: Registry, settings: SettingsStore, log: Logger) {
  const cooldown = new Cooldown();
  async function run<I extends SupportedInteraction>(interaction: I, handler: Handler<I> | undefined, route: string, entityId?: string): Promise<void> {
    const locale = resolveLocale(interaction.locale, config.defaultLocale);
    const reference = randomUUID();
    const respond: Context['respond'] = async (container) => {
      if (interaction.deferred) await interaction.editReply(editReply(container));
      else if (interaction.replied) await interaction.followUp(privateReply(container));
      else await interaction.reply(privateReply(container));
    };
    const reject = async (key: TranslationKey) => respond(panel(t(locale, 'error.title'), t(locale, key)));
    try {
      if (!isAllowedGuild(interaction.guildId, config.guildIds)) return await reject('error.guild');
      if (!handler) return await reject('error.expired');
      if (!hasPermissions(interaction.memberPermissions?.bitfield ?? null, handler.userPermissions)) return await reject('error.permission');
      if (!hasPermissions(interaction.appPermissions?.bitfield ?? null, handler.botPermissions)) return await reject('error.botPermission');
      if (!cooldown.take(`${interaction.guildId}:${interaction.user.id}`, Date.now())) return await reject('error.rate');
      // ACK before any database/network I/O; IsComponentsV2 belongs on editReply, not deferReply.
      if (handler.acknowledgement !== 'manual') await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const context: Context = {
        guildId: interaction.guildId, locale, settings, respond,
        ...(entityId === undefined ? {} : { entityId }),
      };
      await handler.execute(interaction, context);
      log('debug', { event: 'interaction.completed', reference, route });
    } catch (error) {
      log('error', { event: 'interaction.failed', reference, route, ...safeError(error) });
      try { await respond(panel(t(locale, 'error.title'), t(locale, 'error.generic', { reference }))); }
      catch (replyError) { log('warn', { event: 'interaction.error_reply_failed', reference, ...safeError(replyError) }); }
    }
  }
  return async (interaction: Interaction): Promise<void> => {
    if (interaction.isChatInputCommand()) return run(interaction, registry.commands.get(interaction.commandName), interaction.commandName);
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    const parsed = parseComponentId(interaction.customId);
    const route = parsed ? componentId(parsed.module, parsed.action) : 'invalid';
    if (interaction.isButton()) return run(interaction, registry.buttons.get(route), route, parsed?.entityId);
    if (interaction.isStringSelectMenu()) return run(interaction, registry.selects.get(route), route, parsed?.entityId);
    return run(interaction, registry.modals.get(route), route, parsed?.entityId);
  };
}
