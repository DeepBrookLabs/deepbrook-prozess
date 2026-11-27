#!/usr/bin/env node
// Legt das Kanban-Board eines Projekts aus dem Vorlage-Board an.
//
//   node board.mjs --repo <owner>/<repo> --assets ja|nein --bereich <Bereich> [--bereich …]
//                  [--title <Titel>] [--dir <Projektordner>] [--dry-run]
//
// --repo      Repo, mit dem das Board verknüpft wird; das Board entsteht im selben Konto (Nutzer oder Org)
// --assets    ja: Spalte Assets bleibt; nein: sie wird entfernt
// --bereich   "Name:FARBE:Wofür", einmal je Bereich der Projektart; Farbe und Wofür dürfen fehlen
//             ("Name" oder "Name::Wofür"), dann verteilt das Skript die freien Farben der Reihe nach.
//             Spec und Entscheidung bringt die Vorlage mit.
// --title     Titel des Boards, Standard: Name des Repos
// --dir       Projektordner, in dessen docs/agents/issue-tracker.md die IDs kommen; Standard: aktueller Ordner
// --dry-run   gibt nur aus, was passieren würde, und ändert nichts
//
// --neues-board  legt ein Board an, obwohl mit dem Repo schon eines verknüpft ist; nur nach Rückfrage
//
// Gibt es im Zielkonto schon ein Board mit dem Titel, bricht das Skript ab; ebenso, wenn mit dem Repo
// schon ein Board verknüpft ist und --neues-board fehlt.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gh, graphql, updateOptions } from './gh.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export const COLORS = ['GRAY', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'PINK', 'PURPLE'];
// PINK und YELLOW gehören Spec und Entscheidung; die übrigen werden der Reihe nach verteilt.
export const FREE_COLORS = ['GREEN', 'BLUE', 'ORANGE', 'RED', 'PURPLE', 'GRAY'];
const FIXED_BEREICHE = ['Spec', 'Entscheidung'];
const REQUIRED_WORKFLOWS = ['Item closed', 'Pull request merged'];

export function loadTemplate() {
  return JSON.parse(readFileSync(path.join(here, 'board.json'), 'utf8')).template;
}

// "🔨 In Arbeit" → "In Arbeit"
export const plainName = (name) => name.replace(/^[^\p{L}\p{N}]+/u, '');

export function parseBereich(spec) {
  const [name, color = '', ...rest] = spec.split(':');
  const want = color.trim().toUpperCase();
  if (!name.trim()) throw new Error(`Bereich ohne Namen: „${spec}“`);
  if (want && !COLORS.includes(want)) throw new Error(`Unbekannte Farbe „${color}“ bei Bereich ${name}; erlaubt: ${COLORS.join(', ')}`);
  return { name: name.trim(), color: want || null, description: rest.join(':').trim() };
}

// Bereiche ohne Farbe bekommen zuerst die noch unbenutzten freien Farben, danach geht es von vorn los.
export function assignColors(bereiche) {
  const used = new Set(bereiche.map((b) => b.color).filter(Boolean));
  const queue = [...FREE_COLORS.filter((c) => !used.has(c))];
  let cycle = 0;
  return bereiche.map((b) => {
    if (b.color) return b;
    const color = queue.length ? queue.shift() : FREE_COLORS[cycle++ % FREE_COLORS.length];
    return { ...b, color };
  });
}

const isFixed = (name) => FIXED_BEREICHE.some((f) => f.toLowerCase() === name.toLowerCase());

// Optionen des Feldes Bereich: die vorhandenen (Spec, Entscheidung) mit ihren IDs, dahinter die neuen.
export function bereichOptionsFor(existing, bereiche) {
  const known = new Set(existing.map((o) => o.name.toLowerCase()));
  const added = bereiche
    .filter((b) => !isFixed(b.name) && !known.has(b.name.toLowerCase()))
    .map((b) => ({ name: b.name, color: b.color, description: b.description }));
  return [...existing.map(({ id, name, color, description }) => ({ id, name, color, description })), ...added];
}

