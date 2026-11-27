// node --test skills/projekt-anlegen/scripts/bereich-umzug.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseZuordnung, planUmzug, formatUmzug, cardLabel } from './bereich-umzug.mjs';
import { parseBereich, assignColors } from './board.mjs';

const existing = [
  { id: 'c', name: 'Client', color: 'BLUE', description: 'Godot' },
  { id: 's', name: 'Server', color: 'PURPLE', description: 'Supabase' },
  { id: 'r', name: 'Regel-Modul', color: 'GREEN', description: 'rules/' },
  { id: 'a', name: 'Asset', color: 'ORANGE', description: 'Bilder' },
  { id: 'e', name: 'Entscheidung', color: 'YELLOW', description: 'ADR' },
  { id: 'sp', name: 'Spec', color: 'PINK', description: 'Spec-Issue' },
  { id: 'p', name: 'Prozess', color: 'GRAY', description: 'Paket' },
];

const spielSet = assignColors(
  [
    'Gameplay:GREEN:Spielregeln',
    'Oberfläche:BLUE:Menüs',
    'Grafik:ORANGE:Bilder',
    'Audio:ORANGE:Musik',
    'Inhalte:RED:Level',
    'Technik:GRAY:Werkzeuge',
    'Server:PURPLE:Online-Teil',
  ].map(parseBereich),
);
const zuordnungen = ['Client=Oberfläche', 'Regel-Modul=Gameplay', 'Asset=Grafik', 'Prozess=Technik'].map(parseZuordnung);

const items = [
  { id: 'i1', label: 'x#1 Login', bereich: 'Client' },
  { id: 'i2', label: 'x#2 Tabellen', bereich: 'Server' },
  { id: 'i3', label: 'x#3 Nachtangriff', bereich: 'Regel-Modul' },
  { id: 'i4', label: 'x#4 Icon', bereich: 'Asset' },
  { id: 'i5', label: 'x#5 Paket', bereich: 'Prozess' },
  { id: 'i6', label: 'x#6 Spec', bereich: 'Spec' },
  { id: 'i7', label: 'x#7 Ohne', bereich: null },
];

const plan = () => planUmzug({ existing, items, bereiche: spielSet, zuordnungen });

test('Zuordnung Alt=Neu', () => {
  assert.deepEqual(parseZuordnung(' Regel-Modul = Gameplay '), { from: 'Regel-Modul', to: 'Gameplay' });
  assert.throws(() => parseZuordnung('Client'), /Alt=Neu/);
  assert.throws(() => parseZuordnung('=X'), /Alt=Neu/);
});

test('Last Haven: jede Karte mit Bereich bekommt den neuen, Karten ohne bleiben leer', () => {
  const p = plan();
  assert.deepEqual(p.errors, []);
  assert.deepEqual(
    p.cards.map((c) => [c.id, c.from, c.to]),
    [
      ['i1', 'Client', 'Oberfläche'],
      ['i2', 'Server', 'Server'],
      ['i3', 'Regel-Modul', 'Gameplay'],
      ['i4', 'Asset', 'Grafik'],
      ['i5', 'Prozess', 'Technik'],
      ['i6', 'Spec', 'Spec'],
      ['i7', null, null],
    ],
  );
  assert.deepEqual(p.moves.map((c) => c.id), ['i1', 'i3', 'i4', 'i5']);
});

test('Endstand: genau das neue Set, vorhandene behalten ihre ID', () => {
  const p = plan();
  assert.deepEqual(
    p.finalOptions.map((o) => [o.id, o.name, o.color]),
    [
      ['sp', 'Spec', 'PINK'],
      ['e', 'Entscheidung', 'YELLOW'],
      [undefined, 'Gameplay', 'GREEN'],
      [undefined, 'Oberfläche', 'BLUE'],
      [undefined, 'Grafik', 'ORANGE'],
      [undefined, 'Audio', 'ORANGE'],
      [undefined, 'Inhalte', 'RED'],
      [undefined, 'Technik', 'GRAY'],
      ['s', 'Server', 'PURPLE'],
    ],
  );
  assert.equal(p.finalOptions.find((o) => o.name === 'Server').description, 'Online-Teil');
  assert.equal(p.finalOptions.find((o) => o.name === 'Spec').description, 'Spec-Issue');
  assert.deepEqual(p.removed, ['Client', 'Regel-Modul', 'Asset', 'Prozess']);
});

