import { ActionRowBuilder, ApplicationIntegrationType, ButtonBuilder, ButtonStyle, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { componentId } from '../../core/component-id.ts';
import { isLocale, t } from '../../core/i18n.ts';
import type { BotModule, Context } from '../../discord/module.ts';
import { panel } from '../../discord/ui.ts';
function command(name: string, description: string, viDescription: string): SlashCommandBuilder {
  return new SlashCommandBuilder().setName(name).setDescription(description)
    .setDescriptionLocalizations({ vi: viDescription })
    .setContexts(InteractionContextType.Guild).setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
}
function systemPanel(context: Context) {
  const { locale } = context;
  return panel(t(locale, 'system.title'), `${t(locale, 'system.body')}\n\n${t(locale, 'system.uptime', { seconds: new Intl.NumberFormat(locale).format(Math.floor(process.uptime())) })}`)
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId('system', 'refresh')).setLabel(t(locale, 'system.refresh')).setStyle(ButtonStyle.Secondary),
    ));
}
async function settingsPanel(context: Context, saved = false) {
  const serverLocale = await context.settings.getLocale(context.guildId);
  const body = t(context.locale, 'settings.body', { language: serverLocale === 'vi' ? 'Tiếng Việt' : 'English' });
  return panel(t(context.locale, 'settings.title'), saved ? `${t(context.locale, 'settings.saved')}\n\n${body}` : body)
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId(componentId('system', 'language')).setPlaceholder(t(context.locale, 'settings.placeholder'))
        .setMinValues(1).setMaxValues(1).addOptions(
          { label: 'English', value: 'en', default: serverLocale === 'en' },
          { label: 'Tiếng Việt', value: 'vi', default: serverLocale === 'vi' },
        ),
    ));
}
const manageGuild = { userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: 0n };
export const systemModule: BotModule = {
  id: 'system',
  commands: [
    { data: command('system', 'Check the bot foundation', 'Kiểm tra nền tảng của bot'), userPermissions: 0n, botPermissions: 0n,
      async execute(_interaction, context) { await context.respond(systemPanel(context)); } },
    { data: command('settings', 'Configure this server', 'Cấu hình server này').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), ...manageGuild,
      async execute(_interaction, context) { await context.respond(await settingsPanel(context)); } },
  ],
  buttons: [{ action: 'refresh', userPermissions: 0n, botPermissions: 0n,
    async execute(_interaction, context) { await context.respond(systemPanel(context)); } }],
  selects: [{ action: 'language', ...manageGuild,
    async execute(interaction, context) {
      const value = interaction.values[0];
      if (interaction.values.length !== 1 || !isLocale(value)) {
        await context.respond(panel(t(context.locale, 'error.title'), t(context.locale, 'error.input')));
        return;
      }
      await context.settings.setLocale(context.guildId, value, interaction.user.id, interaction.id);
      await context.respond(await settingsPanel(context, true));
    } }],
};
