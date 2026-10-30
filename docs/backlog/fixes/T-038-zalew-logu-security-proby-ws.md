---
id: T-038
title: "Próby połączenia WS ponad limit zalewają log security"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: in-progress    # todo | in-progress | in-qa | done | blocked
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
| 1 | `logs repeated attempts over the socket limit once per session` — komplet `socketsPerSession` gniazd `closeWithoutFin`, 20 kolejnych prób (1006) → jeden wpis `limit_reached` / `socketsPerSession` z `route`, `userId` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `logs repeated attempts over the connection limit once per window` — komplet `connectionsPerSession`, 3 próby (1008) → jeden wpis; zegar testowy przesunięty o `limitLogWindowSeconds` → kolejna próba daje drugi wpis | integracja | Vitest + Testcontainers | AC1 |
| 3 | `limitLogWindowSeconds` w `NOT_ABUSE_LIMITS` (`limits.security.test.ts`) i w `LIVE_LIMITS` (`packages/shared/test/live.test.ts`) | jednostkowy / integracja | Vitest | AC2 |

**Run:** `pnpm vitest run --project api live.limits limits.security`

## QA plan

- **Regression:** T-033, T-035, T-036, T-037, limity połączeń na żywo.
- **Edge cases:** `connectionsPerSession` vs `socketsPerSession`; dwie sesje tej samej osoby; nowy limit (jeśli powstanie) w `LIVE_LIMITS` / `RATE_LIMITS` i w tabeli `limits.security.test.ts`.
- **Platforms:** API.

## Root cause

`limitLog` (`na-zywo/http/routes.ts`, T-033) deduplikował zdarzenia tylko w obrębie jednego połączenia (`logged` w domknięciu tworzonym dla każdego gniazda). Limity `connectionsPerSession` i `socketsPerSession` odrzucają całe połączenie, więc każda próba to nowe domknięcie i nowa linia w logu `security`: objętość logu rosła liniowo z liczbą upgrade'ów sesji. Testy limitów (T-033, T-037) sprawdzały wpis po jednym przekroczeniu (`toEqual([…])` po jednej próbie), żaden nie powtarzał próby ponad limit.

Poprawka: `LimitLogWindow` (wspólny dla trasy, zegar `Clock` z `app.ts`) przepuszcza najwyżej jedno zdarzenie na sesję i klucz limitu w oknie `LIVE_LIMITS.limitLogWindowSeconds` (60 s); wygasłe okna sprząta przy zapisie, więc mapa ma najwyżej tyle wpisów, ile zdarzeń zapisano w ostatniej minucie. Kształt zdarzenia bez zmian (`logLimitEvent`, `limit`, `route`, `userId`); okno liczy się per sesja, więc dwie sesje tej samej osoby logują osobno. Wybrano deduplikację zamiast limitu upgrade'ów przed upgrade'em: mniejsza zmiana, bez nowego limitu nadużyć ani odpowiedzi 429 dla klienta web.

**Poza zakresem / inne wystąpienia:**

- Koszt próby (zapytanie o sesję w `preValidation` przy każdym upgradzie) zostaje — poprawka ogranicza log, nie liczbę upgrade'ów. Limit upgrade'ów na IP / sesję to osobna decyzja (TH-25).
- Ten sam wzorzec w HTTP: `perIp` (`http/rate-limit.ts`) i most Better Auth (`auth-routes.ts`) zapisują `rate_limited` przy każdej odpowiedzi 429, więc zalew 429 z jednego IP to linia logu na żądanie. Inna warstwa (`http`, klucz IP, nie sesja) — propozycja osobnego taska, nie naprawione tutaj.

## Evidence

- Red #1: `logs repeated attempts over the socket limit once per session` → `AssertionError: expected [ { level: 40, …(10) }, …(19) ] to deeply equal [ ObjectContaining{…} ]` (20 wpisów `limit_reached` / `socketsPerSession`).
- Red #2: `logs repeated attempts over the connection limit once per window` → `AssertionError: expected [ { level: 40, …(10) }, …(2) ] to have a length of 1 but got 3`.
- Green: `pnpm vitest run --project api live.limits limits.security` 2 pliki / 30 testów; `pnpm test` 92 pliki / 502 testy zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm quality`, `pnpm --filter @lista/api build` OK.
- Regresja: istniejące testy T-033 / T-035 / T-037 (dokładnie jedno zdarzenie przy pierwszym przekroczeniu) i tabela `limits.security.test.ts` zielone bez zmian asercji.

## Prevention

## Incident note

<Nie dotyczy.>
