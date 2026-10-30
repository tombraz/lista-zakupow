---
id: T-040
title: "Odpowiedzi 429 w HTTP zalewają log security"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done               # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-027, T-034, T-035, T-038]
---

# T-040 Odpowiedzi 429 w HTTP zalewają log security

## Report

Źródło: `/fix T-038`, sekcja „Poza zakresem / inne wystąpienia” (2026-10-30); przyjęte przez użytkownika jako osobne zadanie. Ten sam wzorzec co T-038 (WS), ale w warstwie `http` i z kluczem IP / konta zamiast sesji.

- **Actual:** każda odpowiedź 429 zapisuje jedno zdarzenie `rate_limited` w logu `security`:
  - `perIp(key)` (`apps/api/src/http/rate-limit.ts`, `errorResponseBuilder`) — `healthReadyPerIp`, `invitationLookupPerIp`;
  - most Better Auth (`apps/api/src/modules/konta/http/auth-routes.ts`) — `signUpPerIp`, `signInPerIp`, `signInFailuresPerAccount`;
  - `invitationsCreatedPerList` (`DomainError` z `security`, `zaproszenia/domain/invitations.ts` → handler w `http/api-error.ts`).
  Klient powtarzający żądania ponad limit z jednego IP (albo na jedno konto / listę) daje jedną linię `security` na żądanie; objętość logu rośnie liniowo z liczbą prób.
- **Expected:** nadużycie zostaje w logu `security` (TH-21), ale objętość jest ograniczona: najwyżej jedno zdarzenie na klucz limitu i podmiot (IP / `accountKey` / `listId`) w oknie czasu, jak `LimitLogWindow` z T-038 — do wyboru w `/fix` (np. wspólny mechanizm w `logging.ts` / `logLimitEvent` zamiast osobnego w `na-zywo`). Adres IP nadal nie trafia do logu. — source: TH-21
- **Steps to reproduce:**
  1. `RATE_LIMITS.healthReadyPerIp.max + N` żądań `GET /health/ready` z jednego `remoteAddress` (`app.inject`).
  2. Liczba wpisów `rate_limited` / `healthReadyPerIp` w logu `security` (`captureLogs()`) = N.
- **Environment:** lokalnie, Testcontainers; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-038, sekcja Root cause („Poza zakresem / inne wystąpienia”).

## Acceptance criteria

- [ ] AC1: Given podmiot (IP, konto, lista) ponad limitem z `RATE_LIMITS`, when wykona N kolejnych żądań w oknie limitu, then każde dostaje 429 `rate_limited`, a log `security` ma ograniczoną liczbę wpisów (niezależną od N) w oknie czasu, każdy w kształcie `logLimitEvent` (`limit`, `route`, identyfikatory), bez adresu IP. — verified by: testy limitów HTTP (`health-rate-limit.test.ts`, `sign-in-rate-limit.test.ts`, `invitations.rate-limit.test.ts` lub nowy wspólny)
- [ ] AC2: Dwa różne podmioty (dwa IP, dwa konta; dla WS z T-038 dwie sesje tej samej osoby) ponad limitem → osobne zdarzenia (deduplikacja nie ukrywa drugiego atakującego).
- [ ] AC3 (prevention z T-038): tabela `limits.security.test.ts` przekracza każdy limit nadużyć kilka razy i sprawdza nadal dokładnie jedno zdarzenie — nowy limit bez deduplikacji → test czerwony. Wpis w „Pułapkach” `docs/architecture/layers/backend.md`: zdarzenie limitu raz na podmiot i limit w oknie, nie raz na żądanie / połączenie. — verified by: `limits.security.test.ts`
- [ ] AC4: No regression in: T-027, T-034, T-035, T-038, `limits.security.test.ts` (nadal dokładnie jedno zdarzenie na pierwsze przekroczenie).

## TDD plan

**Seam:** HTTP (`app.inject` z `remoteAddress`) + `captureLogs()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 0 | tabela `limits.security.test.ts`: każdy scenariusz przekracza limit wielokrotnie → dokładnie jedno zdarzenie (najpierw czerwony dla limitów HTTP) | integracja | Vitest + Testcontainers | AC1, AC3 |
| 1 | wiele żądań ponad `perIp` z jednego IP → ograniczona liczba wpisów `rate_limited` | integracja | Vitest + Testcontainers | AC1 |
| 2 | wiele prób logowania ponad `signInPerIp` / `signInFailuresPerAccount` → ograniczona liczba wpisów | integracja | Vitest + Testcontainers | AC1 |
| 3 | dwa IP ponad limitem → dwa wpisy | integracja | Vitest + Testcontainers | AC2 |
| 4 | dwie sesje tej samej osoby ponad `connectionsPerSession` → dwa wpisy (`live.limits.test.ts`; uwaga QA T-038) | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api rate-limit live.limits limits.security`

