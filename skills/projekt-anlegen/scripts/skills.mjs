#!/usr/bin/env node
// Installiert die Skills des Prozesses ins Projekt (.claude/skills/, Stand in skills-lock.json).
//
//   node skills.mjs [--dir <Projektordner>] [--dry-run]
//
// --dir       Projektordner, Standard: aktueller Ordner
// --dry-run   gibt nur die Befehle aus und ändert nichts
//
// Welche Skills aus welcher Quelle kommen, steht in skills.json. Quellen mit "ref" werden auf diesen
// Commit gepinnt; die Skills des Pakets kommen vom main und folgen per `npx skills update`.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  return JSON.parse(readFileSync(path.join(here, 'skills.json'), 'utf8'));
}

// Argumente für npx, ein Aufruf je Quelle.
export function installCommands(config) {
  return config.sources.map(({ source, ref, skills }) => [
    '-y', 'skills', 'add', ref ? `${source}#${ref}` : source,
    ...skills.flatMap((s) => ['--skill', s]),
    '-a', 'claude-code', '-y',
  ]);
}

function main() {
  const argv = process.argv.slice(2);
  let dir = process.cwd();
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--dir' && argv[i + 1]) dir = path.resolve(argv[++i]);
    else {
      console.error(`Unbekanntes Argument ${argv[i]}`);
      process.exit(2);
    }
  }
  console.log(`${dryRun ? 'Trockenlauf' : 'Lauf'} in ${dir}`);
  for (const args of installCommands(loadConfig())) {
    console.log(`- npx ${args.join(' ')}`);
    if (dryRun) continue;
    // npx ist unter Windows eine .cmd-Datei und braucht dort die Shell; die Argumente enthalten keine Leerzeichen.
    execFileSync('npx', args, { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
  }
  if (!dryRun) {
    const lock = JSON.parse(readFileSync(path.join(dir, 'skills-lock.json'), 'utf8'));
    console.log(`Installiert: ${Object.keys(lock.skills).sort().join(', ')}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error((e.stderr || e.message || String(e)).toString().trim());
    process.exit(1);
  }
}
