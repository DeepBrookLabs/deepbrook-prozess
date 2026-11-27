# Projektkonfiguration

Die Projektwerte liegen als Markdown unter `docs/agents/`. `/projekt-anlegen` schreibt sie, die Skills lesen sie. Kein Skill trägt eigene Projektwerte; fehlt ein Wert, frag den Nutzer und trag ihn in die passende Datei ein.

| Datei | Inhalt |
|---|---|
| `issue-tracker.md` | GitHub-Befehle (Konvention von Matt Pocock) und am Ende der Abschnitt **Projektwerte** |
| `triage-labels.md` | Übersetzung der Triage-Rollen in die Label-Namen des Repos |
| `domain.md` | wo Glossar und ADRs liegen |
| `prozess.md` | Projektart, Nutzerbegriff, Assets-Spalte, Bereiche |

## Abschnitt Projektwerte in `issue-tracker.md`

```markdown
## Projektwerte

- **Repo:** `<owner>/<repo>`
- **Board:** Nummer `<n>`, Besitzer `<owner>`, <URL>
- **Board-ID:** `PVT_…`
- **Feld Status:** `PVTSSF_…`. Optionen: Specs `<id>`, Backlog `<id>`, Assets `<id>` (nur mit Assets-Spalte), Bereit `<id>`, In Arbeit `<id>`, Review `<id>`, Erledigt `<id>`
- **Feld Bereich:** `PVTSSF_…`. Optionen: <Bereich> `<id>`, … (dieselben Namen wie in `prozess.md`)
```

Befehle mit diesen Werten:

- Aufs Board legen: `gh project item-add <n> --owner <owner> --url <issue-url>`
- Item-ID: `gh project item-list <n> --owner <owner> --format json -L 500 --jq '.items[] | select(.content.number == <nr> and .content.repository == "<owner>/<repo>") | .id'`
- Status oder Bereich setzen: `gh project item-edit --project-id <Board-ID> --id <item-id> --field-id <Feld> --single-select-option-id <option-id>`
- Schlägt ein Aufruf mit einer ID fehl: `gh project field-list <n> --owner <owner> --format json` und die Projektwerte berichtigen.

## `prozess.md`

```markdown
# Prozess

- **Projektart:** Spiel | Anderes
- **Nutzerbegriff:** <Nutzer | Spieler | …>
- **Assets-Spalte:** ja | nein

## Bereiche

| Bereich | Wofür |
|---|---|
| Spec | Spec-Issue mit seinen Tickets als Sub-Issues |
| Entscheidung | ADR, Recherche |
| … | … |

## Projektregeln

Optional: Regeln, die nur in diesem Projekt gelten und den Prozess-Skill ergänzen.
```

- Der **Nutzerbegriff** ist das Wort für die Menschen, die das Ergebnis benutzen (Standard „Nutzer“, bei Spielen „Spieler“). `/spec-idee` fragt damit nach dem Ziel der Idee.
- Die **Bereiche** Spec und Entscheidung gibt es in jedem Projekt; die übrigen bringt die Projektart mit.
