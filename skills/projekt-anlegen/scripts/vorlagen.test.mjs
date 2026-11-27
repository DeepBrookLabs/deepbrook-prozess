// node --test skills/projekt-anlegen/scripts/vorlagen.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseProjektart,
  loadProjektart,
  selectBereiche,
  render,
  targetPath,
  planFiles,
  mergeGitignore,
  bereicheTable,
  boardArgs,
  applyPlan,
} from './vorlagen.mjs';

const spiel = `# Projektart Spiel

- **Nutzerbegriff:** Spieler
- **Assets-Spalte:** ja

## Bereiche

| Bereich | Farbe | Wofür | Nur wenn |
|---|---|---|---|
| Gameplay | GREEN | Spielregeln, Balance | |
| Server | PURPLE | Backend | Hat dein Spiel einen Online-Teil? |
`;

test('Projektart: Werte und Bereiche mit Frage', () => {
  const art = parseProjektart(spiel);
  assert.equal(art.nutzerbegriff, 'Spieler');
  assert.equal(art.assets, 'ja');
  assert.deepEqual(art.bereiche, [
    { name: 'Gameplay', color: 'GREEN', description: 'Spielregeln, Balance', frage: '' },
    { name: 'Server', color: 'PURPLE', description: 'Backend', frage: 'Hat dein Spiel einen Online-Teil?' },
  ]);
});

test('Projektart Spiel aus dem Paket hat das Spiel-Set der Spec', () => {
  const art = loadProjektart('spiel');
  assert.deepEqual(art.bereiche.map((b) => `${b.name}:${b.color}`), [
    'Gameplay:GREEN', 'Oberfläche:BLUE', 'Grafik:ORANGE', 'Audio:ORANGE', 'Inhalte:RED', 'Technik:GRAY', 'Server:PURPLE',
  ]);
  assert.equal(art.bereiche.find((b) => b.name === 'Server').frage, 'Hat dein Spiel einen Online-Teil?');
});

test('Unbekannte Projektart nennt die vorhandenen', () => {
  assert.throws(() => loadProjektart('web'), /spiel/);
});

test('Bereiche mit Frage nur bei Ja', () => {
  const art = parseProjektart(spiel);
  assert.deepEqual(selectBereiche(art.bereiche, []).map((b) => b.name), ['Gameplay']);
  assert.deepEqual(selectBereiche(art.bereiche, ['server']).map((b) => b.name), ['Gameplay', 'Server']);
  assert.throws(() => selectBereiche(art.bereiche, ['Gameplay']), /keine Frage/);
});

test('Platzhalter werden ersetzt, unbekannte bleiben stehen', () => {
  assert.equal(render('{{name}} und {{name}}, {{x}}', { name: 'A' }), 'A und A, {{x}}');
});

test('Zielpfade: gitignore und github bekommen den Punkt', () => {
  assert.equal(targetPath('gitignore'), '.gitignore');
  assert.equal(targetPath('github/ISSUE_TEMPLATE/spec.md'), path.join('.github', 'ISSUE_TEMPLATE', 'spec.md'));
  assert.equal(targetPath('docs/specs/README.md'), path.join('docs', 'specs', 'README.md'));
});

test('Dateiplan: vorhandene Dateien bleiben, .gitignore wird ergänzt', () => {
  const files = ['CLAUDE.md', 'README.md', 'gitignore'];
  const existing = { 'CLAUDE.md': '# alt', '.gitignore': 'node_modules/\n' };
  const plan = planFiles(files, (p) => existing[p.split(path.sep).join('/')]);
  assert.deepEqual(plan.map((f) => [f.dest, f.action]), [
    ['CLAUDE.md', 'vorhanden'],
    ['README.md', 'anlegen'],
    ['.gitignore', 'ergänzen'],
  ]);
});

test('Dateiplan: .gitignore mit inbox/ bleibt', () => {
  const plan = planFiles(['gitignore'], () => 'inbox/\n');
  assert.equal(plan[0].action, 'vorhanden');
});

test('.gitignore ergänzen hängt inbox/ an', () => {
  assert.equal(mergeGitignore('node_modules/'), 'node_modules/\n\n# Ablage des Nutzers, siehe Skill prozess\ninbox/\n');
  assert.equal(mergeGitignore('a\ninbox/\n'), 'a\ninbox/\n');
  assert.equal(mergeGitignore('a\n/inbox\n'), 'a\n/inbox\n');
});

test('Bereiche-Tabelle beginnt mit Spec und Entscheidung', () => {
  const rows = bereicheTable([{ name: 'Gameplay', description: 'Regeln' }]);
  assert.equal(rows, [
    '| Spec | Spec-Issue mit seinen Tickets als Sub-Issues |',
    '| Entscheidung | ADR, Recherche |',
    '| Gameplay | Regeln |',
  ].join('\n'));
});

