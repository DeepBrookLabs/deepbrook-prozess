#!/usr/bin/env node
// Ordnet die Karten eines bestehenden Boards einem neuen Bereich-Set zu.
//
//   node bereich-umzug.mjs --owner <Konto> --board <Nummer> --bereich <Bereich> [--bereich …]
//                          [--zuordnung <Alt>=<Neu> …] [--dry-run]
//
// --owner      Konto (Nutzer oder Org), dem das Board gehört
// --board      Nummer des Boards
// --bereich    das neue Set: "Name:FARBE:Wofür", einmal je Bereich (wie bei board.mjs).
//              Spec und Entscheidung bleiben immer; ein Bereich, den es schon gibt, behält seine Karten.
// --zuordnung  "Alt=Neu": Karten mit dem alten Bereich bekommen den neuen. Jeder alte Bereich,
//              der im neuen Set fehlt, braucht eine Zuordnung.
// --dry-run    listet jede Karte mit alter und neuer Zuordnung und ändert nichts
//
// Ablauf ohne --dry-run: neue Optionen anlegen, Karten umsetzen, prüfen, alte Optionen entfernen.
// Ein zweiter Lauf nach dem Umzug ändert nichts mehr.
//
// Archivierte Karten liefert die GitHub-API nicht (weder GraphQL noch REST). Sie werden nicht umgesetzt
// und verlieren einen entfallenen Bereich. Wer sie behalten will, holt sie vorher aus dem Archiv.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gh, graphql, updateOptions } from './gh.mjs';
import { parseBereich, assignColors } from './board.mjs';

const FIXED_BEREICHE = ['Spec', 'Entscheidung'];
const FIXED_COLORS = { spec: 'PINK', entscheidung: 'YELLOW' };
const FIELD = 'Bereich';
const key = (name) => name.toLowerCase();

export function parseZuordnung(spec) {
  const m = /^([^=]+)=([^=]+)$/.exec(spec ?? '');
  if (!m || !m[1].trim() || !m[2].trim()) throw new Error(`Zuordnung „${spec}“ hat nicht die Form Alt=Neu`);
  return { from: m[1].trim(), to: m[2].trim() };
}

// existing: Optionen des Feldes {id, name, color, description}
// items: Karten {id, label, bereich: Name oder null}
// bereiche: neues Set ohne Spec/Entscheidung, Farben bereits verteilt
// zuordnungen: [{from, to}]
export function planUmzug({ existing, items, bereiche, zuordnungen }) {
  const errors = [];
  const notes = [];
  const old = new Map(existing.map((o) => [key(o.name), o]));

  const wanted = [
    ...FIXED_BEREICHE.map((name) => ({ name, color: null, description: '' })),
    ...bereiche.filter((b) => !FIXED_BEREICHE.some((f) => key(f) === key(b.name))),
  ];
  const finalOptions = wanted.map((b) => {
    const prev = old.get(key(b.name));
    if (!prev) return { name: b.name, color: b.color ?? FIXED_COLORS[key(b.name)] ?? 'GRAY', description: b.description };
    return {
      id: prev.id,
      name: prev.name,
      color: b.color ?? prev.color,
      description: b.description || prev.description,
    };
  });
  const inNew = new Map(finalOptions.map((o) => [key(o.name), o.name]));

  const map = new Map();
  for (const z of zuordnungen) {
    if (!old.has(key(z.from))) notes.push(`Zuordnung ${z.from}=${z.to}: Bereich ${z.from} gibt es im Board nicht (schon umgezogen?)`);
    else if (inNew.has(key(z.from))) errors.push(`Zuordnung ${z.from}=${z.to}: ${z.from} gehört zum neuen Set und bleibt`);
    if (!inNew.has(key(z.to))) errors.push(`Zuordnung ${z.from}=${z.to}: ${z.to} fehlt im neuen Set`);
    if (map.has(key(z.from))) errors.push(`Bereich ${z.from} ist doppelt zugeordnet`);
    map.set(key(z.from), inNew.get(key(z.to)) ?? z.to);
  }

  const removed = existing.filter((o) => !inNew.has(key(o.name)));
  for (const o of removed) {
    if (!map.has(key(o.name))) errors.push(`Bereich ${o.name} fehlt im neuen Set und hat keine Zuordnung (--zuordnung ${o.name}=…)`);
  }

  const cards = items.map((item) => {
    if (!item.bereich) return { ...item, from: null, to: null };
    const to = map.get(key(item.bereich)) ?? inNew.get(key(item.bereich)) ?? null;
    return { ...item, from: item.bereich, to };
  });

  return {
    errors,
    notes,
    finalOptions,
    // Zwischenstand: neues Set plus die alten Optionen, die erst nach dem Umsetzen verschwinden
    interimOptions: [...finalOptions, ...removed.map(({ id, name, color, description }) => ({ id, name, color, description }))],
    added: finalOptions.filter((o) => !o.id).map((o) => o.name),
    kept: finalOptions.filter((o) => o.id).map((o) => o.name),
    removed: removed.map((o) => o.name),
    cards,
    moves: cards.filter((c) => c.from && c.to && key(c.from) !== key(c.to)),
  };
}

