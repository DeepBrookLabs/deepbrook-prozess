// node --test skills/projekt-anlegen/scripts/skills.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, installCommands } from './skills.mjs';

test('Konfiguration: 12 Skills von Matt fest gepinnt, vier aus dem Paket', () => {
  const [matt, paket] = loadConfig().sources;
  assert.equal(matt.source, 'mattpocock/skills');
  assert.match(matt.ref, /^[0-9a-f]{40}$/);
  assert.equal(matt.skills.length, 12);
  for (const s of ['grill-with-docs', 'to-spec', 'to-tickets', 'setup-matt-pocock-skills']) assert.ok(!matt.skills.includes(s), s);
  assert.equal(paket.source, 'DeepBrookLabs/deepbrook-prozess');
  assert.deepEqual(paket.skills, ['prozess', 'spec', 'spec-idee', 'to-tickets']);
});

test('Ein Aufruf je Quelle, mit ref nur wo gepinnt', () => {
  const cmds = installCommands({ sources: [
    { source: 'a/b', ref: 'abc', skills: ['x', 'y'] },
    { source: 'c/d', skills: ['z'] },
  ] });
  assert.deepEqual(cmds, [
    ['-y', 'skills', 'add', 'a/b#abc', '--skill', 'x', '--skill', 'y', '-a', 'claude-code', '-y'],
    ['-y', 'skills', 'add', 'c/d', '--skill', 'z', '-a', 'claude-code', '-y'],
  ]);
});
