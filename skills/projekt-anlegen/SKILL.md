---
name: projekt-anlegen
description: Richtet ein Projekt im Entwicklungsprozess von DeepBrookLabs ein – Repo, Ordner und Vorlagen, Labels, Kanban-Board, Skills und Projektkonfiguration.
disable-model-invocation: true
---

Führt den Nutzer im aktuellen Ordner durchs Setup eines Projekts. Du führst das Gespräch; die festen Schritte erledigen die Skripte in `scripts/` neben dieser Datei (Node.js, ohne Abhängigkeiten); `<skill>` in den Befehlen unten ist der Ordner dieser Datei. Jedes Skript hat `--dry-run`: Lass es zuerst trocken laufen, zeig dem Nutzer die Ausgabe knapp und starte den Lauf, wenn sie passt. Sprich Deutsch, einfach und ohne Fachjargon; der Nutzer kann ein Anfänger sein.

## 1. Voraussetzungen

```
node <skill>/scripts/voraussetzungen.mjs
```

Das Skript prüft Git, Node.js, die GitHub CLI `gh` und die Anmeldung bei GitHub (mit den Berechtigungen `repo` und `project`) und ändert nichts. Claude Code läuft schon, sonst wärst du nicht hier. Findet die Shell `node` gar nicht, erklär die Installation selbst (Windows `winget install --id OpenJS.NodeJS.LTS -e`, macOS `brew install node`, sonst https://nodejs.org/).

Ist etwas offen, halte an und erklär jeden Punkt Schritt für Schritt mit dem Hinweis aus der Ausgabe:
- **Installation:** Frag, ob du den Befehl ausführen sollst; nur bei Ja ausführen. Danach muss der Nutzer meist das Terminal und Claude Code neu starten.
- **Selbst eingeben** (Anmeldung): Der Nutzer gibt den Befehl mit Präfix `!` ein, z. B. `! gh auth login`; fehlt ihm ein GitHub-Konto, erklär zuerst die Registrierung.

Starte das Skript danach erneut und mach erst weiter, wenn alles ✓ ist.

## 2. Fragen

Frag nacheinander, jeweils mit einem Vorschlag:

1. **Name** des Projekts. Schlag daraus den Repo-Namen vor (Kleinbuchstaben, Bindestriche).
2. **Konto:** unter dem eigenen GitHub-Konto (`gh api user --jq .login`) oder einer Organisation (`gh api user/orgs --jq '.[].login'`).
3. **Vision** in ein bis drei Sätzen: Was entsteht, für wen, was macht es besonders?
4. **Projektart:** „Was entwickelst du? Spiel / Anderes“. Die Projektarten liegen unter `vorlagen/projektarten/`.
   - **Spiel:** Stell die Fragen aus der Spalte „Nur wenn“ der Bereiche-Tabelle (z. B. „Hat dein Spiel einen Online-Teil?“). Jeder Bereich mit Ja geht als `--ja <Bereich>` an das Vorlagen-Skript.
   - **Anderes:** Frag nacheinander
     - das Wort für die Menschen, die das Ergebnis benutzen (Standard „Nutzer“, z. B. „Kunde“ oder „Leser“),
     - ob es eine Spalte Assets für Bilder und Grafiken geben soll (ja/nein),
     - welche Bereiche das Board außer Spec und Entscheidung bekommt: je Bereich ein Name und wofür er steht (z. B. „Oberfläche – Seiten und Bedienung“). Schlag zwei bis vier passend zur Vision vor.

     Die Farben verteilt das Skript der Reihe nach; der Nutzer muss keine wählen.

Fass die Antworten zusammen und hol dir ein Ja, bevor du etwas anlegst.

## 3. Repo

Ist der Ordner noch kein Git-Repo: `git init -b main`. Dann `gh repo create <owner>/<repo> --private --source . --remote origin`.

**Bestehendes Repo:** Hat der Ordner schon einen Remote (`git remote get-url origin`) oder gibt es das Repo auf GitHub schon, frag, ob es verwendet werden soll, und nimm dann dessen `<owner>/<repo>`. In einem bestehenden Repo ändern die folgenden Schritte nichts Vorhandenes ohne Rückfrage; die Trockenläufe zeigen, was schon da ist.

## 4. Vorlagen

```
node <skill>/scripts/vorlagen.mjs --repo <owner>/<repo> --name "<Name>" --vision "<Vision>" --projektart spiel [--ja Server] --dry-run
```

Bei Anderes statt `--ja`: `--projektart anderes --nutzerbegriff <Wort> --assets ja|nein --bereich "<Name>::<Wofür>"` je Bereich. Das Skript legt Ordner und Dateien an (CLAUDE.md, README.md, GLOSSARY.md, `.gitignore` mit `inbox/`, `docs/`, Spec-Issue-Vorlage) und schreibt `docs/agents/prozess.md`. Die letzte Zeile nennt die Argumente für das Board-Skript.

Vorhandene Dateien lässt das Skript stehen und nennt sie im Trockenlauf als „vorhanden“ (in eine vorhandene `.gitignore` kommt nur `inbox/` dazu). Frag für jede vorhandene Datei, was passieren soll, und erklär kurz, wofür die Vorlage da ist:
- **lassen** (Standard): nichts weiter.
- **ergänzen:** Die Vorlage kommt unten an die Datei; sinnvoll für `CLAUDE.md`, damit der Verweis auf den Prozess dazukommt. Argument `--ergaenzen <Datei>`.
- **ersetzen:** Die Vorlage ersetzt die Datei. Argument `--ueberschreiben <Datei>`.

Ohne Ja zu ergänzen oder ersetzen bleibt die Datei unverändert. Zeig den Trockenlauf mit den gewählten Argumenten noch einmal, bevor du startest.

## 5. Labels

```
node <skill>/scripts/labels.mjs --repo <owner>/<repo> --dry-run
```

Listet der Trockenlauf GitHub-Standard-Labels, frag, ob sie entfernt werden sollen; nur bei Ja kommt `--remove-defaults` dazu. Will der Trockenlauf vorhandene Labels mit gleichem Namen ändern (Farbe, Beschreibung), frag vorher; ohne Ja überspring den Lauf und sag dem Nutzer, welche Labels vom Prozess abweichen. Eigene Labels des Projekts bleiben immer unberührt.

## 6. Board

Die Argumente aus der letzten Zeile des Vorlagen-Skripts:

```
node <skill>/scripts/board.mjs --repo <owner>/<repo> --assets ja --bereich "…" … --dry-run
```

Ist mit dem Repo schon ein Board verknüpft, hält das Skript an und nennt es. Frag, ob trotzdem ein neues Board entstehen soll; nur bei Ja mit `--neues-board` starten. Sonst überspring den Schritt, und die IDs in `docs/agents/issue-tracker.md` trägst du mit dem Nutzer von Hand ein (`gh project field-list <nr> --owner <owner> --format json`).

Das Skript kopiert das Vorlage-Board, verknüpft es mit dem Repo, setzt Spalten und Bereiche und schreibt die IDs in `docs/agents/issue-tracker.md`. Meldet es eine ausgeschaltete Automatik, gib dem Nutzer den Link und bitte ihn, sie einzuschalten.

## 7. Skills

```
node <skill>/scripts/skills.mjs --dry-run
```

Installiert die Skills nach `.claude/skills/` und schreibt `skills-lock.json`.

## 8. Abschluss

1. `git add -A`, Commit „Projekt angelegt“, `git push -u origin main`.
2. Prüf, dass `docs/agents/` die vier Dateien `issue-tracker.md`, `triage-labels.md`, `domain.md` und `prozess.md` enthält und `issue-tracker.md` den Abschnitt Projektwerte hat.
3. Zeig dem Nutzer Repo- und Board-Link und erklär den nächsten Schritt in einem Satz: Claude Code neu starten, damit die Skills geladen werden, dann die erste Idee mit `/spec-idee` festhalten. Dateien wie Konzeptbilder oder Notizen kann er jederzeit in `inbox/` legen.