export function formatUmzug(plan, { board, dryRun }) {
  const w = dryRun ? 'Würde ' : '';
  const width = Math.max(0, ...plan.cards.map((c) => c.label.length));
  const lines = [
    `Board: ${board}`,
    `Neue Bereiche: ${plan.added.join(', ') || '–'}`,
    `Bleiben: ${plan.kept.join(', ') || '–'}`,
    `Entfallen: ${plan.removed.join(', ') || '–'}`,
    '',
    `Karten (${plan.cards.length}):`,
  ];
  for (const c of plan.cards) {
    let change;
    if (!c.from) change = 'ohne Bereich, bleibt so';
    else if (!c.to) change = `${c.from} → ?`;
    else if (key(c.from) === key(c.to)) change = `${c.from} (bleibt)`;
    else change = `${c.from} → ${c.to}`;
    lines.push(`  ${c.label.padEnd(width)}  ${change}`);
  }
  lines.push('', `${w}${plan.moves.length} Karten umsetzen`);
  if (plan.removed.length) {
    lines.push(`${w}danach entfernen: ${plan.removed.join(', ')}`);
    lines.push('Archivierte Karten fehlen in der Liste (die API liefert sie nicht) und verlieren einen entfallenen Bereich.');
  }
  return lines;
}

export function cardLabel(node) {
  const c = node.content;
  const archived = node.isArchived ? ' (archiviert)' : '';
  if (c?.number) return `${c.repository.nameWithOwner}#${c.number} ${c.title}${archived}`;
  if (c?.title) return `Entwurf: ${c.title}${archived}`;
  return `Karte ${node.id}${archived}`;
}

const FIELD_QUERY = `query($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      field(name: "${FIELD}") { ... on ProjectV2SingleSelectField { id name options { id name color description } } }
    }
  }
}`;

const ITEMS_QUERY = `query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isArchived
          fieldValueByName(name: "${FIELD}") { ... on ProjectV2ItemFieldSingleSelectValue { name optionId } }
          content {
            ... on Issue { number title repository { nameWithOwner } }
            ... on PullRequest { number title repository { nameWithOwner } }
            ... on DraftIssue { title }
          }
        }
      }
    }
  }
}`;

const SET_VALUE = `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) { clientMutationId }
}`;

function readField(projectId) {
  const field = graphql(FIELD_QUERY, { id: projectId }).node.field;
  if (!field?.options) throw new Error(`Feld ${FIELD} fehlt im Board oder ist keine Einfachauswahl`);
  return field;
}

function readItems(projectId) {
  const items = [];
  let after = null;
  do {
    const page = graphql(ITEMS_QUERY, { id: projectId, after }).node.items;
    for (const n of page.nodes) {
      items.push({ id: n.id, label: cardLabel(n), bereich: n.fieldValueByName?.name ?? null });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return items.sort((a, b) => a.label.localeCompare(b.label, 'de', { numeric: true }));
}

function parseArgs(argv) {
  const opts = { dryRun: false, owner: null, board: null, bereiche: [], zuordnungen: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--owner') opts.owner = argv[++i];
    else if (a === '--board') opts.board = argv[++i];
    else if (a === '--bereich') opts.bereiche.push(parseBereich(argv[++i] ?? ''));
    else if (a === '--zuordnung') opts.zuordnungen.push(parseZuordnung(argv[++i]));
    else throw new Error(`Unbekannte Option: ${a}`);
  }
  const usage = 'Aufruf: node bereich-umzug.mjs --owner <Konto> --board <Nummer> --bereich <Name:FARBE:Wofür> [--bereich …] [--zuordnung <Alt>=<Neu> …] [--dry-run]';
  if (!opts.owner || !/^\d+$/.test(opts.board ?? '') || !opts.bereiche.length) throw new Error(usage);
  opts.bereiche = assignColors(opts.bereiche);
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const project = JSON.parse(gh(['project', 'view', opts.board, '--owner', opts.owner, '--format', 'json']));
  const board = `${opts.owner} #${opts.board} „${project.title}“ ${project.url}`;

  const field = readField(project.id);
  const plan = planUmzug({ existing: field.options, items: readItems(project.id), bereiche: opts.bereiche, zuordnungen: opts.zuordnungen });
  console.log(opts.dryRun ? 'Trockenlauf' : 'Umzug');
  for (const line of formatUmzug(plan, { board, dryRun: opts.dryRun })) console.log(line);
  for (const n of plan.notes) console.log(`Hinweis: ${n}`);
  if (plan.errors.length) {
    for (const e of plan.errors) console.error(`Fehler: ${e}`);
    process.exit(1);
  }
  if (opts.dryRun) return;

  updateOptions(field.id, plan.interimOptions);
  const ids = new Map(readField(project.id).options.map((o) => [key(o.name), o.id]));
  for (const card of plan.moves) {
    graphql(SET_VALUE, {
      input: { projectId: project.id, itemId: card.id, fieldId: field.id, value: { singleSelectOptionId: ids.get(key(card.to)) } },
    });
  }
  console.log(`${plan.moves.length} Karten umgesetzt.`);

  const left = readItems(project.id).filter((i) => i.bereich && plan.removed.some((r) => key(r) === key(i.bereich)));
  if (left.length) {
    throw new Error(`Alte Bereiche nicht entfernt, weil Karten sie noch tragen:\n${left.map((i) => `  ${i.label}: ${i.bereich}`).join('\n')}`);
  }
  updateOptions(field.id, plan.finalOptions.map((o) => ({ ...o, id: o.id ?? ids.get(key(o.name)) })));
  if (plan.removed.length) console.log(`Entfernt: ${plan.removed.join(', ')}`);
  console.log('Fertig.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error((e.stderr || e.message || String(e)).toString().trim());
    process.exit(1);
  }
}
