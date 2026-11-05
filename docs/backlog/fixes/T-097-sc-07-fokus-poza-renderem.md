---
id: T-097
title: "SC-07: zamknięcie okna i fokus po zniknięciu osoby w efekcie, nie w renderze"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-13]
threats: []
screens: [SC-07]
related_tasks: [T-058, T-079]
---

# T-097 SC-07: zamknięcie okna i fokus po zniknięciu osoby w efekcie, nie w renderze

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, S3 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** gdy osoba z otwartego okna „Usunąć …?” znika (odeszła, usunięta w innej karcie), `Members` w trakcie renderu woła `setConfirming(null)` i `focusAfter(confirming)`. `focusAfter` mutuje zapamiętaną kolejność (`orders.current`) i przenosi fokus (`apps/web/src/screens/SC-07-uczestnicy/Members.tsx:38-41`). W `StrictMode` (`apps/web/src/main.tsx:15`) render wykonuje się dwa razy. Druga kopia może już nie znaleźć kolejności i przenieść fokus na nagłówek zamiast na następny wiersz. To ryzyko dla WCAG 2.4.3, w przeglądarce niesprawdzone. Testy renderują bez `StrictMode`.
- **Expected:** efekty uboczne (fokus, mutacja refów) tylko w efekcie. Źródło: `docs/architecture/layers/web.md`, „Pułapki” (StrictMode: „w efekcie, nie w renderze”); T-058 (fokus po usunięciu).

## Acceptance criteria

- [ ] AC1: Given SC-07 właściciela w `StrictMode` z otwartym oknem usunięcia osoby B, when B znika z listy (zdarzenie na żywo), then okno się zamyka, a fokus trafia na wiersz po B (albo na nagłówek, gdy B był ostatni) — tak samo jak bez `StrictMode`. Test czerwony przed poprawką albo, jeśli nie da się go zaczerwienić, opis w Evidence, dlaczego. — verified by: test komponentu renderowany w `<StrictMode>`
- [ ] AC2: `Members.tsx` nie wywołuje `setState` ani funkcji fokusu w ciele renderu. — verified by: przegląd QA
- [ ] AC3: No regression in: T-058 (fokus po usunięciu, Anuluj), T-079, `ParticipantsScreen.*.test.tsx`.

## TDD plan

**Seam:** ekran SC-07 z MSW i sztucznym zdarzeniem `members.changed`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | osoba znika przy otwartym oknie, render w StrictMode → fokus na następny wiersz | component | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm vitest run --project web SC-07`

## QA plan

- **Regression:** T-058, T-059, T-079.
- **Edge cases:** znika ostatni uczestnik; znika osoba inna niż ta w oknie (okno zostaje).
- **Platforms:** web.

## Root cause

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
