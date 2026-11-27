// node --test skills/projekt-anlegen/scripts/board.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBereich,
  assignColors,
  planBoard,
  formatPlan,
  statusOptionsFor,
  bereichOptionsFor,
  plainName,
  checkExisting,
  renderProjektwerte,
  replaceProjektwerte,
} from './board.mjs';

const template = {
  status: [
    { id: 's1', name: '📜 Specs', color: 'PINK', description: 'a' },
    { id: 's2', name: '📥 Backlog', color: 'GRAY', description: 'b' },
    { id: 's3', name: '🎨 Assets', color: 'ORANGE', description: 'c' },
    { id: 's4', name: '🚦 Bereit', color: 'BLUE', description: 'd' },
    { id: 's5', name: '🔨 In Arbeit', color: 'YELLOW', description: 'e' },
    { id: 's6', name: '👀 Review', color: 'PURPLE', description: 'f' },
    { id: 's7', name: '✅ Erledigt', color: 'GREEN', description: 'g' },
  ],
  bereich: [
    { id: 'b1', name: 'Spec', color: 'PINK', description: 'Übergeordnetes Issue einer Spec' },
    { id: 'b2', name: 'Entscheidung', color: 'YELLOW', description: 'ADR, Recherche' },
  ],
};

test('Bereich mit Farbe und Zweck', () => {
  assert.deepEqual(parseBereich('Gameplay:green:Spielregeln, Spiellogik'), {
    name: 'Gameplay',
    color: 'GREEN',
    description: 'Spielregeln, Spiellogik',
  });
});

test('Bereich nur mit Namen oder mit leerer Farbe', () => {
  assert.deepEqual(parseBereich('Backend'), { name: 'Backend', color: null, description: '' });
  assert.deepEqual(parseBereich('Backend::API'), { name: 'Backend', color: null, description: 'API' });
});

test('unbekannte Farbe wird abgelehnt', () => {
  assert.throws(() => parseBereich('X:TÜRKIS'), /Farbe/);
});

test('Anderes: freie Farben der Reihe nach, erst unbenutzte, dann von vorn', () => {
  const colored = assignColors(['A', 'B:GREEN', 'C', 'D', 'E', 'F', 'G', 'H'].map(parseBereich));
  assert.deepEqual(
    colored.map((b) => b.color),
    ['BLUE', 'GREEN', 'ORANGE', 'RED', 'PURPLE', 'GRAY', 'GREEN', 'BLUE'],
  );
});

test('Spec und Entscheidung bleiben fest und werden nicht doppelt angelegt', () => {
  const opts = bereichOptionsFor(template.bereich, assignColors([parseBereich('spec'), parseBereich('Technik:GRAY:Werkzeuge')]));
  assert.deepEqual(opts.map((o) => [o.id, o.name, o.color]), [
    ['b1', 'Spec', 'PINK'],
    ['b2', 'Entscheidung', 'YELLOW'],
    [undefined, 'Technik', 'GRAY'],
  ]);
});

test('Spalten ohne Assets behalten die IDs der übrigen', () => {
  const ohne = statusOptionsFor(template.status, false);
  assert.equal(ohne.length, 6);
  assert.ok(!ohne.some((o) => plainName(o.name) === 'Assets'));
  assert.deepEqual(ohne[0], template.status[0]);
  assert.equal(statusOptionsFor(template.status, true), null);
});

test('Spaltennamen ohne Emoji', () => {
  assert.equal(plainName('🔨 In Arbeit'), 'In Arbeit');
  assert.equal(plainName('Backlog'), 'Backlog');
});

test('Trockenlauf nennt Quelle, Zielkonto, Titel und Bereiche', () => {
  const plan = planBoard({
    repo: 'ich/spiel',
    title: 'Spiel',
    assets: false,
    bereiche: assignColors([parseBereich('Gameplay:GREEN:Regeln')]),
    template: { owner: 'DeepBrookLabs', number: 2 },
    target: 'docs/agents/issue-tracker.md',
  });
  const text = formatPlan(plan, { dryRun: true }).join('\n');
  assert.match(text, /Quelle: DeepBrookLabs, Board 2/);
  assert.match(text, /Zielkonto: ich/);
  assert.match(text, /Titel: Spiel/);
  assert.match(text, /Spec \(PINK\), Entscheidung \(YELLOW\), Gameplay \(GREEN\)/);
  assert.match(text, /ohne Assets/);
  assert.match(text, /Würde kopieren/);
});

const values = {
  repo: 'ich/spiel',
  board: { number: 7, owner: 'ich', url: 'https://github.com/users/ich/projects/7', id: 'PVT_x' },
  status: { id: 'PVTSSF_s', options: template.status },
  bereich: { id: 'PVTSSF_b', options: template.bereich },
};

test('Projektwerte im Format der Projektkonfiguration', () => {
  const md = renderProjektwerte(values);
  assert.match(md, /^## Projektwerte\n/);
  assert.match(md, /- \*\*Repo:\*\* `ich\/spiel`/);
  assert.match(md, /- \*\*Board:\*\* Nummer `7`, Besitzer `ich`, https:\/\/github.com\/users\/ich\/projects\/7/);
  assert.match(md, /- \*\*Board-ID:\*\* `PVT_x`/);
  assert.match(md, /- \*\*Feld Status:\*\* `PVTSSF_s`\. Optionen: Specs `s1`, Backlog `s2`, Assets `s3`, Bereit `s4`/);
  assert.match(md, /- \*\*Feld Bereich:\*\* `PVTSSF_b`\. Optionen: Spec `b1`, Entscheidung `b2`\n$/);
});

test('Projektwerte ersetzen den alten Abschnitt und lassen den Rest stehen', () => {
  const alt = '# Issue tracker\n\nText\n\n## Projektwerte\n\n- alt\n\n## Danach\n\nbleibt\n';
  const neu = replaceProjektwerte(alt, '## Projektwerte\n\n- neu\n');
  assert.equal(neu, '# Issue tracker\n\nText\n\n## Projektwerte\n\n- neu\n\n## Danach\n\nbleibt\n');
});

test('Projektwerte werden angehängt, wenn der Abschnitt fehlt', () => {
  assert.equal(replaceProjektwerte('# Issue tracker\n\nText\n', '## Projektwerte\n\n- neu\n'), '# Issue tracker\n\nText\n\n## Projektwerte\n\n- neu\n');
  assert.equal(replaceProjektwerte('', '## Projektwerte\n'), '# Issue tracker: GitHub\n\n## Projektwerte\n');
});

test('Vorhandenes Board mit gleichem Titel stoppt immer', () => {
  const msg = checkExisting({ owner: 'o', title: 'r', sameTitle: { url: 'u1' }, linked: [], neu: true });
  assert.match(msg, /schon ein Board „r“: u1/);
});

test('Mit dem Repo verknüpftes Board stoppt, bis der Nutzer ein neues will', () => {
  const linked = [{ title: 'Alt', url: 'u2' }];
  assert.match(checkExisting({ owner: 'o', title: 'r', linked, neu: false }), /verknüpft.*Alt \(u2\).*--neues-board/s);
  assert.equal(checkExisting({ owner: 'o', title: 'r', linked, neu: true }), null);
  assert.equal(checkExisting({ owner: 'o', title: 'r', linked: [], neu: false }), null);
});
