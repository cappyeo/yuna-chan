import type { BotModule } from '../discord/module.ts';
import { systemModule } from './system/index.ts';
/** Explicit registration: importing a new file must never silently enable a feature. */
export const modules: readonly BotModule[] = [systemModule];