// Optionen des Feldes Status ohne Assets; null, wenn nichts zu ändern ist.
export function statusOptionsFor(existing, assets) {
  if (assets) return null;
  return existing
    .filter((o) => plainName(o.name) !== 'Assets')
    .map(({ id, name, color, description }) => ({ id, name, color, description }));
}

export function planBoard({ repo, title, assets, bereiche, template, target }) {
  const owner = repo.split('/')[0];
  return {
    source: template,
    owner,
    repo,
    title,
    assets,
    bereiche: [
      { name: 'Spec', color: 'PINK' },
      { name: 'Entscheidung', color: 'YELLOW' },
      ...bereiche.filter((b) => !isFixed(b.name)),
    ],
    target,
  };
}

export function formatPlan(plan, { dryRun }) {
  const w = dryRun ? 'Würde ' : '';
  return [
    `Quelle: ${plan.source.owner}, Board ${plan.source.number}`,
    `Zielkonto: ${plan.owner}`,
    `Titel: ${plan.title}`,
    `Spalten: ${plan.assets ? 'mit Assets' : 'ohne Assets'}`,
    `Bereiche: ${plan.bereiche.map((b) => `${b.name} (${b.color})`).join(', ')}`,
    `${w}kopieren: Vorlage → ${plan.owner} „${plan.title}“`,
    `${w}verknüpfen mit ${plan.repo}`,
    ...(plan.assets ? [] : [`${w}Spalte Assets entfernen`]),
    `${w}Bereiche setzen`,
    `${w}IDs schreiben nach ${plan.target}`,
  ];
}

export function renderProjektwerte({ repo, board, status, bereich }) {
  const opts = (options) => options.map((o) => `${plainName(o.name)} \`${o.id}\``).join(', ');
  return [
    '## Projektwerte',
    '',
    `- **Repo:** \`${repo}\``,
    `- **Board:** Nummer \`${board.number}\`, Besitzer \`${board.owner}\`, ${board.url}`,
    `- **Board-ID:** \`${board.id}\``,
    `- **Feld Status:** \`${status.id}\`. Optionen: ${opts(status.options)}`,
    `- **Feld Bereich:** \`${bereich.id}\`. Optionen: ${opts(bereich.options)}`,
    '',
  ].join('\n');
}

