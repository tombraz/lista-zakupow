---
id: T-038
title: "Próby połączenia WS ponad limit zalewają log security"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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
- Ten sam wzorzec w HTTP: `perIp` (`http/rate-limit.ts`) i most Better Auth (`auth-routes.ts`) zapisują `rate_limited` przy każdej odpowiedzi 429, więc zalew 429 z jednego IP to linia logu na żądanie. Inna warstwa (`http`, klucz IP, nie sesja) — osobny task T-040, nie naprawione tutaj.

## Evidence

- Red #1: `logs repeated attempts over the socket limit once per session` → `AssertionError: expected [ { level: 40, …(10) }, …(19) ] to deeply equal [ ObjectContaining{…} ]` (20 wpisów `limit_reached` / `socketsPerSession`).
- Red #2: `logs repeated attempts over the connection limit once per window` → `AssertionError: expected [ { level: 40, …(10) }, …(2) ] to have a length of 1 but got 3`.
- Green: `pnpm vitest run --project api live.limits limits.security` 2 pliki / 30 testów; `pnpm test` 92 pliki / 502 testy zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm quality`, `pnpm --filter @lista/api build` OK.
- Regresja: istniejące testy T-033 / T-035 / T-037 (dokładnie jedno zdarzenie przy pierwszym przekroczeniu) i tabela `limits.security.test.ts` zielone bez zmian asercji.

## Prevention

Co by zapobiegło: test limitu, który powtarza przekroczenie (N prób), a nie tylko jedno — wszystkie testy limitów T-033 / T-037 sprawdzały wpis po jednej próbie, więc liniowy przyrost logu był niewidoczny. Decyzja użytkownika (2026-10-30): oba punkty i test dwóch sesji (uwaga QA) przechodzą do T-040 (AC2, AC3); licznik pominiętych prób odrzucony na razie (zmienia schemat zdarzenia z T-035, tylko identyfikatory):

1. Test automatyczny w tabeli `limits.security.test.ts`: każdy scenariusz przekracza limit dwa razy (albo N razy) i sprawdza nadal jedno zdarzenie — gryzie każdy nowy limit bez deduplikacji (dziś czerwony dla limitów HTTP z T-040, więc wejdzie razem z T-040).
2. Wpis w „Pułapkach” `docs/architecture/layers/backend.md`: zdarzenie limitu raz na podmiot i limit w oknie, nie raz na żądanie / połączenie.

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

Odtworzenie (QA, czysty stan): `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check` OK; `pnpm vitest run --project api live.limits limits.security` 2 pliki / 30 testów zielone; `pnpm test` 92 pliki / 502 testy zielone; `pnpm quality` (depcruise: 0 naruszeń), `pnpm --filter @lista/api build` OK.

Kryteria:

- **AC1 — pass.** Test #1: 20 prób ponad `socketsPerSession` (1006) → dokładnie jeden wpis `limit_reached` z `route`, `limit`, `userId` (`toEqual([objectContaining])`, więc liczba wpisów nie zależy od N). Test #2: 3 próby ponad `connectionsPerSession` (1008) → 1 wpis; zegar + `limitLogWindowSeconds` → drugi wpis (granica okna `end <= now` sprawdzona). Kształt przez `logLimitEvent`, bez zmian.
- **AC2 — pass.** Testy T-033 / T-035 / T-036 / T-037 i tabela `limits.security.test.ts` zielone bez zmiany asercji; `limitLogWindowSeconds` w `NOT_ABUSE_LIMITS` i w `LIVE_LIMITS` (`packages/shared/test/live.test.ts`).

Spot-checki (przywrócone, `git status` czysty):

- okno wyłączone (`take` zawsze `true`) → oba nowe testy czerwone (`…(19)` wpisów; `length of 1 but got 3`) — zgodnie z red w Evidence;
- okno bez wygasania (`Infinity`) → test #2 czerwony (`expected [ {…} ] to deeply equal [ …(1) ]`).

Eksploracja (tymczasowy plik testowy, usunięty): dwie sesje tej samej osoby, każda ponad `connectionsPerSession` po 3 próby → 2 wpisy (okno per sesja, zgodnie z Root cause); dwa kolejne połączenia tej samej sesji przekraczające `messagesPerSecond` w jednym oknie → 1008 dla obu, log ograniczony oknem. Bezpieczeństwo: w logu tylko `userId` (bez ciasteczka — `limitEvents` sprawdza), autoryzacja upgrade'u bez zmian (`Origin` 403, sesja 401), mapa okien sprzątana przy zapisie (ograniczona liczbą zdarzeń w ostatnich 60 s). Próba nadużycia TH-21/TH-25 (seria upgrade'ów ponad limit) wykonana lokalnie przez testy powyżej: log nie rośnie z N.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security / log (TH-21) | Wpis w oknie nie niesie liczby pominiętych prób, więc log `security` pokazuje, że nadużycie trwa (wpis co 60 s), ale nie jego skalę. Raport dopuszczał wariant „z licznikiem prób”; AC1 tego nie wymaga. | `LimitLogWindow.take` w `na-zywo/http/routes.ts` zwraca tylko `boolean`, licznik nie istnieje | opcjonalnie: pole `suppressed` (liczba pominiętych prób od poprzedniego wpisu) w następnym wpisie okna — decyzja użytkownika |
| 2 | note | test coverage | Okno obejmuje też limity wiadomości (`messagesPerSecond`, `messageBytes`) na kolejnych połączeniach tej samej sesji — zachowanie zamierzone (komentarz `limitLog`), ale bez testu; to samo dla „dwie sesje tej samej osoby logują osobno” (z QA planu). Oba sprawdzone eksploracyjnie przez QA. | `routes.ts` `exceeded(...)` dla `messageBytes` / `messagesPerSecond` idzie przez `logWindow.take` | opcjonalny test regresji dwóch sesji w `live.limits.test.ts` |
| 3 | note | scope / TH-25 | Koszt próby (zapytanie o sesję w `preValidation` przy każdym upgradzie) i zalew `rate_limited` w HTTP (`perIp`, most Better Auth) zostają — opisane w Root cause jako poza zakresem. | sekcja „Poza zakresem” | osobne zadania, jeśli użytkownik zechce |
