---
name: prozess
description: Prozessregeln für Board, Tickets und PRs. Use when starting or finishing a ticket, creating an issue, moving a board card, opening or pushing a PR, or when files lie in inbox/.
---

Allgemeine Regeln des Entwicklungsprozesses. Die Werte des Projekts (Repo, Board, Feld- und Options-IDs, Bereiche, Nutzerbegriff) stehen in der **Projektkonfiguration** unter `docs/agents/`; ihr Format beschreibt [projektkonfiguration.md](projektkonfiguration.md). Fehlt sie, schlag dem Nutzer `/projekt-anlegen` vor.

## Board-Lebenszyklus

Labels und Board-Status sind in GitHub getrennt; halte sie selbst synchron. Setz die Spalte **bei jedem Ereignis sofort und ohne Rückfrage**, im selben Befehl wie das Ereignis (`git switch -c`, `gh pr create`, `gh pr merge`), nicht am Ende nachgeholt.

| Ereignis | Spalte |
|---|---|
| Spec-Issue (Bereich Spec), ganzes Leben bis zur Abnahme | Specs |
| Spec-Issue, alle AK erfüllt und vom Nutzer abgenommen | Erledigt |
| Issue angelegt, noch nicht bereit oder mit offenem Blocker | Backlog |
| Asset-Issue (Bild oder Grafik, die der Nutzer erzeugt), nur mit Assets-Spalte | Assets, bis es geschlossen ist |
| Label `ready-for-agent` oder `ready-for-human` **und** kein offener Blocker | Bereit |
| Arbeit beginnt (Branch angelegt), der erste Schreibschritt der Sitzung | In Arbeit |
| PR geöffnet | Review |
| PR gemergt oder Issue geschlossen | Erledigt |

- **Neue Issues** legst du selbst aufs Board und setzt sofort Status und Bereich; eine Auto-Add-Automatik gibt es nicht. Der Bereich ist der Schwerpunkt des Tickets; ein vertikaler Schnitt über mehrere Schichten bekommt die Schicht mit der meisten Arbeit.
- **Nach dem Schließen** prüfen: Das Issue liegt in Erledigt (die Automatiken „Item closed“ und „Pull request merged“ setzen es meist; sonst selbst), und jedes Ticket, das es blockiert hat, rückt nach Bereit, wenn es keinen offenen Blocker mehr hat und ein `ready-for-*`-Label trägt.
- Eine Karte nach Erledigt zu ziehen schließt das Issue nicht.

## Labels

- `ready-for-agent`: vollständig beschrieben, Claude darf ohne den Nutzer umsetzen.
- `ready-for-human`: braucht den Nutzer (Grafik, Entscheidung, Gerätetest, Zugang).
- Phasen eines Spec-Issues: `ready-to-grill` (Spec-Idee), `ready-to-slice` (Spec liegt in `docs/specs/`), danach keins mehr; den Fortschritt zeigen die Sub-Issues. Den Ablauf führen `/spec-idee` und `/spec`.
- Die übrigen Labels (`needs-triage`, `needs-info`, `wontfix`) übersetzt `docs/agents/triage-labels.md`.

## Ticket umsetzen

1. Branch anlegen, Karte auf In Arbeit.
2. Umsetzen, wo möglich testgetrieben (Skill `tdd`).
3. PR öffnen, den Text **immer** mit dem Skill `pr` schreiben, `Closes #<nr>` darin; Karte auf Review. Nur das Schlüsselwort (`Closes`, `Fixes`, `Resolves`) verknüpft PR und Issue; ohne diese Verknüpfung fehlt das PR-Icon auf der Karte. Schließt der PR das Ticket nur teilweise, schreib `Teil von #<nr>` und bitte den Nutzer, beide in der Seitenleiste des PRs unter „Development“ zu verknüpfen (per API geht das nicht).
4. Vor jedem weiteren Push auf den Branch `gh pr view <nr> --json state` prüfen. Ist der PR schon gemergt, biete einen Folge-PR vom selben Branch an. Mergen nur, wenn der Nutzer genau diesen PR freigibt.
5. Nach dem Merge: Nachlauf wie unter „Nach dem Schließen“, dann dem Nutzer `/clear` vorschlagen und das nächste startbare Ticket nennen.

## Sparsame Ausgaben

Was in den Verlauf gelangt, wird mit jeder Nachricht erneut gesendet. Hol Test-, Build- und `gh`-Ausgaben gefiltert (`--jq`, `tail`, `grep`, `--quiet`) und lade bei einem Fehler gezielt nach; lies große Dateien abschnittsweise und gib breite Suchen über viele Dateien an einen Explore-Agenten.

## Inbox

`inbox/` ist git-ignoriert und die Ablage des Nutzers für Konzeptbilder, Notizen und PDFs. Schau beim Arbeiten an einer Spec oder einem Ticket dort nach passenden Dateien. Geht eine Datei in eine Spec oder ein Ticket ein, verschiebst du sie an ihren festen Ort im Repo (Bilder zu den Unterlagen der Spec, Dokumente nach Absprache) und verlinkst sie dort; in `inbox/` liegt sie danach nicht mehr.

## Rückblick

Nach einigen abgeschlossenen Specs biete dem Nutzer einen Rückblick auf den Prozess an: was trägt, was hakt, was sich ändern soll. Änderungen am Prozess gehören ins Paket `DeepBrookLabs/deepbrook-prozess`, nicht ins Projekt.
