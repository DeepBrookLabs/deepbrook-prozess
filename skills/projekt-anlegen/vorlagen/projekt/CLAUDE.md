# {{name}}

{{vision}}

Vision: [docs/DESIGN.md](docs/DESIGN.md). Entscheidungen: [docs/adr/](docs/adr/). Begriffe: [GLOSSARY.md](GLOSSARY.md).

## Arbeitsregeln

- Der Entwicklungsprozess (Board, Labels, Tickets, PRs, Inbox) steht im Skill `prozess`; lade ihn, bevor du ein Ticket beginnst, ein Issue anlegst oder eine Board-Karte verschiebst. Die Werte dieses Projekts stehen in `docs/agents/`.
- Spec-Driven Development: Verhalten ändert sich zuerst in `docs/specs/`, dann im Code. Neue Ideen per `/spec-idee`, weiter per `/spec #<nr>`; die Slash-Befehle startet der Nutzer, schlag ihm den nächsten vor, sobald ein Schritt fertig ist.
- Mit dem Nutzer auf Deutsch kommunizieren; Code-Bezeichner auf Englisch (siehe Glossar).
- Dateien des Nutzers liegen in `inbox/` (git-ignoriert); was in eine Spec oder ein Ticket eingeht, kommt an seinen festen Ort im Repo.

## Agent skills

### Issue tracker

Issues leben in GitHub Issues von {{repo}} und liegen auf dem Kanban-Board des Projekts. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard-Labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: GLOSSARY.md und docs/adr/ im Repo-Root. See `docs/agents/domain.md`.

### Prozess

Projektart, Nutzerbegriff und Bereiche. See `docs/agents/prozess.md`.
