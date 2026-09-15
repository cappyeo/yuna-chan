import type { ButtonInteraction, ChatInputCommandInteraction, ContainerBuilder, ModalSubmitInteraction, SlashCommandBuilder, StringSelectMenuInteraction } from 'discord.js';
import type { Locale } from '../core/config.ts';
import type { SettingsStore } from '../db/settings.ts';
export type SupportedInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;
export interface Context {
  readonly guildId: string;
  readonly locale: Locale;
  readonly settings: SettingsStore;
  readonly entityId?: string;
  respond(container: ContainerBuilder): Promise<void>;
}
export interface Handler<I extends SupportedInteraction> {
  readonly userPermissions: bigint;
  readonly botPermissions: bigint;
  /** manual is reserved for immediate showModal(); never do slow I/O before it. */
  readonly acknowledgement?: 'private' | 'manual';
  execute(interaction: I, context: Context): Promise<void>;
}
export interface Command extends Handler<ChatInputCommandInteraction> { readonly data: SlashCommandBuilder }
export interface Component<I extends SupportedInteraction> extends Handler<I> { readonly action: string }
export interface BotModule {
  readonly id: string;
  readonly commands?: readonly Command[];
  readonly buttons?: readonly Component<ButtonInteraction>[];
  readonly selects?: readonly Component<StringSelectMenuInteraction>[];
  readonly modals?: readonly Component<ModalSubmitInteraction>[];
}
