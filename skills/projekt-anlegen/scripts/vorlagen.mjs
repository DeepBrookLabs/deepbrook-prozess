#!/usr/bin/env node
// Kopiert die Projektvorlagen in einen Projektordner und schreibt docs/agents/prozess.md.
//
//   node vorlagen.mjs --repo <owner>/<repo> --name <Name> --vision <Text> --projektart spiel [--ja <Bereich> …]
//                     [--dir <Projektordner>] [--dry-run]
//   node vorlagen.mjs … --projektart anderes --nutzerbegriff <Wort> --assets ja|nein --bereich <Bereich> […]
//
// --projektart    Datei unter vorlagen/projektarten/ (ohne .md) oder „anderes“
// --ja            Bereich der Projektart, dessen Frage („Nur wenn“) der Nutzer mit Ja beantwortet hat
// --nutzerbegriff, --assets, --bereich  nur bei „anderes“; --bereich wie bei board.mjs ("Name:FARBE:Wofür")
// --dir           Projektordner, Standard: aktueller Ordner
// --dry-run       gibt nur aus, was passieren würde, und ändert nichts
//
// Vorhandene Dateien bleiben unverändert und werden als „vorhanden“ gemeldet; nur in eine vorhandene
// .gitignore wird inbox/ ergänzt. Am Ende stehen die Argumente für board.mjs.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseBereich, assignColors } from './board.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const VORLAGEN = path.join(here, '..', 'vorlagen');
const PROJEKT = path.join(VORLAGEN, 'projekt');
const PROJEKTARTEN = path.join(VORLAGEN, 'projektarten');

const FIXED = [
  { name: 'Spec', description: 'Spec-Issue mit seinen Tickets als Sub-Issues' },
  { name: 'Entscheidung', description: 'ADR, Recherche' },
];
const INBOX_BLOCK = '# Ablage des Nutzers, siehe Skill prozess\ninbox/\n';

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function parseProjektart(md) {
  const value = (label) => md.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`))?.[1].trim();
  const section = md.split(/^## Bereiche\s*$/m)[1] ?? '';
  const rows = section.split('\n').filter((l) => l.trim().startsWith('|')).slice(2);
  return {
    nutzerbegriff: value('Nutzerbegriff'),
    assets: value('Assets-Spalte'),
    bereiche: rows.map((row) => {
      const [name, color, description, frage = ''] = cells(row);
      return { name, color, description, frage };
    }),
  };
}

export function projektarten() {
  return readdirSync(PROJEKTARTEN).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
}

export function loadProjektart(art) {
  const file = path.join(PROJEKTARTEN, `${art}.md`);
  if (!existsSync(file)) throw new Error(`Unbekannte Projektart „${art}“; vorhanden: ${projektarten().join(', ')} oder anderes`);
  return parseProjektart(readFileSync(file, 'utf8'));
}

// Bereiche ohne Frage immer, mit Frage nur, wenn der Nutzer sie mit Ja beantwortet hat.
export function selectBereiche(bereiche, ja) {
  const yes = new Set(ja.map((n) => n.toLowerCase()));
  for (const name of yes) {
    const b = bereiche.find((x) => x.name.toLowerCase() === name);
    if (!b) throw new Error(`--ja ${name}: diesen Bereich hat die Projektart nicht`);
    if (!b.frage) throw new Error(`--ja ${name}: der Bereich hat keine Frage, er ist immer dabei`);
  }
  return bereiche.filter((b) => !b.frage || yes.has(b.name.toLowerCase()));
}

export const render = (text, values) => text.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));

// Dateien mit Punkt am Anfang liegen in der Vorlage ohne, damit Installationswerkzeuge sie nicht verschlucken.
export function targetPath(rel) {
  const parts = rel.split('/');
  if (parts[0] === 'gitignore' || parts[0] === 'github') parts[0] = `.${parts[0]}`;
  return path.join(...parts);
}

export function listVorlagen(dir = PROJEKT, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? listVorlagen(path.join(dir, e.name), rel) : [rel];
  }).sort();
}

const hasInbox = (text) => text.split(/\r?\n/).some((l) => /^\/?inbox\/?$/.test(l.trim()));

export function mergeGitignore(text) {
  if (hasInbox(text)) return text;
  return `${text.replace(/\s*$/, '')}\n\n${INBOX_BLOCK}`;
}

// readExisting(dest) liefert den Inhalt einer vorhandenen Datei oder undefined.
export function planFiles(files, readExisting) {
  return files.map((src) => {
    const dest = targetPath(src);
    const existing = readExisting(dest);
    let action = existing === undefined ? 'anlegen' : 'vorhanden';
    if (src === 'gitignore' && existing !== undefined && !hasInbox(existing)) action = 'ergänzen';
    return { src, dest, action };
  });
}

export function bereicheTable(bereiche) {
  return [...FIXED, ...bereiche].map((b) => `| ${b.name} | ${b.description || ''} |`).join('\n');
}

export function boardArgs({ repo, assets, bereiche }) {
  return ['--repo', repo, '--assets', assets, ...bereiche.flatMap((b) => {
    const spec = [b.name, b.color || '', b.description || ''].join(':').replace(/:+$/, '');
    return ['--bereich', spec];
  })];
}

export function applyPlan(plan, { dir, read, values }) {
  for (const f of plan) {
    const dest = path.join(dir, f.dest);
    if (f.action === 'vorhanden') continue;
    mkdirSync(path.dirname(dest), { recursive: true });
    const text = f.action === 'ergänzen' ? mergeGitignore(readFileSync(dest, 'utf8')) : render(read(f.src), values);
    writeFileSync(dest, text);
  }
  mkdirSync(path.join(dir, 'inbox'), { recursive: true });
}

function parseArgs(argv) {
  const opts = { dir: process.cwd(), dryRun: false, ja: [], bereiche: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} braucht einen Wert`);
      return v;
    };
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--repo') opts.repo = next();
    else if (a === '--name') opts.name = next();
    else if (a === '--vision') opts.vision = next();
    else if (a === '--projektart') opts.projektart = next().toLowerCase();
    else if (a === '--ja') opts.ja.push(next());
    else if (a === '--nutzerbegriff') opts.nutzerbegriff = next();
    else if (a === '--assets') opts.assets = next();
    else if (a === '--bereich') opts.bereiche.push(parseBereich(next()));
    else if (a === '--dir') opts.dir = path.resolve(next());
    else throw new Error(`Unbekanntes Argument ${a}`);
  }
  for (const k of ['repo', 'name', 'vision', 'projektart']) if (!opts[k]) throw new Error(`--${k} fehlt`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(opts.repo)) throw new Error(`--repo erwartet <owner>/<repo>, nicht „${opts.repo}“`);

  if (opts.projektart === 'anderes') {
    if (!opts.nutzerbegriff) throw new Error('--nutzerbegriff fehlt (bei Projektart anderes)');
    if (!opts.bereiche.length) throw new Error('--bereich fehlt (bei Projektart anderes mindestens einer)');
    opts.label = 'Anderes';
    opts.bereiche = assignColors(opts.bereiche);
  } else {
    if (opts.nutzerbegriff || opts.bereiche.length) throw new Error('--nutzerbegriff und --bereich nur bei Projektart anderes');
    const art = loadProjektart(opts.projektart);
    opts.label = opts.projektart[0].toUpperCase() + opts.projektart.slice(1);
    opts.nutzerbegriff = art.nutzerbegriff;
    opts.assets ??= art.assets;
    opts.bereiche = selectBereiche(art.bereiche, opts.ja);
  }
  if (!['ja', 'nein'].includes(opts.assets)) throw new Error('--assets erwartet ja oder nein');
  return opts;
}

