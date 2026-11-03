---
id: T-068
title: "CodeQL: alert js/missing-rate-limiting w pliku testowym"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, infra]
requirements: [N-03]
threats: [TH-22]
screens: []
related_tasks: [T-002]
---

# T-068 CodeQL: alert js/missing-rate-limiting w pliku testowym

## Report

Źródło: UAT E-01 (`UAT.md`, „Znane ograniczenia”), zaplanowane przez `/plan-backlog` 2026-11-01 na prośbę właściciela.

- **Actual:** informacyjny check „CodeQL” jest czerwony przez alert `js/missing-rate-limiting` w `apps/api/test/unexpected-error.test.ts`: test rejestruje w aplikacji testowej trasę `GET /api/v1/test/failing-query` z zapytaniem do bazy i bez limitu. To fałszywy alarm (kod testu, nie produkcyjny), ale czerwony check uczy ignorowania CodeQL.
- **Expected:** check „CodeQL” zielony bez osłabiania analizy kodu produkcyjnego.
- **Environment:** GitHub Actions, `main` @ `c3dbc86`.

## Acceptance criteria

- [ ] AC1: Given PR z tą zmianą, then check „CodeQL” zielony, a alert zamknięty (naprawiony lub wykluczony z uzasadnieniem w konfiguracji). — verified by: przebieg CI w Evidence
- [ ] AC2: Given poprawka, then analiza nadal obejmuje cały kod produkcyjny (`apps/*/src`, `packages/*/src`) i nie wyłącza reguły `js/missing-rate-limiting` globalnie; jeśli wykluczane są katalogi testów, to tylko one, opisane w `pipeline.md`. — verified by: przegląd konfiguracji CodeQL przez QA
- [ ] AC3: Given test `unexpected-error.test.ts`, then nadal dowodzi tego co wcześniej (500 `internal` z `requestId`, brak treści użytkownika w odpowiedzi i logach). — verified by: test przechodzi; ewentualna zmiana testu nie zmienia asercji
- [ ] AC4: Kontrola: celowo dodana trasa bez limitu w `apps/api/src` na gałęzi `ci-test/T-068-*` nadal daje alert (dowód, że analiza produkcji działa); PR testowy zamknięty bez merge. — verified by: link do przebiegu w Evidence

## TDD plan

**Seam:** konfiguracja CodeQL w CI (`.github/`), test `unexpected-error.test.ts`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `unexpected-error.test.ts` bez zmian asercji | integration | Vitest + Testcontainers | AC3 |
| 2 | przebieg CodeQL na PR (zielony) i na gałęzi kontrolnej (alert) | CI | GitHub Actions | AC1, AC4 |

**Run:** `pnpm vitest run --project api unexpected-error`; CI na PR

## QA plan

- **Regression:** wymagany check `codeql` i `ci-ok`; pozostałe skany z `pipeline.md`.
- **Edge cases:** czy wykluczenie testów nie wyklucza też `apps/api/scripts` lub fabryk używanych w produkcji.

## Root cause

<Do uzupełnienia przez implementującego.>

## Implementation notes

- Do wyboru: `paths-ignore` dla katalogów testów w konfiguracji CodeQL albo przepisanie testu tak, by nie rejestrował trasy z zapytaniem (np. awaria wywołana przez istniejącą trasę). Wybór i powód zapisać w `pipeline.md`.
- Gałąź kontrolna wg „Git workflow” w `tech-stack.md` (`ci-test/T-NNN-<przypadek>`); push robi właściciel.
