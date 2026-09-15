import { ContainerBuilder, MessageFlags, TextDisplayBuilder, type InteractionEditReplyOptions, type InteractionReplyOptions } from 'discord.js';
export function panel(title: string, body: string): ContainerBuilder {
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${title}`),
    new TextDisplayBuilder().setContent(body),
  );
}
/** V2 messages intentionally have no legacy content or embeds fields. */
export function privateReply(container: ContainerBuilder): InteractionReplyOptions {
  return { flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, components: [container], allowedMentions: { parse: [], repliedUser: false } };
}
export function editReply(container: ContainerBuilder): InteractionEditReplyOptions {
  return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [], repliedUser: false } };
}
