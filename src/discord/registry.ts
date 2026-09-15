import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { componentId } from '../core/component-id.ts';
import type { BotModule, Command, Handler } from './module.ts';
export function createRegistry(modules: readonly BotModule[]) {
  const commands = new Map<string, Command>();
  const buttons = new Map<string, Handler<ButtonInteraction>>();
  const selects = new Map<string, Handler<StringSelectMenuInteraction>>();
  const modals = new Map<string, Handler<ModalSubmitInteraction>>();
  const moduleIds = new Set<string>();
  function insert<T>(map: Map<string, T>, key: string, value: T): void {
    if (map.has(key)) throw new Error(`Duplicate route: ${key}`);
    map.set(key, value);
  }
  for (const module of modules) {
    if (moduleIds.has(module.id)) throw new Error(`Duplicate module: ${module.id}`);
    componentId(module.id, 'validate');
    moduleIds.add(module.id);
    for (const command of module.commands ?? []) insert(commands, command.data.name, command);
    for (const handler of module.buttons ?? []) insert(buttons, componentId(module.id, handler.action), handler);
    for (const handler of module.selects ?? []) insert(selects, componentId(module.id, handler.action), handler);
    for (const handler of module.modals ?? []) insert(modals, componentId(module.id, handler.action), handler);
  }
  return { commands, buttons, selects, modals };
}
export type Registry = ReturnType<typeof createRegistry>;
