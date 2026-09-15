import { REST, Routes } from 'discord.js';
import { parseConfig } from '../core/config.ts';
import { createLogger, safeError } from '../core/log.ts';
import { createRegistry } from '../discord/registry.ts';
import { modules } from '../modules/index.ts';
const config = parseConfig(process.env);
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply' && !arg.startsWith('--guild='))) throw new Error('Unknown argument');
const selected = args.find((arg) => arg.startsWith('--guild='))?.slice('--guild='.length);
if (selected !== undefined && !config.guildIds.has(selected)) throw new Error('Selected guild is not allowlisted');
const guildIds = selected === undefined ? [...config.guildIds] : [selected];
const body = [...createRegistry(modules).commands.values()].map((command) => {
  const json = command.data.toJSON();
  // contexts and integration_types belong to global registration; these are guild commands.
  const { contexts: _contexts, integration_types: _integrationTypes, ...guildCommand } = json;
  return guildCommand;
});
console.log(JSON.stringify({ apply: args.includes('--apply'), guildIds, commands: body }, null, 2));
if (args.includes('--apply')) {
  const log = createLogger(config.logLevel);
  const rest = new REST({ version: '10', timeout: 10_000 }).setToken(config.token);
  try {
    for (const guildId of guildIds) {
      // Intentional bulk replacement for this application's commands in the chosen guild only.
      await rest.put(Routes.applicationGuildCommands(config.applicationId, guildId), { body });
    }
    console.log('Guild commands deployed.');
  } catch (error) {
    // Raw SDK errors may contain request/response data; never print them.
    log('error', { event: 'commands.deploy_failed', ...safeError(error) });
    process.exitCode = 1;
  }
} else console.log('Dry run only. Add --apply to replace the bot command set in these guilds.');
