// node --test skills/projekt-anlegen/scripts/voraussetzungen.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScopes, assess } from './voraussetzungen.mjs';

const loggedIn = `github.com
  ✓ Logged in to github.com account octo (keyring)
  - Active account: true
  - Token scopes: 'gist', 'project', 'read:org', 'repo'
`;

const allOk = {
  git: { out: 'git version 2.45.0' },
  node: { out: 'v22.1.0' },
  gh: { out: 'gh version 2.60.0' },
  auth: { out: loggedIn },
};

test('Scopes aus gh auth status', () => {
  assert.deepEqual(parseScopes(loggedIn), ['gist', 'project', 'read:org', 'repo']);
  assert.deepEqual(parseScopes('You are not logged into any GitHub hosts.'), []);
});

test('Alles da: keine offenen Schritte', () => {
  const r = assess(allOk, 'win32');
  assert.equal(r.ok, true);
  assert.deepEqual(r.items.map((i) => [i.name, i.ok]), [['Git', true], ['Node.js', true], ['GitHub CLI (gh)', true], ['GitHub-Anmeldung', true]]);
});

test('gh nicht angemeldet: Anmeldung als Schritt, nichts installieren', () => {
  const r = assess({ ...allOk, auth: { error: true, out: 'You are not logged into any GitHub hosts. To log in, run: gh auth login' } }, 'win32');
  assert.equal(r.ok, false);
  const auth = r.items.find((i) => i.name === 'GitHub-Anmeldung');
  assert.equal(auth.ok, false);
  assert.equal(auth.befehl, 'gh auth login');
  assert.equal(auth.install, false);
  assert.match(auth.hinweis, /GitHub-Konto/);
});

test('Fehlender project-Scope: Anmeldung erweitern', () => {
  const r = assess({ ...allOk, auth: { out: loggedIn.replace("'project', ", '') } }, 'darwin');
  const auth = r.items.find((i) => i.name === 'GitHub-Anmeldung');
  assert.equal(auth.ok, false);
  assert.equal(auth.befehl, 'gh auth refresh -s project');
});

test('Fehlende Programme: Installationsbefehl je Betriebssystem, als Installation markiert', () => {
  const missing = { ...allOk, git: { error: true }, gh: { error: true }, auth: { error: true } };
  const win = assess(missing, 'win32').items;
  assert.equal(win.find((i) => i.name === 'Git').befehl, 'winget install --id Git.Git -e');
  assert.equal(win.find((i) => i.name === 'Git').install, true);
  assert.equal(win.find((i) => i.name === 'GitHub CLI (gh)').befehl, 'winget install --id GitHub.cli -e');
  const mac = assess(missing, 'darwin').items;
  assert.equal(mac.find((i) => i.name === 'Git').befehl, 'brew install git');
  // Ohne gh kann die Anmeldung erst danach geprüft werden.
  assert.match(win.find((i) => i.name === 'GitHub-Anmeldung').hinweis, /nach der Installation/);
});

test('Zu altes Node.js', () => {
  const r = assess({ ...allOk, node: { out: 'v16.20.0' } }, 'linux');
  const node = r.items.find((i) => i.name === 'Node.js');
  assert.equal(node.ok, false);
  assert.match(node.hinweis, /18/);
});
