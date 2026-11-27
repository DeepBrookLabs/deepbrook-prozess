// node --test skills/projekt-anlegen/scripts/labels.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLabels, formatPlan, loadConfig } from './labels.mjs';

const config = loadConfig();

test('Konfiguration enthält die zehn Labels', () => {
  assert.equal(config.labels.length, 10);
});

test('Phasen-Labels der Spec sortieren absteigend in Phasenfolge (Stand oben)', () => {
  const phasen = ['ready-to-grill', 'ready-to-slice', 'sliced'];
  for (const name of phasen) assert.ok(config.labels.some((l) => l.name === name), name);
  assert.deepEqual([...phasen].sort().reverse(), ['sliced', 'ready-to-slice', 'ready-to-grill']);
});

test('leeres Repo: alle zehn anlegen, nichts ändern oder entfernen', () => {
  const plan = planLabels([], config);
  assert.equal(plan.create.length, 10);
  assert.deepEqual(plan.update, []);
  assert.deepEqual(plan.remove, []);
});

test('aktuelles Repo: nichts zu tun (zweiter Lauf ändert nichts)', () => {
  const existing = config.labels.map((l) => ({ ...l, color: l.color.toUpperCase() }));
  const plan = planLabels(existing, config);
  assert.deepEqual([plan.create, plan.update, plan.remove], [[], [], []]);
  assert.deepEqual(formatPlan(plan, { dryRun: true }), ['Labels sind aktuell, nichts zu tun.']);
});

test('GitHub-Standard: bug wird angeglichen, documentation nur nach Rückfrage entfernt', () => {
  const existing = [
    { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
    { name: 'documentation', color: '0075ca', description: 'Improvements or additions to documentation' },
    { name: 'eigenes', color: '000000', description: 'bleibt' },
  ];
  const ohne = planLabels(existing, config);
  assert.deepEqual(ohne.update.map((u) => u.current), ['bug']);
  assert.deepEqual(ohne.removable, ['documentation']);
  assert.deepEqual(ohne.remove, []);
  const mit = planLabels(existing, config, { removeDefaults: true });
  assert.deepEqual(mit.remove, ['documentation']);
});

test('Groß-/Kleinschreibung im Namen wird angeglichen statt doppelt angelegt', () => {
  const want = config.labels.find((l) => l.name === 'wontfix');
  const plan = planLabels([{ ...want, name: 'Wontfix' }], config);
  assert.ok(!plan.create.some((l) => l.name === 'wontfix'));
  assert.equal(plan.update[0].current, 'Wontfix');
});

test('Trockenlauf-Ausgabe nennt jede Aktion', () => {
  const existing = [{ name: 'question', color: 'd876e3', description: '' }];
  const lines = formatPlan(planLabels(existing, config), { dryRun: true, removeDefaults: false });
  assert.ok(lines.some((l) => l.startsWith('Würde anlegen: ready-for-agent')));
  assert.ok(lines.some((l) => l.includes('Entfernbar nach Rückfrage') && l.includes('question')));
});
