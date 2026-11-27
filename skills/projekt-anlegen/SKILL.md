---
name: projekt-anlegen
description: Richtet ein Projekt im Entwicklungsprozess von DeepBrookLabs ein – Repo, Ordner und Vorlagen, Labels, Kanban-Board, Skills und Projektkonfiguration.
disable-model-invocation: true
---

Führt den Nutzer im aktuellen Ordner durchs Setup eines Projekts. Du führst das Gespräch; die festen Schritte erledigen die Skripte in `scripts/` neben dieser Datei (Node.js, ohne Abhängigkeiten); `<skill>` in den Befehlen unten ist der Ordner dieser Datei. Jedes Skript hat `--dry-run`: Lass es zuerst trocken laufen, zeig dem Nutzer die Ausgabe knapp und starte den Lauf, wenn sie passt. Sprich Deutsch, einfach und ohne Fachjargon; der Nutzer kann ein Anfänger sein.

## 1. Voraussetzungen

Prüf `git --version`, `node --version` und `gh auth status`. Fehlt etwas oder ist `gh` nicht angemeldet, halte an und erklär Schritt für Schritt, was zu tun ist; installiere nur, wenn der Nutzer zustimmt. Ein Anmeldebefehl, den der Nutzer selbst eingeben muss, bekommt das Präfix `!` (z. B. `! gh auth login`).

## 2. Fragen

Frag nacheinander, jeweils mit einem Vorschlag:

1. **Name** des Projekts. Schlag daraus den Repo-Namen vor (Kleinbuchstaben, Bindestriche).
2. **Konto:** unter dem eigenen GitHub-Konto (`gh api user --jq .login`) oder einer Organisation (`gh api user/orgs --jq '.[].login'`).
3. **Vision** in ein bis drei Sätzen: Was entsteht, für wen, was macht es besonders?
4. **Projektart:** „Was entwickelst du? Spiel / Anderes“. Die Projektarten liegen unter `vorlagen/projektarten/`.
   - **Spiel:** Stell die Fragen aus der Spalte „Nur wenn“ der Bereiche-Tabelle (z. B. „Hat dein Spiel einen Online-Teil?“). Jeder Bereich mit Ja geht als `--ja <Bereich>` an das Vorlagen-Skript.
   - **Anderes:** Frag das Wort für die Menschen, die das Ergebnis benutzen (Standard „Nutzer“), ob es eine Spalte Assets für Bilder und Grafiken geben soll, und welche Bereiche das Board außer Spec und Entscheidung bekommt (je Bereich ein Name und wofür). Die Farben verteilt das Skript.

Fass die Antworten zusammen und hol dir ein Ja, bevor du etwas anlegst.

## 3. Repo

Ist der Ordner noch kein Git-Repo: `git init -b main`. Dann `gh repo create <owner>/<repo> --private --source . --remote origin`. Gibt es das Repo schon, frag, ob es verwendet werden soll.

## 4. Vorlagen

```
node <skill>/scripts/vorlagen.mjs --repo <owner>/<repo> --name "<Name>" --vision "<Vision>" --projektart spiel [--ja Server] --dry-run
```

Bei Anderes statt `--ja`: `--projektart anderes --nutzerbegriff <Wort> --assets ja|nein --bereich "<Name>::<Wofür>"` je Bereich. Das Skript legt Ordner und Dateien an (CLAUDE.md, README.md, GLOSSARY.md, `.gitignore` mit `inbox/`, `docs/`, Spec-Issue-Vorlage) und schreibt `docs/agents/prozess.md`. Vorhandene Dateien lässt es stehen. Die letzte Zeile nennt die Argumente für das Board-Skript.

## 5. Labels

```
node <skill>/scripts/labels.mjs --repo <owner>/<repo> --dry-run
```

Listet der Trockenlauf GitHub-Standard-Labels, frag, ob sie entfernt werden sollen; nur bei Ja kommt `--remove-defaults` dazu.

## 6. Board

Die Argumente aus der letzten Zeile des Vorlagen-Skripts:

```
node <skill>/scripts/board.mjs --repo <owner>/<repo> --assets ja --bereich "…" … --dry-run
```

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