const quote = (s) => (/^[\w./:-]+$/.test(s) ? s : `"${s.replace(/(["\\$`])/g, '\\$1')}"`);

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const values = {
    name: opts.name,
    vision: opts.vision,
    repo: opts.repo,
    datum: new Date().toISOString().slice(0, 10),
    projektart: opts.label,
    nutzerbegriff: opts.nutzerbegriff,
    assets: opts.assets,
    bereiche: bereicheTable(opts.bereiche),
  };
  const readExisting = (dest) => {
    const p = path.join(opts.dir, dest);
    return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
  };
  const plan = planFiles(listVorlagen(), readExisting);

  console.log(`${opts.dryRun ? 'Trockenlauf' : 'Lauf'} in ${opts.dir}`);
  console.log(`- Projektart ${opts.label}, Nutzerbegriff ${opts.nutzerbegriff}, Assets-Spalte ${opts.assets}`);
  console.log(`- Bereiche: ${['Spec', 'Entscheidung', ...opts.bereiche.map((b) => b.name)].join(', ')}`);
  const verb = { anlegen: opts.dryRun ? 'würde anlegen' : 'angelegt', ergänzen: opts.dryRun ? 'würde inbox/ ergänzen' : 'inbox/ ergänzt', vorhanden: 'vorhanden, unverändert' };
  for (const f of plan) console.log(`- ${f.dest.split(path.sep).join('/')}: ${verb[f.action]}`);
  if (!opts.dryRun) applyPlan(plan, { dir: opts.dir, read: (src) => readFileSync(path.join(PROJEKT, src), 'utf8'), values });

  console.log('');
  console.log(`Weiter mit: node board.mjs ${boardArgs(opts).map(quote).join(' ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(e.message || String(e));
    process.exit(1);
  }
}
