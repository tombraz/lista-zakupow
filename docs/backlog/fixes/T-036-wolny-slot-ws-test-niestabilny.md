---
id: T-036
title: "Niestabilny test: zwolnienie slotu połączenia na żywo po zamknięciu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-25]
screens: []
related_tasks: [T-033, T-035]
---

# T-036 Niestabilny test: zwolnienie slotu połączenia na żywo po zamknięciu

## Report

Źródło: pełny przebieg testów w T-035 (2026-10-30), przyjęte przez użytkownika jako osobne zadanie.

- **Actual:** `apps/api/test/live.limits.test.ts › frees a slot when a connection closes` padł raz w pełnym przebiegu `pnpm test`; w izolacji (3×) i w kolejnym pełnym przebiegu zielony.
- **Expected:** test deterministyczny; po zamknięciu jednego z `connectionsPerSession` połączeń nowe połączenie zostaje otwarte. — source: T-033 / TH-25
- **Steps to reproduce:** `pnpm test` (pełny zestaw, pod obciążeniem); nie odtwarza się w izolacji.
- **Environment:** lokalnie, Windows; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-035, sekcja Evidence. Hipoteza: klient widzi zamknięcie (`first.closed()`), zanim serwer obsłuży `close` i wywoła `hub.detach`, więc kolejne `connect()` trafia na pełny limit. Do potwierdzenia: test czy kod (czy limit może odrzucić prawidłowego klienta po szybkim ponownym połączeniu).

## Acceptance criteria

- [ ] AC1: Given 5 otwartych połączeń sesji, when klient zamknie jedno i od razu połączy się ponownie, then nowe połączenie zostaje otwarte — deterministycznie (pętla wielu powtórzeń bez błędu). — verified by: `live.limits.test.ts`
- [ ] AC2: No regression in: T-033, `live.limits.test.ts`, `limits.security.test.ts` (`connectionsPerSession`).

## TDD plan

**Seam:** WebSocket (`connectLive`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `frees a slot when the closing handshake ends, before TCP closes` — klient `closeWithoutFin` (`test/live.ts`) kończy zamknięcie WS, ale nie wysyła FIN, więc serwer nie emituje `close` (utrwalone okno wyścigu) | integracja | Vitest + Testcontainers | AC1 |
| 2 | `frees a slot when a connection closes` powtórzony 30× ręcznie (`-t "frees a slot"`), bez pętli w kodzie: test #1 utrwala wyścig deterministycznie | integracja | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api live.limits`

## QA plan

- **Regression:** T-033, limity połączeń na żywo.
- **Edge cases:** zamknięcie przez klienta vs przez serwer; wylogowanie (`closeSession`).
- **Platforms:** API.

## Root cause

Kod, nie tylko test: `ws` emituje `close` gniazda serwera dopiero po zamknięciu TCP (po FIN klienta), a dopiero wtedy `routes.ts` woła `hub.detach`. Klient kończy zamknięcie niezależnie (jego `close` może przyjść przed obsługą FIN przez serwer), więc szybkie ponowne połączenie trafiało na pełny limit `connectionsPerSession` i dostawało `1008` — także prawdziwy klient (np. telefon przy zerwanej sieci, gdy FIN dociera z opóźnieniem do 30 s `closeTimeout`). `LiveHub.attach` liczył każde połączenie z mapy, także zamykane. Testy tego nie łapały, bo jedyny test czekał na `close` klienta, a w normalnych warunkach serwer obsługuje FIN szybciej niż nowy upgrade z zapytaniem o sesję do bazy — wyścig wychodził tylko pod obciążeniem.

Poprawka: `LiveConnection.open` (`WsConnection`: `readyState === OPEN`); `attach` liczy tylko otwarte połączenia sesji. Serwer przechodzi w `CLOSING` przy odebraniu ramki close, zanim odeśle własną, więc klient nie może zobaczyć zamknięcia, zanim slot jest wolny. Inne miejsca: `closeSession` robi `detach` od razu; innych liczników połączeń nie ma.

## Evidence

- Red: `frees a slot when the closing handshake ends, before TCP closes` → `AssertionError: promise resolved "1008" instead of rejecting` (live.limits.test.ts:75).
- Green: `pnpm vitest run --project api live.limits` 10/10; testy „frees a slot” 30× z rzędu: 30/30 zielone.
- `pnpm test` 92 pliki / 493 testy zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm --filter @lista/api build` OK.

## Prevention

Co by zapobiegło: wiedza, że `close` serwera w `ws` przychodzi dopiero po TCP, i test deterministyczny okna zamykania zamiast testu, który czeka na `close` klienta. Reguła lint nie jest wykonalna (zależność od semantyki zdarzeń biblioteki). Przyjęte przez użytkownika: wpis w „Pułapkach” `docs/architecture/layers/backend.md`; pomocnik `closeWithoutFin` zostaje w `test/live.ts` do kolejnych testów. Luka TH-25 z QA rundy 1 (uwaga 3) → T-037.

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

Odtworzenie: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm --filter @lista/api build` — OK. `pnpm test` dwukrotnie: 92 pliki / 493 testy zielone. `pnpm vitest run --project api live.limits` 10/10.

Kryteria:

- AC1 — **pass.** Nowy test `frees a slot when the closing handshake ends, before TCP closes` deterministycznie utrwala okno wyścigu (ramka close w obie strony, bez FIN). Spot-check: przywrócenie starego filtra w `LiveHub.attach` → test czerwony (`promise resolved "1008" instead of rejecting`), po `git checkout` zielony. Pętla 15× `-t "frees a slot"`: 15/15.
- AC2 — **pass.** Pełny zestaw dwukrotnie zielony, w tym `live.limits.test.ts` (limit 5 otwartych połączeń nadal egzekwowany) i `limits.security.test.ts`.

Root cause wyjaśnia, dlaczego testy nie łapały błędu; test reprodukujący pada bez poprawki (spot-check wyżej).

TH-25 (próba nadużycia, lokalnie, Testcontainers): jedna sesja, 200 połączeń `closeWithoutFin` pod rząd → 200 upgrade'ów przyjętych w ~2 s, serwer trzyma 200 gniazd TCP także po 5 s. Ten sam przebieg na kodzie sprzed poprawki: również 200 gniazd (odrzucone 1008 też czekają na FIN do `closeTimeout` 30 s), a dodatkowo prawidłowy klient dostaje 1008. Poprawka nie osłabia więc TH-25; limit otwartych połączeń działa. Plik próby usunięty.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | testy | Test #2 z planu TDD („frees a slot when a connection closes” 30×) nie jest w kodzie; powtórzenia wykonane tylko ręcznie. Ryzyko niskie: test #1 deterministycznie pokrywa wyścig. | `git show 2fca9a7 -- apps/api/test/live.limits.test.ts` | Plan zgodny z kodem albo zaktualizowany plan |
| 2 | minor | dokumentacja | Sekcja `## Prevention` pusta. | plik zadania | Krótka notka (np. „nie dotyczy” albo przyczyna) |
| 3 | note | bezpieczeństwo (TH-25) | Istniejąca wcześniej luka: gniazda w stanie zamykania (przyjęte albo odrzucone 1008) nie mają limitu na sesję; klient bez FIN trzyma je do 30 s (`closeTimeout` `ws`), ~100 upgrade'ów/s na sesję lokalnie. | próba opisana wyżej: 200/200 gniazd przed i po poprawce | Rozważyć krótszy `closeTimeout` albo `terminate` po wymianie ramek close / limit upgrade'ów na sesję |

`git status` czysty poza plikiem zadania.
