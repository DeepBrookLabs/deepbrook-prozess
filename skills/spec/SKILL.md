---
name: spec
description: Eine Spec durch ihren Lebenszyklus führen – erkennt die Phase am Spec-Issue (grillen, slicen, Stand, Abnahme); ohne Argument Übersicht der Spalte Specs.
argument-hint: "[#Spec-Issue]"
disable-model-invocation: true
---

Führt ein **Spec-Issue** (Parent-Issue einer Spec, Bereich Spec) von der Idee bis zur Abnahme. Die Karte bleibt dabei in der Spalte Specs; die Phase zeigt das Label. Lade zuerst den Skill `prozess`: Er ist die Quelle für Board-Lebenszyklus und Labels; Repo, Board- und Feld-IDs stehen in der Projektkonfiguration unter `docs/agents/`.

## Phase bestimmen

Ohne Argument: **Übersicht.** Liste jede Karte in Specs mit Nummer, Titel, Phase und dem nächsten Befehl. Schreib nichts.

Mit `#<nr>` lies Labels, Sub-Issues (`subIssuesSummary`) und Status des Issues und wähle die Phase:

| Zustand | Phase |
|---|---|
| Label `ready-to-grill` | Grillen |
| Label `ready-to-slice` | Slicen |
| kein Phasen-Label, offene Sub-Issues | Stand |
| kein Phasen-Label, alle Sub-Issues zu | Abnahme |
| Issue geschlossen | nur melden: Spec erledigt |

Nenn dem Nutzer die Phase in einem Satz, dann führe sie aus.

## Grillen

1. Lies das Issue, seine Unterlagen (Konzeptbilder, Dokumente, Links, passende Dateien in `inbox/`), verwandte Specs, `docs/DESIGN.md`, das Glossar und die ADRs im Bereich (wo sie liegen, sagt `docs/agents/domain.md`).
2. Ruf die Skills `grilling` und `domain-modeling` auf und grille die Idee. Fertig, wenn jeder Zweig des Entscheidungsbaums vom Nutzer entschieden ist.
3. Schreib `docs/specs/<name>.md` nach `docs/specs/_vorlage.md` (Stand-Zeile mit „Status: Entwurf“, Bezug, Unterlagen, Problemstellung, Lösung, User Stories, Entscheidungen, Abnahmekriterien mit Testnähten, Testentscheidungen, Außerhalb des Umfangs). Trag sie in `docs/specs/README.md` ein.
4. Branch, Commit mit Spec und Unterlagen, PR mit dem Skill `pr`, als Spec-PR aufs Board (Skill `prozess`). Unterlagen außerhalb des Repos holst du dabei herein: nach `docs/specs/<name>/`, sofern das Projekt keinen anderen Ort festlegt; Dateien aus `inbox/` verschiebst du dorthin.
5. Issue-Text nach der Spec-Vorlage in `.github/ISSUE_TEMPLATE/` (Spec-Link, Zusammenfassung, „abgeschlossen, wenn alle AK erfüllt sind“), Label `ready-to-grill` → `ready-to-slice`.

Fertig, wenn der PR offen ist, auf dem Board in Review liegt und das Issue `ready-to-slice` trägt. Nächster Schritt für den Nutzer: PR mergen, dann `/spec #<nr>`.

## Slicen

1. Prüf, dass die Spec auf `main` liegt; sonst zuerst den PR mergen lassen.
2. Ruf den Skill `to-tickets` mit dem Spec-Pfad auf. Die Tickets werden Sub-Issues dieses Issues. Schneide so, dass Logik, die sich ohne Oberfläche testen lässt, ein eigenes Ticket vor ihrer Darstellung bekommt; die Darstellung hängt dann als Blocker daran. Zeig dem Nutzer den Zuschnitt mit dem Label je Ticket (`ready-for-agent` oder `ready-for-human`), bevor du die Tickets anlegst.
3. Leg jedes Ticket aufs Board und setz Status und Bereich nach dem Skill `prozess` und den Bereichen in `docs/agents/prozess.md`.
4. Entferne das Label `ready-to-slice`.

Fertig, wenn jedes Sub-Issue auf dem Board Status und Bereich hat und das Issue kein Phasen-Label mehr trägt. Nenn das erste Ticket in Bereit.

## Stand

1. Liste die offenen Sub-Issues mit Board-Status und offenen Blockern.
2. Korrigiere jede Karte, die nach dem Board-Lebenszyklus in der falschen Spalte liegt.
3. Nenn das nächste startbare Ticket und alles, was auf den Nutzer wartet (`ready-for-human`, Assets, Review).

## Abnahme

1. Geh jedes AK der Spec durch und ordne ihm einen Beleg zu: einen grünen Test (Name, Lauf) oder eine Abnahme durch den Nutzer.
2. Prüf die AK, die der Nutzer bestätigen muss (Optik, Geräte, externe Dienste), einzeln mit ihm. Fällt eins durch, leg ein Ticket als Sub-Issue an; die Spec bleibt dann in Phase Stand.
3. Stand-Zeile der Spec auf „Status: umgesetzt“ mit Tickets und Abnahmedatum, Status in `docs/specs/README.md`, PR mit dem Skill `pr`, als Spec-PR aufs Board (Skill `prozess`).
4. Schließ das Issue mit einem Kommentar und setz die Karte auf Erledigt.

Fertig, wenn jedes AK einen Beleg hat und die Karte in Erledigt liegt.
