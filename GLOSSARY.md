# Glossar

Begriffe des Entwicklungsprozesses, den dieses Paket liefert. Die Begriffe eines Projekts selbst (Spielwelt, Fachsprache) stehen im Glossar des Projekts.

**Projektart**
Die Art dessen, was ein Projekt entwickelt (zum Start nur *Spiel*; sonst *Anderes*). Eine Projektart ist eine Datei unter `skills/projekt-anlegen/vorlagen/projektarten/` und bündelt Bereiche, Assets-Spalte und Nutzerbegriff.
_Vermeiden:_ Projekttyp, Template

**Bereich**
Ein Feld auf dem Kanban-Board, das den Schwerpunkt eines Issues zeigt (z. B. Gameplay, Oberfläche, Technik). *Spec* und *Entscheidung* gibt es in jedem Projekt, die übrigen bringt die Projektart mit.
_Vermeiden:_ Kategorie, Komponente

**Inbox**
Der git-ignorierte Ordner `inbox/`, in den der Nutzer Dateien (Konzeptbilder, Notizen, PDFs) legt. Der Agent greift sie beim Arbeiten auf und verschiebt sie an ihren festen Ort im Repo, sobald sie in eine Spec oder ein Ticket eingehen.
_Vermeiden:_ Ablage, Eingangsordner

**Spec-Idee**
Eine noch nicht gegrillte Idee für eine Spec: ein Spec-Issue mit Label `ready-to-grill` in der Spalte Specs, angelegt per `/spec-idee`.
_Vermeiden:_ Feature-Wunsch, Vorschlag

**Projektkonfiguration**
Die Markdown-Dateien unter `docs/agents/` mit den Werten eines Projekts (Repo, Board- und Feld-IDs, Labels, Bereiche, Nutzerbegriff). `/projekt-anlegen` schreibt sie, die Skills lesen sie.
_Vermeiden:_ Settings, Config

**Nutzerbegriff**
Das Wort, mit dem ein Projekt die Menschen bezeichnet, die das Ergebnis benutzen (Standard „Nutzer“, bei Spielen „Spieler“). `/spec-idee` fragt damit nach dem Ziel einer Idee.
_Vermeiden:_ Zielgruppe, Persona
