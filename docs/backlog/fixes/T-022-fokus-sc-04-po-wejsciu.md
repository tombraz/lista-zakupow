---
id: T-022
title: "Fokus na nagłówku SC-04 po wejściu linkiem (web)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-014]
layers: [web]
requirements: [N-04]
threats: []
screens: [SC-04, SC-01, SC-09]
related_tasks: [T-004, T-014]
---

# T-022 Fokus na nagłówku SC-04 po wejściu linkiem (web)

## Report

- **Actual:** SC-04 (regulamin) nie ma AppBar, więc nie dostaje obsługi fokusu z T-014. Po wejściu linkiem w tej samej karcie (SC-09 „Regulamin i polityka prywatności”, link w stopce SC-01 z `AuthPage`) fokus zostaje na `body`; czytnik ekranu nie ogłasza nowego ekranu.
- **Expected:** Po zmianie trasy fokus na `h1` „Regulamin…” (`tabIndex={-1}`) — source: `accessibility.md` „Build”: „Focus is managed on route changes” (WCAG 2.4.3), N-04; wzorzec z T-014 (`web.md`, „Pułapki”).
- **Steps to reproduce:**
  1. Zaloguj się, na SC-05 przejdź do SC-09 („Konto”).
  2. Klawiaturą przejdź do linku regulaminu i naciśnij Enter.
  3. `document.activeElement` to `body`.
- **Environment:** lokalnie; gałąź `epic/E-01-szkielet-i-wspolna-lista` (po T-014).
- **Evidence:** wykryte przy T-014 (sekcja „Root cause” i „Prevention” w `T-014-fokus-przy-zmianie-trasy.md`).

## Acceptance criteria

- [ ] AC1: Given SC-09, when użytkownik otwiera regulamin linkiem, then fokus jest na `h1` SC-04. — verified by: test RTL przejścia linkiem
- [ ] AC2: Given SC-04 otwarty z SC-01 (ta sama karta), when wejście linkiem, then fokus na `h1`; „Wróć” wraca na poprzedni ekran z jego własnym fokusem.
- [ ] AC3: No regression in: linki spisu treści przenoszą fokus do sekcji `h2` (SC-04 „Accessibility”); SC-02 otwiera regulamin w nowej karcie (bez zmian).

## TDD plan

**Seam:** router web (`renderApp` + nawigacja linkiem)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm vitest run apps/web/src/routeFocus.test.tsx`

## QA plan

- **Regression:** spis treści SC-04 (fokus na `h2`), „Wróć” do SC-01 / SC-09, SC-02 (nowa karta)
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
