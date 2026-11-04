---
id: T-094
title: "SC-06: uczestnik ma ikonę „Uczestnicy” i „Opuść listę” w menu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-13]
threats: [TH-04]
screens: [SC-06, SC-07]
related_tasks: [T-005, T-057, T-059]
---

# T-094 SC-06: uczestnik ma ikonę „Uczestnicy” i „Opuść listę” w menu

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, P1 (blocker). Gałąź: `epic/E-02-konto-i-uczestnicy` (po merge PR #14 zsynchronizowana z `main`).

- **Actual:** na SC-06 akcje AppBar (ikona „Uczestnicy” → SC-07 i menu „Więcej opcji”) są tylko dla `role === "owner"` (`apps/web/src/screens/SC-06-lista/ListScreen.tsx:44-54`). SC-05 nie linkuje do SC-07. Uczestnik dojdzie do SC-07 (lista uczestników, „Opuść listę”) tylko przez wpisanie adresu; E2E T-059 też wchodzi przez `goto` (`apps/web/e2e/sc07-uczestnicy.spec.ts:154`).
- **Expected:**
  - SC-06, Layout pkt 1: AppBar ma ikony „Uczestnicy” → SC-07 i „Więcej opcji” dla każdej osoby z dostępem (`docs/design/screens/SC-06-lista.md:19`).
  - Menu uczestnika zawiera „Opuść listę” (→ jak na SC-07) (`SC-06-lista.md:26`, Copy `menu.leave` `:102`).
  - Źródło: F-13 (`docs/product/BRD.md:229`, `:232`); E-01 przekazał to do E-02 (`T-005-moje-listy.md:175`).
- **Steps to reproduce:**
  1. Tomek przyjmuje zaproszenie Ani do „Dom” i otwiera SC-06 tej listy.
  2. W AppBar nie ma ani ikony „Uczestnicy”, ani „Więcej opcji”.
- **Environment:** lokalnie, web; `f7485f3`.

## Acceptance criteria

- [ ] AC1: Given uczestnik na SC-06, then AppBar ma ikonę „Uczestnicy” prowadzącą do SC-07 tej listy; given właściciel, then bez zmian. — verified by: test komponentu (MSW)
- [ ] AC2: Given uczestnik na SC-06, when otwiera „Więcej opcji”, then widzi tylko „Opuść listę” (bez „Zmień nazwę listy” i „Usuń listę”). — verified by: test komponentu
- [ ] AC3: Given uczestnik, when „Opuść listę” → ConfirmDialog „Opuścić listę „{nazwa}”? Żeby wrócić, potrzebujesz nowego zaproszenia.” → „Opuść”, then zachowanie jak na SC-07 (T-059 AC3): przejście na SC-05 przez `replace`, bez tej listy; „Anuluj” zwraca fokus na „Więcej opcji”; błąd serwera — komunikat `leave.error` w oknie, okno zostaje; offline — pozycja nieaktywna. Logika wyjścia jest jedna dla SC-06 i SC-07 (`useLeaveList`). — verified by: test komponentu (MSW)
- [ ] AC4: Given E2E podróży uczestnika, when wchodzi z SC-06 na SC-07 kliknięciem ikony „Uczestnicy” i opuszcza listę z menu SC-06, then oba przejścia działają bez `goto` na ekran docelowy; axe bez naruszeń na otwartym menu. — verified by: E2E Playwright + axe
- [ ] AC5: No regression in: T-057 (podgląd uczestników), T-059 (wyjście z SC-07, druga karta), menu właściciela na SC-06 (T-005).

## TDD plan

**Seam:** ekran SC-06 z MSW; E2E `sc07-uczestnicy.spec.ts`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | uczestnik widzi ikonę „Uczestnicy” i menu z samym „Opuść listę” | component | Vitest + RTL + MSW | AC1, AC2 |
| 2 | „Opuść listę” z SC-06: sukces, Anuluj, błąd, offline | component | Vitest + RTL + MSW | AC3 |
| 3 | podróż uczestnika przez UI (bez `goto` na SC-07) | e2e | Playwright + axe | AC4 |

**Run:** `pnpm vitest run --project web SC-06 && pnpm -C apps/web e2e sc07-uczestnicy`

## QA plan

- **Regression:** J-04, T-057, T-059, T-005 (menu właściciela), T-063 (offline na SC-06).
- **Edge cases:** rola zmienia się na żywo (usunięcie uczestnika przy otwartym menu); lista się jeszcze ładuje (`list` undefined) — bez akcji.
- **Platforms:** web, szerokość telefonu.

## Root cause

## Evidence

## Prevention

Propozycje z przeglądu (P1): kontrola przekazań „to E-xx” w `backlog-check` (T-099) i E2E przez UI zamiast `goto`.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
