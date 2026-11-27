#!/usr/bin/env node
// Legt die Labels des Prozesses in einem GitHub-Repo an oder gleicht sie an.
//
//   node labels.mjs --repo <owner>/<repo> [--dry-run] [--remove-defaults]
//
// --dry-run          gibt nur aus, was passieren würde, und ändert nichts
// --remove-defaults  entfernt die übrigen GitHub-Standard-Labels; nur nach Rückfrage beim Nutzer setzen
//
// Ohne --remove-defaults werden vorhandene Standard-Labels nur aufgelistet.
// Eigene Labels des Projekts, die weder Prozess- noch Standard-Labels sind, bleiben immer unberührt.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  return JSON.parse(readFileSync(path.join(here, 'labels.json'), 'utf8'));
}

const key = (name) => name.toLowerCase();
const normColor = (color) => color.replace(/^#/, '').toLowerCase();

// Reine Planung: vergleicht vorhandene mit gewünschten Labels.
// existing: [{ name, color, description }] wie von `gh label list --json` geliefert.
export function planLabels(existing, config, { removeDefaults = false } = {}) {
  const byKey = new Map(existing.map((l) => [key(l.name), l]));
  const create = [];
  const update = [];
  for (const want of config.labels) {
    const have = byKey.get(key(want.name));
    if (!have) {
      create.push(want);
      continue;
    }
    const changes = [];
    if (have.name !== want.name) changes.push(`Name „${have.name}“ → „${want.name}“`);
    if (normColor(have.color) !== normColor(want.color)) changes.push(`Farbe #${normColor(have.color)} → #${normColor(want.color)}`);
    if ((have.description ?? '') !== want.description) changes.push(`Beschreibung „${have.description ?? ''}“ → „${want.description}“`);
    if (changes.length) update.push({ current: have.name, want, changes });
  }
  const removable = config.removableDefaults
    .map((name) => byKey.get(key(name)))
    .filter(Boolean)
    .map((l) => l.name);
  return { create, update, removable, remove: removeDefaults ? removable : [] };
}

export function formatPlan(plan, { dryRun, removeDefaults }) {
  const lines = [];
  const prefix = dryRun ? 'Würde ' : '';
  for (const l of plan.create) lines.push(`${prefix}anlegen: ${l.name} (#${normColor(l.color)}, „${l.description}“)`);
  for (const u of plan.update) lines.push(`${prefix}ändern: ${u.current}: ${u.changes.join('; ')}`);
  if (removeDefaults) {
    for (const name of plan.remove) lines.push(`${prefix}entfernen: ${name}`);
  } else if (plan.removable.length) {
    lines.push(`Entfernbar nach Rückfrage (--remove-defaults): ${plan.removable.join(', ')}`);
  }
  if (!plan.create.length && !plan.update.length && !plan.remove.length) {
    lines.push('Labels sind aktuell, nichts zu tun.');
  }
  return lines;
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseArgs(argv) {
  const opts = { dryRun: false, removeDefaults: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--remove-defaults') opts.removeDefaults = true;
    else if (a === '--repo') opts.repo = argv[++i];
    else throw new Error(`Unbekannte Option: ${a}`);
  }
  if (!opts.repo || !/^[^/\s]+\/[^/\s]+$/.test(opts.repo)) {
    throw new Error('Aufruf: node labels.mjs --repo <owner>/<repo> [--dry-run] [--remove-defaults]');
  }
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
  const { repo, dryRun, removeDefaults } = opts;
  // Ein frisch angelegtes Repo liefert kurz leere Ausgabe statt [].
  const existing = JSON.parse(gh(['label', 'list', '-R', repo, '--json', 'name,color,description', '-L', '1000']).trim() || '[]');
  const plan = planLabels(existing, loadConfig(), { removeDefaults });
  console.log(`${dryRun ? 'Trockenlauf' : 'Lauf'} für ${repo}`);
  for (const line of formatPlan(plan, { dryRun, removeDefaults })) console.log(`- ${line}`);
  if (dryRun) return;

  for (const l of plan.create) {
    gh(['label', 'create', l.name, '-R', repo, '--color', normColor(l.color), '--description', l.description]);
  }
  for (const u of plan.update) {
    gh(['label', 'edit', u.current, '-R', repo, '--name', u.want.name, '--color', normColor(u.want.color), '--description', u.want.description]);
  }
  for (const name of plan.remove) {
    gh(['label', 'delete', name, '-R', repo, '--yes']);
  }
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