// Ersetzt den Abschnitt „## Projektwerte“ bis zur nächsten Überschrift derselben Ebene oder hängt ihn an.
export function replaceProjektwerte(content, section) {
  if (!content.trim()) return `# Issue tracker: GitHub\n\n${section}`;
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Projektwerte');
  if (start === -1) return `${content.replace(/\n*$/, '')}\n\n${section}`;
  let end = lines.findIndex((l, i) => i > start && /^##?\s/.test(l));
  if (end === -1) end = lines.length;
  const before = lines.slice(0, start).join('\n');
  const after = lines.slice(end).join('\n');
  return `${before}${before ? '\n' : ''}${section}${after ? `\n${after}` : ''}`;
}

const FIELDS_QUERY = `query($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      workflows(first: 20) { nodes { name enabled } }
      fields(first: 50) {
        nodes { ... on ProjectV2SingleSelectField { id name options { id name color description } } }
      }
    }
  }
}`;

// Vorhandene Boards: gleicher Titel im Konto stoppt immer; ein schon mit dem Repo verknüpftes Board
// stoppt, bis der Nutzer zugestimmt hat, trotzdem ein neues anzulegen (--neues-board).
export function checkExisting({ owner, title, sameTitle, linked, neu }) {
  if (sameTitle) return `Im Konto ${owner} gibt es schon ein Board „${title}“: ${sameTitle.url}. Anderen Titel mit --title wählen oder das vorhandene Board verwenden.`;
  if (linked.length && !neu) {
    const list = linked.map((b) => `${b.title} (${b.url})`).join(', ');
    return `Mit dem Repo ist schon ein Board verknüpft: ${list}. Frag den Nutzer, ob trotzdem ein neues angelegt werden soll; nur dann mit --neues-board starten.`;
  }
  return null;
}

function linkedBoards(repo) {
  const [owner, name] = repo.split('/');
  try {
    const data = graphql(`query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { projectsV2(first: 50) { nodes { title url closed } } } }`, { owner, name });
    return data.repository.projectsV2.nodes.filter((b) => !b.closed);
  } catch {
    return []; // Repo gibt es noch nicht
  }
}

function readBoard(projectId) {
  const node = graphql(FIELDS_QUERY, { id: projectId }).node;
  const field = (name) => {
    const f = node.fields.nodes.find((n) => n.name === name);
    if (!f) throw new Error(`Feld ${name} fehlt im Board`);
    return f;
  };
  return { status: field('Status'), bereich: field('Bereich'), workflows: node.workflows.nodes };
}

function parseArgs(argv) {
  const opts = { dryRun: false, neu: false, repo: null, assets: null, bereiche: [], title: null, dir: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--assets') opts.assets = argv[++i];
    else if (a === '--bereich') opts.bereiche.push(parseBereich(argv[++i] ?? ''));
    else if (a === '--neues-board') opts.neu = true;
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--dir') opts.dir = argv[++i];
    else throw new Error(`Unbekannte Option: ${a}`);
  }
  const usage = 'Aufruf: node board.mjs --repo <owner>/<repo> --assets ja|nein --bereich <Name:FARBE:Wofür> [--bereich …] [--title <Titel>] [--neues-board] [--dir <Projektordner>] [--dry-run]';
  if (!opts.repo || !/^[^/\s]+\/[^/\s]+$/.test(opts.repo)) throw new Error(usage);
  if (!['ja', 'nein'].includes(opts.assets)) throw new Error(`--assets muss ja oder nein sein.\n${usage}`);
  opts.assets = opts.assets === 'ja';
  opts.title ??= opts.repo.split('/')[1];
  opts.bereiche = assignColors(opts.bereiche);
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { repo, title, assets, bereiche, dryRun } = opts;
  const template = loadTemplate();
  const target = path.join(opts.dir, 'docs', 'agents', 'issue-tracker.md');
  const plan = planBoard({ repo, title, assets, bereiche, template, target });
  console.log(`${dryRun ? 'Trockenlauf' : 'Lauf'} für ${repo}`);
  for (const line of formatPlan(plan, { dryRun })) console.log(`- ${line}`);

  const existing = JSON.parse(gh(['project', 'list', '--owner', plan.owner, '--format', 'json', '-L', '500']));
  const stop = checkExisting({
    owner: plan.owner, title, neu: opts.neu,
    sameTitle: existing.projects.find((p) => p.title === title),
    linked: linkedBoards(repo),
  });
  if (stop) {
    console.error(stop);
    process.exit(1);
  }
  if (dryRun) return;

  const board = JSON.parse(gh([
    'project', 'copy', String(template.number),
    '--source-owner', template.owner, '--target-owner', plan.owner, '--title', title, '--format', 'json',
  ]));
  console.log(`Board angelegt: ${board.url}`);
  gh(['project', 'link', String(board.number), '--owner', plan.owner, '--repo', repo]);

  let fields = readBoard(board.id);
  const status = statusOptionsFor(fields.status.options, assets);
  if (status) updateOptions(fields.status.id, status);
  updateOptions(fields.bereich.id, bereichOptionsFor(fields.bereich.options, plan.bereiche));
  fields = readBoard(board.id);

  const off = REQUIRED_WORKFLOWS.filter((name) => !fields.workflows.some((w) => w.name === name && w.enabled));
  if (off.length) {
    console.warn(`Achtung: Automatik ${off.join(' und ')} ist aus. Im Board unter Workflows einschalten: ${board.url}/workflows`);
  }

  const section = renderProjektwerte({
    repo,
    board: { number: board.number, owner: plan.owner, url: board.url, id: board.id },
    status: fields.status,
    bereich: fields.bereich,
  });
  mkdirSync(path.dirname(target), { recursive: true });
  const before = existsSync(target) ? readFileSync(target, 'utf8') : '';
  writeFileSync(target, replaceProjektwerte(before, section));
  console.log(`IDs geschrieben nach ${target}`);
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