test('Board-Argumente für board.mjs', () => {
  const args = boardArgs({ repo: 'o/r', assets: 'ja', bereiche: [
    { name: 'Gameplay', color: 'GREEN', description: 'Regeln, Balance' },
    { name: 'Eigenes', color: '', description: '' },
  ] });
  assert.deepEqual(args, ['--repo', 'o/r', '--assets', 'ja', '--bereich', 'Gameplay:GREEN:Regeln, Balance', '--bereich', 'Eigenes']);
});

test('Lauf schreibt die Dateien mit Werten und lässt vorhandene stehen', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vorlagen-'));
  writeFileSync(path.join(dir, 'CLAUDE.md'), '# alt');
  const plan = planFiles(['CLAUDE.md', 'docs/agents/prozess.md', 'gitignore', 'github/ISSUE_TEMPLATE/spec.md'],
    (p) => (existsSync(path.join(dir, p)) ? readFileSync(path.join(dir, p), 'utf8') : undefined));
  const sources = {
    'CLAUDE.md': 'neu {{name}}',
    'docs/agents/prozess.md': 'Begriff {{nutzerbegriff}}\n{{bereiche}}',
    gitignore: 'inbox/\n',
    'github/ISSUE_TEMPLATE/spec.md': 'Repo {{repo}}',
  };
  applyPlan(plan, { dir, read: (src) => sources[src], values: { name: 'X', nutzerbegriff: 'Spieler', bereiche: '| a | b |', repo: 'o/r' } });
  assert.equal(readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), '# alt');
  assert.equal(readFileSync(path.join(dir, 'docs/agents/prozess.md'), 'utf8'), 'Begriff Spieler\n| a | b |');
  assert.equal(readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'inbox/\n');
  assert.equal(readFileSync(path.join(dir, '.github/ISSUE_TEMPLATE/spec.md'), 'utf8'), 'Repo o/r');
  assert.ok(existsSync(path.join(dir, 'inbox')));
});

test('Dateiplan: vorhandene Dateien nur mit Zustimmung überschreiben oder ergänzen', () => {
  const existing = { 'CLAUDE.md': '# alt', 'README.md': '# Readme', 'GLOSSARY.md': '# G' };
  const plan = planFiles(['CLAUDE.md', 'GLOSSARY.md', 'README.md'], (p) => existing[p],
    { ueberschreiben: ['README.md'], ergaenzen: ['CLAUDE.md'] });
  assert.deepEqual(plan.map((f) => [f.dest, f.action]), [
    ['CLAUDE.md', 'ergänzen'],
    ['GLOSSARY.md', 'vorhanden'],
    ['README.md', 'überschreiben'],
  ]);
});

test('Dateiplan: Zustimmung nur für vorhandene Vorlagen-Dateien', () => {
  const read = (p) => (p === 'CLAUDE.md' ? '# alt' : undefined);
  assert.throws(() => planFiles(['CLAUDE.md', 'README.md'], read, { ueberschreiben: ['README.md'] }), /README\.md.*nicht vorhanden/);
  assert.throws(() => planFiles(['CLAUDE.md'], read, { ergaenzen: ['foo.md'] }), /foo\.md.*keine Vorlage/);
  assert.throws(() => planFiles(['CLAUDE.md'], read, { ergaenzen: ['CLAUDE.md'], ueberschreiben: ['CLAUDE.md'] }), /CLAUDE\.md.*beides/);
});

test('Lauf überschreibt und ergänzt nur die freigegebenen Dateien', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vorlagen-'));
  writeFileSync(path.join(dir, 'CLAUDE.md'), '# alt\n');
  writeFileSync(path.join(dir, 'README.md'), '# Readme alt');
  writeFileSync(path.join(dir, 'GLOSSARY.md'), '# G alt');
  const read = (p) => (existsSync(path.join(dir, p)) ? readFileSync(path.join(dir, p), 'utf8') : undefined);
  const plan = planFiles(['CLAUDE.md', 'GLOSSARY.md', 'README.md'], read, { ueberschreiben: ['README.md'], ergaenzen: ['CLAUDE.md'] });
  const sources = { 'CLAUDE.md': '# Prozess {{name}}\n', 'README.md': '# {{name}}', 'GLOSSARY.md': '# neu' };
  applyPlan(plan, { dir, read: (src) => sources[src], values: { name: 'X' } });
  assert.equal(read('CLAUDE.md'), '# alt\n\n# Prozess X\n');
  assert.equal(read('README.md'), '# X');
  assert.equal(read('GLOSSARY.md'), '# G alt');
});
