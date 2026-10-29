---
id: T-014
title: "Fokus na nagłówku ekranu po zmianie trasy (web)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [N-04]
threats: []
screens: [SC-05, SC-06, SC-07, SC-09]
related_tasks: [T-004, T-005, T-006, T-008, T-011]
---

# T-014 Fokus na nagłówku ekranu po zmianie trasy (web)

## Report

- **Actual:** Po przejściu linkiem między ekranami (SC-05 → SC-06 z pozycjami, SC-06 → SC-07, SC-05 → SC-09) fokus zostaje na `body`; czytnik ekranu nie ogłasza nowego ekranu. Tylko SC-08 przenosi fokus na `h1` (`InvitationScreen.tsx:58-69`).
- **Expected:** Po każdej zmianie trasy fokus na `h1` ekranu (AppBar, `tabIndex={-1}`), chyba że ekran sam ustawia fokus (pusty SC-06 → „Co kupić?”, T-011) — source: `accessibility.md` „Build”: „Focus is managed on route changes” (WCAG 2.4.3)
- **Steps to reproduce:**
  1. Zaloguj się, na SC-05 przejdź klawiaturą do karty listy z pozycjami i naciśnij Enter.
  2. `document.activeElement` to `body`.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #S2.

## Acceptance criteria

- [ ] AC1: Given SC-05, when użytkownik otwiera listę z pozycjami, then fokus jest na `h1` z nazwą listy. — verified by: test komponentu routera (RTL)
- [ ] AC2: Given SC-06, when przejście do SC-07 albo SC-09 i z powrotem, then fokus na `h1` nowego ekranu; pusty SC-06 nadal ustawia fokus w „Co kupić?” (T-011). — verified by: test komponentu + E2E J-02
- [ ] AC3: No regression in: T-011 (fokus pustej listy), SC-08 (własny fokus), powrót przyciskiem „wstecz” przeglądarki.

## TDD plan

**Seam:** router web (`renderApp` + nawigacja linkiem)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/web test`

## QA plan

- **Regression:** T-011 (fokus pustej listy), SC-08 (własny fokus), powrót przyciskiem „wstecz” przeglądarki
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
