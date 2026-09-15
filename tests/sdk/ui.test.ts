import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import { editReply, panel, privateReply } from '../../src/discord/ui.ts';
import { systemModule } from '../../src/modules/system/index.ts';
test('V2 UI never mixes legacy content/embeds with components', () => {
  const body = privateReply(panel('Title', 'Body'));
  assert.ok(!('content' in body)); assert.ok(!('embeds' in body));
  assert.equal(body.flags, MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
  assert.deepEqual(body.allowedMentions, { parse: [], repliedUser: false });
  assert.equal(editReply(panel('Title', 'Body')).flags, MessageFlags.IsComponentsV2);
});
test('only foundation commands are installed', () => {
  assert.deepEqual(systemModule.commands?.map((command) => command.data.toJSON().name), ['system', 'settings']);
});
