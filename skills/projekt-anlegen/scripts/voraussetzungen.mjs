#!/usr/bin/env node
// Prüft die Voraussetzungen fürs Setup: Git, Node.js, GitHub CLI (gh) und die Anmeldung bei GitHub.
//
//   node voraussetzungen.mjs
//
// Installiert und ändert nichts. Für jeden offenen Punkt nennt es, was zu tun ist, und einen Befehl.
// Befehle mit „Installation“ führt Claude nur nach Zustimmung des Nutzers aus; die Anmeldung gibt der
// Nutzer selbst ein. Exit-Code 0: alles da, 1: mindestens ein Punkt offen.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MIN_NODE = 18;
const SCOPES = ['repo', 'project'];

const INSTALL = {
  Git: { win32: 'winget install --id Git.Git -e', darwin: 'brew install git', url: 'https://git-scm.com/downloads' },
  'Node.js': { win32: 'winget install --id OpenJS.NodeJS.LTS -e', darwin: 'brew install node', url: 'https://nodejs.org/' },
  'GitHub CLI (gh)': { win32: 'winget install --id GitHub.cli -e', darwin: 'brew install gh', url: 'https://cli.github.com/' },
};

export function parseScopes(text) {
  const line = text.split(/\r?\n/).find((l) => /Token scopes:/i.test(l));
  return line ? [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
}

function program(name, result, platform, zweck) {
  if (!result.error) return { name, ok: true, hinweis: result.out.trim().split(/\r?\n/)[0] };
  const i = INSTALL[name];
  const befehl = i[platform];
  return {
    name, ok: false, install: true, befehl,
    hinweis: `${name} fehlt; ${zweck}. ${befehl ? 'Installieren mit dem Befehl unten' : `Download: ${i.url}`}, danach das Terminal neu öffnen.`,
  };
}

// results: { git, node, gh, auth } mit je { out } oder { error: true, out? } aus dem Aufruf des Programms.
export function assess(results, platform = process.platform) {
  const items = [program('Git', results.git, platform, 'es speichert die Versionen deiner Dateien')];

  const node = program('Node.js', results.node, platform, 'die Setup-Skripte laufen damit');
  const major = Number(results.node.out?.match(/v(\d+)/)?.[1]);
  if (node.ok && major < MIN_NODE) {
    Object.assign(node, { ok: false, install: true, befehl: INSTALL['Node.js'][platform],
      hinweis: `Node.js ${results.node.out.trim()} ist zu alt; nötig ist Version ${MIN_NODE} oder neuer.` });
  }
  items.push(node);

  const gh = program('GitHub CLI (gh)', results.gh, platform, 'damit legt das Setup Repo, Labels und Board auf GitHub an');
  items.push(gh);

  const auth = { name: 'GitHub-Anmeldung', ok: false, install: false };
  if (!gh.ok) {
    auth.hinweis = 'Wird nach der Installation von gh geprüft.';
  } else if (results.auth.error) {
    Object.assign(auth, { befehl: 'gh auth login',
      hinweis: 'gh ist nicht bei GitHub angemeldet. Du brauchst ein GitHub-Konto (kostenlos unter https://github.com/signup). Gib dann den Befehl unten selbst ein, wähle GitHub.com, HTTPS und „Login with a web browser“ und folge dem Browser.' });
  } else {
    const missing = SCOPES.filter((s) => !parseScopes(results.auth.out).includes(s));
    if (missing.length) {
      Object.assign(auth, { befehl: `gh auth refresh -s ${missing.join(',')}`,
        hinweis: `Der Anmeldung fehlt die Berechtigung ${missing.join(', ')} (für ${missing.includes('project') ? 'das Kanban-Board' : 'Repos'}). Gib den Befehl unten selbst ein und bestätige im Browser.` });
    } else {
      Object.assign(auth, { ok: true, hinweis: results.auth.out.match(/account (\S+)/)?.[1] ?? 'angemeldet' });
    }
  }
  items.push(auth);
  return { ok: items.every((i) => i.ok), items };
}

// gh auth status schreibt je nach Version auf stdout oder stderr, daher beides zusammen.
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return r.error || r.status !== 0 ? { error: true, out } : { out };
}

function main() {
  const results = {
    git: run('git', ['--version']),
    node: { out: process.version },
    gh: run('gh', ['--version']),
    auth: { error: true, out: '' },
  };
  if (!results.gh.error) results.auth = run('gh', ['auth', 'status']);
  const { ok, items } = assess(results);
  for (const i of items) {
    console.log(`${i.ok ? '✓' : '✗'} ${i.name}: ${i.hinweis}`);
    if (!i.ok && i.befehl) console.log(`    ${i.install ? 'Installation (nur nach Zustimmung)' : 'Selbst eingeben'}: ${i.befehl}`);
  }
  console.log(ok ? '\nAlles da.' : '\nOffen – erst erledigen, dann das Skript noch einmal starten.');
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