test('Zwischenstand behält die alten Optionen samt ID, bis die Karten umgesetzt sind', () => {
  const p = plan();
  const ids = p.interimOptions.filter((o) => o.id).map((o) => o.id).sort();
  assert.deepEqual(ids, existing.map((o) => o.id).sort());
  assert.equal(p.interimOptions.length, p.finalOptions.length + p.removed.length);
});

test('alter Bereich ohne Zuordnung bricht ab', () => {
  const p = planUmzug({ existing, items, bereiche: spielSet, zuordnungen: zuordnungen.slice(0, 3) });
  assert.match(p.errors.join('\n'), /Prozess fehlt im neuen Set und hat keine Zuordnung/);
  assert.equal(p.cards.find((c) => c.id === 'i5').to, null);
});

test('Zuordnung von einem unbekannten Bereich ist nur ein Hinweis, auf einen Bereich außerhalb des Sets bricht ab', () => {
  const p = planUmzug({ existing, items, bereiche: spielSet, zuordnungen: [...zuordnungen, parseZuordnung('Tippfehler=Grafik')] });
  assert.deepEqual(p.errors, []);
  assert.match(p.notes.join('\n'), /Tippfehler gibt es im Board nicht/);
  const q = planUmzug({ existing, items, bereiche: spielSet, zuordnungen: [...zuordnungen.slice(0, 3), parseZuordnung('Prozess=Werkzeug')] });
  assert.match(q.errors.join('\n'), /Werkzeug fehlt im neuen Set/);
});

test('ein bleibender Bereich darf nicht umgezogen werden', () => {
  const p = planUmzug({ existing, items, bereiche: spielSet, zuordnungen: [...zuordnungen, parseZuordnung('Server=Technik')] });
  assert.match(p.errors.join('\n'), /Server gehört zum neuen Set/);
});

test('Groß- und Kleinschreibung zählt nicht', () => {
  const p = planUmzug({ existing, items, bereiche: spielSet, zuordnungen: ['client=oberfläche', 'regel-modul=gameplay', 'asset=grafik', 'prozess=technik'].map(parseZuordnung) });
  assert.deepEqual(p.errors, []);
  assert.equal(p.cards.find((c) => c.id === 'i1').to, 'Oberfläche');
});

test('Trockenlauf listet jede Karte mit alter und neuer Zuordnung', () => {
  const lines = formatUmzug(plan(), { board: 'B', dryRun: true });
  const text = lines.join('\n');
  for (const c of items) assert.ok(text.includes(c.label), c.label);
  assert.match(text, /x#1 Login\s+Client → Oberfläche/);
  assert.match(text, /x#2 Tabellen\s+Server \(bleibt\)/);
  assert.match(text, /x#7 Ohne\s+ohne Bereich, bleibt so/);
  assert.match(text, /Würde 4 Karten umsetzen/);
  assert.match(text, /Würde danach entfernen: Client, Regel-Modul, Asset, Prozess/);
  assert.match(text, /Neue Bereiche: Gameplay, Oberfläche, Grafik, Audio, Inhalte, Technik/);
});

test('Kartennamen für Issue, Entwurf und archivierte Karte', () => {
  assert.equal(cardLabel({ id: 'x', content: { number: 4, title: 'T', repository: { nameWithOwner: 'o/r' } } }), 'o/r#4 T');
  assert.equal(cardLabel({ id: 'x', content: { title: 'Idee' } }), 'Entwurf: Idee');
  assert.equal(cardLabel({ id: 'x', isArchived: true, content: null }), 'Karte x (archiviert)');
});

test('zweiter Lauf nach dem Umzug: nichts zu tun, kein Fehler', () => {
  const p = plan();
  const after = p.finalOptions.map((o, i) => ({ ...o, id: o.id ?? `n${i}` }));
  const moved = p.cards.map((c) => ({ id: c.id, label: c.label, bereich: c.to }));
  const q = planUmzug({ existing: after, items: moved, bereiche: spielSet, zuordnungen });
  assert.deepEqual(q.errors, []);
  assert.equal(q.notes.length, 4);
  assert.deepEqual(q.moves, []);
  assert.deepEqual(q.removed, []);
  assert.deepEqual(q.added, []);
});

test('Hinweis auf archivierte Karten, wenn Bereiche entfallen', () => {
  assert.match(formatUmzug(plan(), { board: 'B', dryRun: true }).join('\n'), /Archivierte Karten/);
});
