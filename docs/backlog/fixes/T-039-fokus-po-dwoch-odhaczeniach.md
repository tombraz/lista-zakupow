---
id: T-039
title: "Fokus spada na body po szybkim odhaczeniu dwóch sąsiednich pozycji"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-08]
threats: []
screens: [SC-06]
related_tasks: [T-007, T-030]
---

# T-039 Fokus spada na body po szybkim odhaczeniu dwóch sąsiednich pozycji

## Report

Źródło: T-030, znalezisko poza zakresem, potwierdzone przez QA T-030 runda 1 (minor); przyjęte przez użytkownika jako osobne zadanie (2026-10-30). Luka istniała przed T-030.

- **Actual:** `useCheckItem` liczy cel fokusu (`neighbourOf`) w chwili kliknięcia. Gdy użytkownik odhaczy Chleb, a przed odpowiedzią API sąsiednie Mleko, celem dla Mleka jest Chleb, który po zapisie jest już w zwiniętym „Kupione”. `useCheckboxFocus` nie znajduje checkboxa i fokus zostaje na usuniętym przycisku Mleka (w przeglądarce spada na `body`) (`apps/web/src/screens/SC-06-lista/useCheckItem.ts`, `neighbourOf`; `useCheckboxFocus.ts`).
- **Expected:** po odhaczeniu fokus trafia na następną nieodhaczoną pozycję (przy ostatniej na poprzednią, bez nich na „Kupione (N)”), także gdy cel wyliczony w chwili kliknięcia został w międzyczasie odhaczony — source: SC-06 „Accessibility”, WCAG 2.4.3
- **Steps to reproduce:**
  1. Lista: Jajka, Chleb, Mleko (do kupienia), odpowiedzi `PATCH` wstrzymane (`heldResponse()`).
  2. Kliknąć „Odhacz Chleb”, potem „Odhacz Mleko”, zwolnić odpowiedzi.
  3. Fokus nie jest na żadnym checkboxie ani na „Kupione (2)”.
- **Environment:** lokalnie; gałąź `epic/E-01-szkielet-i-wspolna-lista` po T-030.
- **Evidence:** test „checks two different items in quick succession (T-030)” celowo nie sprawdza fokusu; przy asercji fokusu na „Odhacz Jajka” fokus jest na `h1`.

## Acceptance criteria

- [ ] AC1: Given dwie sąsiednie pozycje odhaczane szybko po sobie, when obie odpowiedzi przyjdą, then fokus jest na nieodhaczonej pozycji (Jajka) albo, gdy takiej nie ma, na „Kupione (N)”. — verified by: test komponentu SC-06
- [ ] AC2: No regression in: fokus po pojedynczym odhaczeniu (następna / poprzednia / „Kupione”), zdarzenie na żywo przed odpowiedzią API (F-14), T-007, T-030.

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW i `heldResponse()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `moves focus to a still unchecked item when two neighbours are checked quickly (T-039)` | komponent | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm vitest run --project web ListScreen.check`

## QA plan

- **Regression:** J-03, fokus po odhaczeniu, ogłoszenia, `ListScreen.live` (pozycja przeniesiona na żywo przed odpowiedzią).
- **Edge cases:** odhaczenie wszystkich pozostałych pozycji szybko po sobie (cel: „Kupione (N)”); odhaczenie i odznaczenie naraz.
- **Platforms:** Chrome na komputerze, telefon (dotyk), czytnik ekranu.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note
