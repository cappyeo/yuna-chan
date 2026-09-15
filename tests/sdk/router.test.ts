import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageFlags, type Interaction } from 'discord.js';
import { parseConfig } from '../../src/core/config.ts';
import type { SettingsStore } from '../../src/db/settings.ts';
import type { BotModule } from '../../src/discord/module.ts';
import { createRegistry } from '../../src/discord/registry.ts';
import { createRouter } from '../../src/discord/router.ts';
import { panel } from '../../src/discord/ui.ts';

const guildId = '123456789012345679';
const config = parseConfig({
  DISCORD_TOKEN: 'test-only-not-a-real-token',
  DISCORD_APPLICATION_ID: '123456789012345678',
  DISCORD_GUILD_IDS: guildId,
  DATABASE_URL: 'postgresql://test:secret@localhost/yuna_test',
});
const settings: SettingsStore = {
  async getLocale() { throw new Error('Unexpected database access'); },
  async setLocale() { throw new Error('Unexpected database access'); },
};
function fixture(options: { guildId?: string | null; permissions?: bigint; manual?: boolean; fail?: boolean } = {}) {
  const calls: string[] = [];
  const payloads: unknown[] = [];
  const interaction = {
    guildId: options.guildId === undefined ? guildId : options.guildId,
    locale: 'en-US', user: { id: '223456789012345678' },
    memberPermissions: { bitfield: options.permissions ?? 32n },
    appPermissions: { bitfield: 0n },
    customId: 'y1:test:click', deferred: false, replied: false,
    isChatInputCommand: () => false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    async deferReply(payload: unknown) { calls.push('defer'); payloads.push(payload); this.deferred = true; },
    async reply(payload: unknown) { calls.push('reply'); payloads.push(payload); this.replied = true; },
    async editReply(payload: unknown) { calls.push('edit'); payloads.push(payload); this.replied = true; },
    async followUp(payload: unknown) { calls.push('followup'); payloads.push(payload); },
  };
  const module: BotModule = {
    id: 'test', buttons: [{
      action: 'click', userPermissions: 32n, botPermissions: 0n,
      acknowledgement: options.manual ? 'manual' : 'private',
      async execute(_interaction, context) {
        calls.push('execute');
        assert.equal(context.guildId, guildId);
        assert.equal(context.locale, 'en');
        if (options.fail) throw new Error('private-token-value');
        await context.respond(panel('Test', 'Response'));
      },
    }],
  };
  const logs: unknown[] = [];
  const router = createRouter(config, createRegistry([module]), settings, (_level, fields) => { logs.push(fields); });
  const run = () => router(interaction as unknown as Interaction);
  return { calls, payloads, logs, run, interaction };
}
test('router acknowledges before handler execution and edits with V2', async () => {
  const f = fixture(); await f.run();
  assert.deepEqual(f.calls, ['defer', 'execute', 'edit']);
  assert.deepEqual(f.payloads[0], { flags: MessageFlags.Ephemeral });
  assert.equal((f.payloads[1] as { flags: number }).flags, MessageFlags.IsComponentsV2);
});
test('router refuses DMs and unapproved servers before execution', async () => {
  for (const id of [null, '123456789012345680']) {
    const f = fixture({ guildId: id }); await f.run(); assert.deepEqual(f.calls, ['reply']);
  }
});
test('router rechecks component permissions', async () => {
  const f = fixture({ permissions: 0n }); await f.run(); assert.deepEqual(f.calls, ['reply']);
});
test('router rejects unknown component routes', async () => {
  const f = fixture(); f.interaction.customId = 'y1:test:missing';
  await f.run(); assert.deepEqual(f.calls, ['reply']);
});
test('manual acknowledgement is not deferred by the router', async () => {
  const f = fixture({ manual: true }); await f.run(); assert.deepEqual(f.calls, ['execute', 'reply']);
});
test('handler failures are redacted and return a correlation reference', async () => {
  const f = fixture({ fail: true }); await f.run();
  assert.deepEqual(f.calls, ['defer', 'execute', 'edit']);
  assert.ok(!JSON.stringify(f.logs).includes('private-token-value'));
  assert.ok(!JSON.stringify(f.payloads).includes('private-token-value'));
  assert.match(JSON.stringify(f.payloads), /Reference:/);
});
