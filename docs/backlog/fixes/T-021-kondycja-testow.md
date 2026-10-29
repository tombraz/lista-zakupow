---
id: T-021
title: "Stabilne i szybsze testy: limity czasu web i pula testowa API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change   # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-019, T-020]
layers: [web, backend]
requirements: []
threats: []
screens: []
related_tasks: [T-001, T-005, T-006, T-010]
---

# T-021 Stabilne i szybsze testy: limity czasu web i pula testowa API

## Report

- **Actual:** Testy web są niestabilne pod obciążeniem (dwa równoległe przebiegi: 7 i 5 czerwonych), a `asyncUtilTimeout: 3000` (`apps/web/test/setup.ts:9`) to maskuje; przebieg web ok. 60 s (budżet < 1 min), test limitu 500 (`ListScreen.add.test.tsx:187-195`) 2,6–6 s. Harness API używa produkcyjnej puli z `connectionTimeoutMillis` 3 s (`apps/api/test/database.ts:24` → `apps/api/src/db/pool.ts`): „Connection terminated due to connection timeout”; przebieg 196 s (budżet < 2 min), pliki do 7,6 s (budżet < 5 s).
- **Expected:** Zestawy mieszczą się w budżetach `docs/architecture/testing-strategy.md:12-13` i przechodzą pod obciążeniem bez podnoszenia limitów — source: `testing-strategy.md`
- **Steps to reproduce:**
  1. Dwa równoległe `pnpm vitest run --project web`.
  2. `pnpm vitest run --project api --project shared` z czasami.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #C3, #C4.

## Acceptance criteria

- [ ] AC1: Given pełny przebieg web, when uruchomiony dwa razy równolegle, then 0 czerwonych; jeden przebieg < 60 s. — verified by: pomiar w Evidence
- [ ] AC2: Given testy API, when pełny przebieg, then brak „Connection terminated”, całość < 2 min, pliki < 5 s albo wyjątek zapisany w `testing-strategy.md`. — verified by: pomiar w Evidence
- [ ] AC3: No regression in: `pnpm check`, CI (Linux, równolegle) i Windows.

## TDD plan

**Seam:** konfiguracja Vitest, `renderApp`, `apps/api/test/database.ts`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm vitest run`

## QA plan

- **Regression:** `pnpm check`, CI (Linux, równolegle) i Windows
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
