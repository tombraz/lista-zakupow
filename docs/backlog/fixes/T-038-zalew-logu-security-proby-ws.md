---
id: T-038
title: "Próby połączenia WS ponad limit zalewają log security"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-21, TH-25]
screens: []
related_tasks: [T-033, T-035, T-037]
---

# T-038 Próby połączenia WS ponad limit zalewają log security

## Report

Źródło: QA T-037, runda 1, uwaga 4 (2026-10-30); przyjęte przez użytkownika jako osobne zadanie. Wzorzec sprzed T-037 (`connectionsPerSession`, T-033).

- **Actual:** każda próba połączenia ponad `connectionsPerSession` albo `socketsPerSession` zapisuje jedno zdarzenie `limit_reached` w logu `security` (`limitLog` w `apps/api/src/modules/na-zywo/http/routes.ts`: raz na połączenie). Klient robiący ~100 upgrade'ów/s na sesję (pomiar lokalny z QA T-036) daje ~100 linii `security`/s na sesję; liczba upgrade'ów sesji nie jest ograniczona (każdy kosztuje też zapytanie o sesję do bazy).
- **Expected:** nadużycie zostaje w logu `security` (TH-21), ale jego objętość jest ograniczona: np. limit upgrade'ów na sesję / IP w oknie czasu (odrzucenie przed upgrade'em) albo jedno zdarzenie na sesję i limit w oknie czasu z licznikiem prób — do wyboru w `/fix`. — source: TH-21, TH-25
- **Steps to reproduce:**
  1. Sesja z kompletem `socketsPerSession` gniazd (`closeWithoutFin`, `apps/api/test/live.ts`).
  2. Pętla kolejnych upgrade'ów tej sesji (`closeCode`).
  3. Liczba wpisów `limit_reached` w logu `security` rośnie liniowo z liczbą prób.
- **Environment:** lokalnie, Testcontainers; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-037, sekcja QA round 1, uwaga 4.

## Acceptance criteria

- [ ] AC1: Given sesja ponad limitem połączeń / gniazd WS, when wykona N kolejnych prób połączenia w krótkim czasie, then log `security` ma ograniczoną liczbę wpisów (niezależną od N) w oknie czasu, a każdy wpis ma kształt `logLimitEvent` (`limit`, `route`, `userId`). — verified by: `live.limits.test.ts`
- [ ] AC2: No regression in: T-033, T-035, T-036, T-037, `limits.security.test.ts` (nadal dokładnie jedno zdarzenie na pierwsze przekroczenie).

## TDD plan

**Seam:** WebSocket (`closeWithoutFin`, `closeCode`, `connectLive`) + `captureLogs()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | wiele prób ponad limit jednej sesji → ograniczona liczba wpisów `limit_reached` | integracja | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api live.limits limits.security`

## QA plan

- **Regression:** T-033, T-035, T-036, T-037, limity połączeń na żywo.
- **Edge cases:** `connectionsPerSession` vs `socketsPerSession`; dwie sesje tej samej osoby; nowy limit (jeśli powstanie) w `LIVE_LIMITS` / `RATE_LIMITS` i w tabeli `limits.security.test.ts`.
- **Platforms:** API.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
