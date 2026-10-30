---
id: T-031
title: "E2E j03 „500th item” czeka na pełną listę; plik zgodny z Prettierem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-023]
---

# T-031 E2E j03 „500th item” czeka na pełną listę; plik zgodny z Prettierem

## Report

Źródło: QA T-025 runda 1 #4 i runda 2 #2.

- **Actual:**
  - `apps/web/e2e/j03-pozycje.spec.ts` › „SC-06 adding the 500th item moves focus to the limit warning (T-023)” jest niestabilny: po `addViaApi(…, 499)` czeka tylko na `toBeEnabled()` pola, więc wpisuje pozycję, gdy ekran ma np. 497 z 499 pozycji (reszta dochodzi na żywo). Własna pozycja nie jest wtedy 500., limit się nie pojawia i `toBeFocused()` pada.
  - `pnpm format:check` pada na tym pliku (`getByRole("status").filter(…)` sformatowane inaczej niż Prettier), więc `pnpm check` jest czerwony.
- **Expected:** test wpisuje 500. pozycję dopiero, gdy ekran pokazuje wszystkie 499; `pnpm format:check` zielony. — source: T-023 AC1, `docs/architecture/testing-strategy.md` (testy deterministyczne, czekanie na zdarzenie, nie na czas).
- **Steps to reproduce:**
  1. `pnpm test:e2e -g T-023` kilka razy (QA: 1 z 3 uruchomień czerwone; w `error-context` „497 do kupienia”).
  2. `pnpm format:check` → „Code style issues found” w `j03-pozycje.spec.ts`.
- **Environment:** lokalnie (Windows), gałąź `epic/E-01-szkielet-i-wspolna-lista` @ `387a8e8`.
- **Evidence:** raporty QA w `T-025-fokus-przy-limicie-list-i-uczestnikow.md` (runda 1 #4, runda 2 #2).

## Acceptance criteria

- [ ] AC1: Given lista z 499 pozycjami dodanymi przez API, when test wpisuje 500. pozycję, then robi to dopiero, gdy ekran pokazuje 499 pozycji, i test przechodzi w 5 kolejnych uruchomieniach. — verified by: E2E J-03 T-023 (`--repeat-each 5`)
- [ ] AC2: `pnpm format:check` zielony. — verified by: CI / `pnpm check`
- [ ] AC3: No regression in: J-03, T-023.

## TDD plan

**Seam:** E2E (Playwright), ekran SC-06

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `SC-06 adding the 500th item moves focus to the limit warning (T-023)` z czekaniem na 499 pozycji | E2E | Playwright | AC1 |

**Run:** `pnpm test:e2e -g T-023 --repeat-each 5`; `pnpm format:check`

## QA plan

- **Regression:** J-03, „SC-06 at 500 items…” (ten sam plik, ta sama metoda `addViaApi`).
- **Edge cases:** to samo czekanie w innych testach po `addViaApi` przy otwartej liście.
- **Platforms:** Chromium telefon i komputer (projekty Playwright), Windows i CI Linux.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
