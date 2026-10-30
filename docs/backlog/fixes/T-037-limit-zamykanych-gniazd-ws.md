---
id: T-037
title: "Gniazda WS w trakcie zamykania bez limitu na sesję"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-25]
screens: []
related_tasks: [T-033, T-036]
---

# T-037 Gniazda WS w trakcie zamykania bez limitu na sesję

## Report

Źródło: QA T-036, runda 1, uwaga 3 (2026-10-30); przyjęte przez użytkownika jako osobne zadanie. Luka istniała przed T-036.

- **Actual:** jedna sesja może utrzymywać dowolnie wiele gniazd WebSocket w trakcie zamykania (przyjętych i zamkniętych przez klienta albo odrzuconych kodem 1008): klient, który nie wysyła FIN, trzyma każde gniazdo do `closeTimeout` biblioteki `ws` (30 s). Lokalnie ~100 upgrade'ów/s na sesję; próba z 200 połączeniami: 200 gniazd TCP po 5 s.
- **Expected:** liczba zasobów połączeń na sesję ograniczona (TH-25), także dla gniazd w trakcie zamykania. — source: TH-25
- **Steps to reproduce:** pętla `closeWithoutFin(url, { cookie })` (`apps/api/test/live.ts`) dla jednej sesji; liczba otwartych gniazd TCP po stronie serwera rośnie.
- **Environment:** lokalnie, Testcontainers; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-036, sekcja QA round 1.

## Acceptance criteria

- [ ] AC1: Given sesja, która otwiera i zamyka połączenia bez FIN, when przekroczy ustalony limit, then kolejne gniazda nie zostają utrzymywane (np. krótki `closeTimeout` / `terminate` po wymianie ramek close / limit upgrade'ów na sesję — do wyboru w `/fix`), a przekroczenie limitu trafia do logu `security` przez `logLimitEvent`. — verified by: `live.limits.test.ts`
- [ ] AC2: No regression in: T-033, T-036, `limits.security.test.ts`.

## TDD plan

**Seam:** WebSocket (`closeWithoutFin`, `connectLive`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `drops a socket over the per-session socket limit, counting closing ones` — `socketsPerSession` gniazd `closeWithoutFin`, kolejne zerwane (1006) + `limit_reached` / `socketsPerSession` w logu `security` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `releases closing sockets after the close timeout` — po `closeTimeoutSeconds` zamykane gniazda zwolnione, nowe połączenie otwarte | integracja | Vitest + Testcontainers | AC1 |
| 3 | scenariusz `socketsPerSession` w `limits.security.test.ts`; `closeTimeoutSeconds` w `NOT_ABUSE_LIMITS` | integracja | Vitest + Testcontainers | AC1, AC2 |

**Run:** `pnpm vitest run --project api live.limits limits.security`

## QA plan

- **Regression:** T-033, T-036, limity połączeń na żywo.
- **Edge cases:** odrzucone 1008 vs przyjęte i zamknięte; wylogowanie (`closeSession`); nowy limit w `LIVE_LIMITS` i w tabeli `limits.security.test.ts`.
- **Platforms:** API.

## Root cause

Jedyny limit zasobów na sesję, `connectionsPerSession` (`LiveHub.attach`), liczy otwarte połączenia; gniazdo odrzucone 1008 nigdy nie trafia do hubu, a zamykane przestaje się liczyć od ramki close (T-036). `ws` trzyma takie gniazdo do FIN klienta, najdłużej domyślny `closeTimeout` 30 s, więc klient bez FIN mnożył gniazda jednej sesji bez ograniczenia. Luka od T-009 (pierwsza wersja `routes.ts`): limit projektowano jako liczbę połączeń w hubie, nie gniazd TCP; testy limitów nie miały klienta, który nie zamyka TCP, aż do `closeWithoutFin` z T-036.

Poprawka (`routes.ts`): `SocketsPerSession` liczy gniazda sesji od upgrade'u do `close` w `ws` (zamknięcie TCP), także odrzucone i zamykane; ponad `LIVE_LIMITS.socketsPerSession` (10) gniazdo jest zrywane od razu (`terminate`, bez wymiany ramek close, więc nie czeka na klienta), a `limitLog` zapisuje `limit_reached` / `socketsPerSession`. Do tego `closeTimeout` `ws` = `LIVE_LIMITS.closeTimeoutSeconds` (2 s), żeby prawidłowy klient z zagubionym FIN nie blokował slotów przez 30 s. Opcja jest w `ws` 8.22, `@types/ws` 8.18.2 (najnowszy) jej nie zna — typ rozszerzony lokalnie. Inne miejsca: innych liczników gniazd nie ma; gniazdo bez sesji (`!session`) kończy się 1008 przed limitem, ale `preValidation` już odrzuca je 401.

## Evidence

- Red: `drops a socket over the per-session socket limit, counting closing ones` → `Error: connection still open` (11. gniazdo przyjęte i trzymane).
- Spot-check testu #2: bez opcji `closeTimeout` → `AssertionError: promise resolved "1006" instead of rejecting` (sloty zajęte do 30 s).
- Green: `pnpm vitest run --project api live limits.security` 10 plików / 51 testów; `pnpm test` 92 pliki / 496 testów zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm --filter @lista/api build` OK.

## Prevention

## Incident note

<Nie dotyczy.>
