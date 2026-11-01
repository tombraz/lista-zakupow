---
id: T-052
title: "CI: błędy 57P01 przy usuwaniu bazy testowej po items.limit.test.ts"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [N-03]
threats: []
screens: []
related_tasks: [T-021, T-047]
---

# T-052 CI: błędy 57P01 przy usuwaniu bazy testowej po items.limit.test.ts

## Report

Źródło: UAT E-01 (`docs/backlog/E-01-szkielet-i-wspolna-lista/UAT.md`, „Znane ograniczenia”), zaplanowane przez `/plan-backlog` 2026-11-01.

- **Actual:** CI na `main` po merge PR #1 (`b271ba3`, run 41225740398) czerwone: wszystkie 97 plików testów zielone, ale Vitest zgłasza 4 nieobsłużone błędy Postgresa `57P01 terminating connection due to administrator command` przy sprzątaniu po `apps/api/test/items.limit.test.ts`. Na `e1abd6a` ten sam zestaw był zielony — błąd niestabilny.
- **Expected:** sprzątanie bazy testowej (`useTestDatabase`, `DROP DATABASE … WITH (FORCE)`) nie zostawia żywych połączeń, a zerwane połączenie nie jest nieobsłużonym błędem procesu testów; `ci-ok` zależy tylko od wyników testów.
- **Steps to reproduce:** pełny `pnpm test` w CI; lokalnie próbować wielokrotnym przebiegiem `pnpm vitest run --project api items.limit` pod obciążeniem (np. równolegle z drugim przebiegiem).
- **Environment:** GitHub Actions, `main` @ `b271ba3`.
- **Evidence:** log runu 41225740398 (`tests`).

## Acceptance criteria

- [ ] AC1: Given plik testów, który zostawia połączenia w trakcie (np. żądania równoległe w `items.limit.test.ts`), when `afterAll` usuwa bazę, then żadne połączenie puli pliku nie jest już otwarte i proces testów nie dostaje nieobsłużonego `57P01`. — verified by: test regresyjny (pula z otwartym połączeniem przed `DROP … WITH (FORCE)`), który przed poprawką zgłasza nieobsłużony błąd
- [ ] AC2: Given 20 kolejnych przebiegów `pnpm vitest run --project api items.limit` (lokalnie) i 3 przebiegi pełnego CI, then zero nieobsłużonych błędów. — verified by: wynik przebiegów w Evidence
- [ ] AC3: Przyczyna źródłowa opisana w „Root cause” (które połączenie żyło i dlaczego), a nie samo wyciszenie błędu: obsługa zdarzenia `error` puli jest dopuszczalna tylko dla kodu `57P01` w trakcie świadomego `DROP` i z komentarzem. — verified by: przegląd QA
- [ ] AC4: No regression in: czas pełnego `pnpm test` (cele z `testing-strategy.md`), T-021 (pula testowa), T-047 (niestabilne testy ekranów web — bez zmian).

## TDD plan

**Seam:** helper `useTestDatabase` w `apps/api/test/database.ts` i pula `createPool`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `drops the test database without unhandled errors while a pool client is checked out` | integracja | Vitest + Testcontainers | AC1 |
| 2 | wielokrotny przebieg `items.limit` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api items.limit database`

## QA plan

- **Regression:** pełny `pnpm test` lokalnie dwa razy pod rząd; CI na gałęzi epiku.
- **Edge cases:** test przerwany przez timeout (pula z żądaniem w locie), pliki z `buildTestApp` (czy aplikacja testowa zamyka własne zasoby, np. Better Auth, `onClose`).
- **Platforms:** CI (Linux) i Windows lokalnie.

## Root cause

<Do uzupełnienia przez implementującego.>

## Implementation notes

- Kandydaci: aplikacja testowa (`buildTestApp`) nie jest zamykana (`app.close()`), więc żądania w locie trzymają klientów puli w chwili `pool.end()`; `pool.end()` czeka tylko na zwrot klientów, a `DROP … WITH (FORCE)` zabija te, które jeszcze żyją. Sprawdzić najpierw, nie zakładać.
- Bez zmiany limitów czasu testów jako „poprawki”.