## QA plan

- **Regression:** T-027, T-034, T-035, T-038, limity logowania i zaproszeń.
- **Edge cases:** klucz deduplikacji bez IP w logu (IP tylko w pamięci); `trustedProxies` (adres klienta zza proxy); okno deduplikacji a `windowSeconds` limitu; nowy próg (jeśli powstanie) w `NOT_ABUSE_LIMITS` tabeli `limits.security.test.ts`; czy `LimitLogWindow` z T-038 przenieść do wspólnego miejsca.
- **Platforms:** API.

## Root cause

`logLimitEvent` (`src/logging.ts`, T-035) zapisywał zdarzenie przy każdym wywołaniu, a wołające go ścieżki HTTP (`perIp` → `errorResponseBuilder`, most Better Auth, handler `DomainError` z `security`, `bodyBytes` w `apiErrors`) wołają go raz na odrzucone żądanie. Deduplikacja z T-038 (`LimitLogWindow`) żyła tylko w trasie WS, więc HTTP nie miał żadnej. Testy limitów (T-005, T-006, T-027, T-034, tabela `limits.security.test.ts`) przekraczały limit raz albo wręcz oczekiwały wpisu na każde odrzucone żądanie (`lists.limit`, `items.limit`: 2 odrzucenia → 2 wpisy).

Zasięg szerszy niż w raporcie: poza `perIp`, mostem Better Auth i `invitationsCreatedPerList` to samo dotyczyło limitów biznesowych (`listsPerOwner`, `itemsPerList`, `participantsPerList`) i `bodyBytes` (wszystkie przez `logLimitEvent`) — tabela z AC3 była czerwona dla wszystkich 11 limitów HTTP.

Poprawka: `LimitLogWindow` przeniesione do `src/logging.ts`, jedno na aplikację (dekoracja `limitLogWindow`, zegar `Clock` z `app.ts`), sprawdzane w samym `logLimitEvent` — każdy limit, obecny i nowy, jest deduplikowany bez zmian w wołających. Okno: `LIVE_LIMITS.limitLogWindowSeconds` (60 s, komentarz uogólniony). Podmiot (`subject`, tylko w pamięci, nie w logu): domyślnie identyfikatory zdarzenia (`userId`+`listId`, `listId`, `accountKey`), bez nich `request.ip` (z `trustProxy`, czyli adres klienta zza zaufanego proxy). Jawnie: `signInPerIp` → IP (zdarzenie niesie `accountKey`, ale limit liczy IP; seria kont z jednego IP to jedno zdarzenie), WS → `sessionId` (jak w T-038). Czwarty parametr `logLimitEvent` to teraz `{ ids, subject }` (reguła `max-params`). Nieużywane już `clock` w `LiveRouteDeps` usunięte. Kształt zdarzenia bez zmian.

**Poza zakresem / inne wystąpienia:**

- `limitLogWindowSeconds` zostaje w `LIVE_LIMITS`, choć dotyczy teraz wszystkich limitów — przeniesienie do osobnej stałej zmieniłoby `packages/shared` i tabelę `NOT_ABUSE_LIMITS` bez zmiany zachowania; do rozważenia przy następnej zmianie stałych.
- `sign_in_failed` (`logSecurity` w `auth-routes.ts`) i `list_access_denied` nie są zdarzeniami limitu: zapisują się na każde żądanie, ale ich objętość ogranicza limit (`signInFailuresPerAccount` / `signInPerIp` dla logowania); `list_access_denied` bez limitu — osobna decyzja, nie naprawione tutaj.

## Evidence

