---
name: spec-idee
description: Eine neue Spec-Idee als Spec-Issue in die Spalte Specs legen (ready-to-grill).
argument-hint: "[optional: Name der Spec – die Idee in ein paar Sätzen]"
disable-model-invocation: true
---

Legt eine **Spec-Idee** auf das Board: ein Spec-Issue mit Label `ready-to-grill` in der Spalte Specs. Ausgearbeitet wird sie später mit `/spec #<nr>`. Board-Regeln: Skill `prozess`; Repo, Board- und Feld-IDs und der **Nutzerbegriff**: Projektkonfiguration unter `docs/agents/` (Nutzerbegriff in `prozess.md`, Standard „Nutzer“).

## Ablauf

Du führst den Nutzer mit drei Fragen durch die Idee, **eine Frage pro Nachricht**, in einfachem Chat-Text. Beantwortet das Argument eine Frage schon, überspring sie. Die Idee bleibt eine Skizze: Grillen ist Sache von `/spec`.

1. **Frage 1 – Idee:** „Beschreib die Idee kurz: Wie soll die Spec heißen, und worum geht es?“ Fertig, wenn Name und ein bis drei Sätze Idee feststehen.
2. **Dubletten prüfen.** Suche in `docs/specs/README.md` und in den offenen Issues mit Bereich Spec nach demselben Thema. Gibt es eins, zeig es dem Nutzer und hör auf.
3. **Frage 2 – Unterlagen:** „Gibt es Unterlagen dazu, etwa Konzeptbilder, Dokumente, Notizen oder Links? Nenn einfach den Pfad, egal in welchem Ordner.“ Häng als Vorschlag die Dateien aus `inbox/` an, die zum Thema passen. Lies jede genannte Datei kurz an, damit die Idee im Issue stimmt. Unterlagen bleiben, wo sie liegen; ins Repo kommen sie erst mit der Spec.
4. **Frage 3 – Ziel:** „Was soll der <Nutzerbegriff> damit können, das heute nicht geht?“ Die Antwort wird später die Problemstellung der Spec.
5. **Issue anlegen** mit Titel = Spec-Name, Label `ready-to-grill` und diesem Text:

   ```markdown
   Spec-Idee, noch nicht gegrillt. Die Spec entsteht per `/spec #<nr>` in `docs/specs/`.

   **Idee:** <ein bis drei Sätze in Glossar-Begriffen>

   **Ziel:** <Antwort auf Frage 3>

   **Unterlagen (noch lokal, kommen mit der Spec ins Repo):** <volle Pfade und Links, oder Zeile weglassen>
   ```

6. **Aufs Board legen:** Status Specs, Bereich Spec.

Fertig, wenn die Karte in Specs liegt, mit Label `ready-to-grill` und Bereich Spec. Nenn dem Nutzer den Link und als nächsten Schritt `/spec #<nr>`.