- Red: `pnpm vitest run --project api health-rate-limit sign-in-rate-limit live.limits limits.security` → 12 testów czerwonych: 11 wierszy tabeli `limits.security.test.ts` (wszystkie limity HTTP, np. `healthReadyPerIp: exceeding the limit repeatedly logs one security event` → `AssertionError: expected [ { level: 40, …(9) }, …(2) ] to deeply equal [ ObjectContaining{…} ]`), `logs repeated 429s once per IP and window, separately for each IP` → `expected [ … ] to have a length of 2 but got 20`, `logs repeated attempts over the account limit once per account` → `expected [ { level: 40, …(10) }, …(19) ] to deeply equal [ ObjectContaining{…}, …(1) ]`. Wiersze WS i nowy `logs the connection limit separately for two sessions of one person` zielone od początku (regresja T-038 / AC2).
- Zmiana asercji w testach sprzed T-040: `lists.limit.test.ts` i `items.limit.test.ts` (`stops a bot … logs it with identifiers only`) oczekiwały 2 wpisów na 2 odrzucenia; po poprawce 1 (zamierzona zmiana zachowania, AC1).
- Green: te same 4 pliki / 44 testy; `pnpm test` 92 pliki / 505 testów zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm quality` (depcruise: 0 naruszeń), `pnpm --filter @lista/api build` OK.
## Prevention

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

Reprodukcja: `pnpm install --frozen-lockfile`, `pnpm test` (92 pliki / 505 testów zielone), `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm quality` (jscpd OK, depcruise 0 naruszeń). Testy zadania: `pnpm vitest run --project api health-rate-limit sign-in-rate-limit live.limits limits.security lists.limit items.limit` → 56/56 zielone.

Kryteria:

- AC1 — pass: tabela `limits.security.test.ts` przekracza każdy z 16 limitów `OVER` = 3 razy i oczekuje dokładnie jednego zdarzenia w kształcie `logLimitEvent` (`limit`, `route`, `requestId`); `health-rate-limit.test.ts` sprawdza 429, ograniczoną liczbę wpisów, ponowne zdarzenie dopiero po upływie okna (zegar testowy) i brak adresu IP w logu.
- AC2 — pass: dwa IP → 2 wpisy (`health-rate-limit`), dwa konta → 2 wpisy z różnym `accountKey` (`sign-in-rate-limit`), dwie sesje tej samej osoby → 2 wpisy (`live.limits`).
- AC3 — pass: tabela czerwona dla limitu bez deduplikacji (spot-check niżej); wpis w „Pułapkach” `docs/architecture/layers/backend.md` obecny.
- AC4 — pass: pełny zestaw zielony; zmiana oczekiwań w `lists.limit` / `items.limit` (2 → 1 wpis) to zamierzona zmiana zachowania z AC1, opisana w Evidence; pozostałe asercje (identyfikatory, brak treści w logu) bez osłabienia.

Spot-checki (każdy cofnięty, `git status` czysty):

1. `logLimitEvent` bez `take(...)` (brak deduplikacji) → 21 testów czerwonych (wszystkie 16 wierszy tabeli, `lists.limit`, `items.limit`, testy okna WS i nowe testy AC1/AC2).
2. Jeden klucz okna dla wszystkich podmiotów → 3 testy AC2 czerwone (dwa IP, dwa konta, dwie sesje).
3. `signInPerIp` bez jawnego `subject: request.ip` (podmiot = `accountKey`) → wiersz `signInPerIp` tabeli czerwony.

Red evidence w sekcji Evidence obecne dla planowanych testów; Root cause wyjaśnia, dlaczego istniejące testy nie złapały błędu (przekraczały limit raz albo oczekiwały wpisu na każde odrzucenie).

Bezpieczeństwo (TH-21): próby zalewu wykonane lokalnie przez `app.inject` z `remoteAddress` na prawdziwej aplikacji z bazą Testcontainers — objętość logu `security` ograniczona, drugi atakujący (inne IP / konto / sesja) widoczny, adres IP tylko jako klucz w pamięci (asercja `not.toContain(ip)`). Brak sekretów i danych osobowych w nowych logach.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | docs | Sekcja `## Prevention` w pliku zadania jest pusta, choć prewencja jest zrobiona (AC3: tabela + „Pułapki”). | plik zadania, `## Prevention` | Jedno zdanie odsyłające do AC3 / wpisu w `backend.md`. |
| 2 | minor | code quality | `limitLogWindowSeconds` w `LIVE_LIMITS`, a dotyczy teraz wszystkich limitów (HTTP też) — spójność stałych; autor sam to odnotował. | `packages/shared/src/limits.ts` | Osobna stała (np. w `HTTP_LIMITS` / własnym obiekcie) przy następnej zmianie stałych. |
| 3 | note | performance | `LimitLogWindow.take` przegląda całą mapę przy każdym zapisanym zdarzeniu; przy rotacji wielu IP ponad limitem koszt rośnie kwadratowo w oknie (ograniczony tym, że każdy IP musi najpierw przekroczyć limit). | `apps/api/src/logging.ts`, `take` | Sprzątanie okresowe lub co N zapisów, jeśli kiedyś wyjdzie w profilu. |
| 4 | note | security | Okno per konto (`signInFailuresPerAccount`) jest wspólne dla wszystkich IP: drugi atakujący na to samo konto w ciągu 60 s nie dodaje wpisu (konto jest już w logu). Zgodne z AC2 (podmiot = konto). | `auth-routes.ts` | Bez zmian; do świadomej akceptacji. |

