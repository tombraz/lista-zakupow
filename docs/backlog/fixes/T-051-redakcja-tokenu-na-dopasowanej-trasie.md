---
id: T-051
title: "Redakcja tokenu zaproszenia w logu obejmuje każdy zapis ścieżki"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-12]
threats: [TH-08, TH-21, TH-26]
screens: []
related_tasks: [T-008, T-049]
---

# T-051 Redakcja tokenu zaproszenia w logu obejmuje każdy zapis ścieżki

## Report

Źródło: T-049 (inne wystąpienie wzorca TH-26, sekcja „Root cause”).

- **Actual:** `redactedUrl` (`apps/api/src/logging.ts`) redaguje token zaproszenia wyrażeniem `INVITATION_TOKEN_PATH`, czyli po prefiksie surowej ścieżki (`/api/v1/invitations/`, `/zaproszenie/`). Router dopasowuje trasę po zdekodowanej ścieżce, więc ścieżka z zakodowaną literą trafia do tras zaproszeń (podgląd, przyjęcie), a token zostaje w logu jawnym tekstem.
- **Expected:** token zaproszenia nie trafia do logu, niezależnie od zapisu ścieżki. Źródło: TH-08 („logi API redagują ścieżkę `/invitations/:token`”), TH-21, TH-26.
- **Steps to reproduce:** zapisy ścieżki jak w `spellings()` w `apps/api/test/origin.test.ts` (T-049), zastosowane do `/api/v1/invitations/:token` i `/api/v1/invitations/:token/accept`; w logu (`captureLogs()`) pole `req.url` zawiera token.
- **Environment:** lokalnie, po T-049.
- **Evidence:** analiza kodu w T-049; ryzyko niskie: token pochodzi od samego żądającego, a klient web używa kanonicznej ścieżki. Ślad tokenu w logach to jednak dokładnie to, przed czym chroni TH-08.

## Acceptance criteria

- [x] AC1: Given żądanie do trasy zaproszenia (podgląd, przyjęcie) w wariancie zapisu ścieżki, when API je loguje, then w logu (także w kanale `security`) nie ma tokenu, a ścieżka ma `[redacted]` w miejscu tokenu. — verified by: test integracyjny w `invitations.logs.test.ts`
- [x] AC2: Given strona SC-08 `/zaproszenie/:token` w wariancie zapisu, when API ją loguje, then token jest zredagowany. — verified by: test integracyjny
- [x] AC3: Redakcja opiera się na dopasowanej trasie (`request.routeOptions.url` z parametrem `:token`) albo na zdekodowanej ścieżce, nie na prefiksie surowego adresu (TH-26, `backend.md` „Zasady bezpieczeństwa”). — verified by: przegląd kodu w QA
- [x] AC4: No regression in: `invitations.logs.test.ts`, `logging.test.ts`, J-04, redakcja `?token=` w query.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z przechwyconym logiem (`captureLogs()`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `redacts the invitation token whatever the path spelling` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `redacts the token of the SC-08 page whatever the path spelling` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api logs`

## QA plan

- **Regression:** podgląd i przyjęcie zaproszenia (J-04), log `security`, redakcja query (`?token=`).
- **Edge cases:**
  - zakodowane znaki w tokenie i w prefiksie;
  - nieprawidłowe sekwencje `%` (dekodowanie nie może rzucić wyjątku w serializerze logu);
  - nieznana trasa pod prefiksem zaproszeń;
  - wylogowane żądanie (log przed `requireSession`).
- **Platforms:** API.

## Root cause

`redactedUrl` (T-008, commit `0f997f6`) dopasowywał `INVITATION_TOKEN_PATH` do surowego `request.url`, a router Fastify (find-my-way) dopasowuje trasę po zdekodowanej ścieżce: `/%61pi/v1/invitations/<token>` trafia do podglądu (410/200), a strona SC-08 jest serwowana z fallbacku SPA dla `/%7aaproszenie/<token>` i `//zaproszenie/<token>` (403 z `@fastify/static`, wciąż logowane). Testy z T-008 sprawdzały tylko kanoniczny zapis ścieżki, a reguła lintu z T-049 (`API_RAW_URL_SYNTAX`) pomija `logging.ts` (wyłączony z bloku reguł API), więc serializer logu nie przeszedł przeglądu wariantów zapisu.

Poprawka: rozpoznanie ścieżki z tokenem na ścieżce ze zdekodowanymi znakami ASCII (`%XX` < `0x80`, bez wyjątku przy nieprawidłowej sekwencji `%`) i ze zwiniętymi `//`; taka ścieżka trafia do logu zdekodowana, z `[redacted]` w miejscu tokenu. Query bez zmian (redakcja `?token=`).

Inne wystąpienia wzorca: `API_PATH` w `http/web-app.ts` (handler 404, udokumentowany wyjątek w lincie) wybiera SPA albo JSON po surowym adresie — `GET /%61pi/v1/nieznana` dostaje `index.html` zamiast `404 not_found`. To nie decyzja bezpieczeństwa (trasa i tak nie istnieje) i inny skutek; bez zmian w tym zadaniu. Żądanie z nieprawidłową sekwencją `%` w ścieżce Fastify odrzuca 400 przed routerem (`onBadUrl` bez `frameworkErrors`) i w ogóle go nie loguje.

## Evidence

- Red (przed poprawką): `invitation token in logs > redacts the invitation token whatever the path spelling` — `AssertionError: expected '{"level":30,…' not to contain 'RMdsT-s7…'`; w logu `"url":"/api/%761/invitations/YRMdsT-…/accept"`, `"/api/v1/%69nvitations/…"`, `"//api/v1/invitations/…"`.
- Red: `redacts the token of the SC-08 page whatever the path spelling` — w logu `"url":"/%7aaproszenie/pAdVYVz4…"`, `"//zaproszenie/pAdVYVz4…"`.
- Green: `pnpm vitest run --project api logs` — 7/7.
- Pełny zestaw `pnpm test` — 96 plików, 524 testy, wszystkie zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm quality` — bez błędów.

## Prevention

Reguła lintu TH-26 z T-049 (`API_RAW_URL_SYNTAX`) nie obejmuje serializera logu (`raw.url` w `logging.ts`). Po poprawce rozważyć jej rozszerzenie na serializer albo test wariantów zapisu dla każdej ścieżki z tokenem.

**Co by temu zapobiegło (/fix, krok 8):** test wariantów zapisu ścieżki dla redakcji w logu, tak jak `spellings` w `origin.test.ts` dla `Origin`. Rozszerzenie `API_RAW_URL_SYNTAX` na `logging.ts` nie pomoże: serializer z definicji czyta surowy adres. Propozycje (do akceptacji użytkownika):

1. Test automatyczny: zbierać trasy z parametrem `:token` (hook `onRoute` w teście) i dla każdej sprawdzać `redactedUrl` na wariantach zapisu; nowa trasa z tokenem bez redakcji zawiedzie test bez ręcznego dopisywania.
2. „Pułapki” w `layers/backend.md`: redakcja w logu działa na zdekodowanej ścieżce (jak router), każda ścieżka z tokenem ma test wariantów zapisu w `invitations.logs.test.ts`.

Decyzja użytkownika (2026-10-31): oba przyjęte, razem z poprawką `%2F` z QA rundy 1 (uwaga minor).

- Test pokrycia `apps/api/test/logs.token-paths.test.ts`: trasy API z `onRoute` (opakowana fabryka Fastify przez `vi.mock`, hook przed trasami z `buildApp`) i strony z `apps/web/src/routes.tsx` z `:token`; dla każdej warianty zapisu (zakodowany pierwszy znak każdego segmentu, `A%2F<token>`, `//`, query) i `redactedUrl` bez tokenu. Sprawdzony mutacją: wyrażenie bez `/zaproszenie/` → test pada na `/zaproszenie/<token>`.
- `%2F`: red — `A%2F<token>` logowane jako `[redacted]/<token>` (oba testy integracyjne i test pokrycia); poprawka: `ASCII_ESCAPE` pomija `%2F`, jak router. Green: `pnpm vitest run --project api logs` 8/8; `pnpm test` 97 plików, 525 testów; typecheck, lint, format, build, quality bez błędów.
- „Pułapki” w `layers/backend.md` z wierszem w historii zmian.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-31)

Verdict: pass

Reprodukcja: `pnpm install --frozen-lockfile`, `pnpm build` — OK; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality` — bez błędów; `pnpm test` — 524 testy, 0 błędów (JUnit); `pnpm vitest run --project api logs` — 7/7.

Kryteria akceptacji:

- AC1 — pass: test `redacts the invitation token whatever the path spelling` sprawdza całe linie logu (także kanał `security`) i kształt `req.url` dla każdego zapisu (zakodowany segment prefiksu, zakodowany pierwszy znak tokenu, `//`, query, `%zz`).
- AC2 — pass: test SC-08 analogicznie, z fallbackiem SPA.
- AC3 — pass: redakcja na ścieżce ze zdekodowanymi znakami ASCII i zwiniętymi `//`, nie na prefiksie surowego adresu (przegląd `apps/api/src/logging.ts`).
- AC4 — pass: dotychczasowe testy `invitations.logs.test.ts`, `logging.test.ts`, J-04 i redakcja `?token=` zielone w pełnym zestawie.

Spot-check: przywrócenie `logging.ts` z `fe95363^` — oba nowe testy czerwone (2 failed / 4 passed), stare zielone; plik przywrócony, `git status` czysty. Dowód red w Evidence obecny dla obu testów.

Eksploracja (sonda `redactedUrl` i sonda routera Fastify, lokalnie): `/%61pi/v1/invitations/T`, `%E2%82T`, `%zzT`, `T%`, `///zaproszenie/T#frag`, `/zaproszenie/T/`, `?token=` — zredagowane, bez wyjątku. `/API/...` nie trafia w trasę (router rozróżnia wielkość liter), więc brak redakcji nie jest wyciekiem tokenu z trasy. Żądanie z nieprawidłowym `%` w ścieżce — 400 przed routerem, nielogowane.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security / TH-26 | Dekodowanie `%2F` w `decodedAscii` daje inną postać ścieżki niż router: find-my-way nie dekoduje `%2F` przy dopasowaniu, więc `POST /api/v1/invitations/A%2FTOKEN123/accept` trafia w `/:token/accept` z `token = "A/TOKEN123"`, a w logu jest `/api/v1/invitations/[redacted]/TOKEN123/accept`. Część parametru trasy zostaje w logu. Ryzyko pomijalne: taki parametr nie może być prawdziwym tokenem (base64url bez `/`) i pochodzi od samego żądającego. | sonda `redactedUrl` i sonda Fastify `inject` (status 200, `routeOptions.url = /api/v1/invitations/:token/accept`) | nie dekodować `%2F` (`ASCII_ESCAPE` bez `2f`) albo redagować według `routeOptions.url` i `params.token`, gdy trasa jest dopasowana |
| 2 | minor | test quality / duplikacja | `loggedUrls()` powtarza wyciąganie `req.url` z dwóch starszych testów w tym samym pliku, które z niej nie korzystają. | `apps/api/test/invitations.logs.test.ts` | starsze testy używają `loggedUrls()` |
| 3 | note | test quality | Asercja `status < 500` nie pokazuje, że każdy wariant faktycznie trafił w trasę zaproszenia (część idzie do fallbacku SPA lub 404). AC tego nie wymaga, bo badany jest log. | ten sam plik | opcjonalnie sprawdzić `routeOptions.url` / status dla wariantów API |

## QA round 2 (2026-10-31)

Verdict: fail

Zakres: zmiany po rundzie 1 (`207270f`, `a450cba`, `9620582`): `ASCII_ESCAPE` bez `%2F`, wariant `A%2F<token>` w `invitations.logs.test.ts`, nowy test pokrycia `apps/api/test/logs.token-paths.test.ts`, „Pułapki” w `layers/backend.md`.

Reprodukcja: `pnpm install --frozen-lockfile`, `pnpm build` — OK; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality` — bez błędów; `pnpm vitest run --project api logs` — 8/8; `pnpm vitest run --project api` — 255/255 (kolejność plików tym razem korzystna). **`pnpm test` — 525 testów, 1 błąd**: `logs.token-paths.test.ts > redacts the token of every API route and web page with :token, whatever the spelling` — `AssertionError: expected [] to deeply equal ArrayContaining{…}` (`test/logs.token-paths.test.ts:62`, z `test-results/vitest-junit.xml`).

Przyczyna (potwierdzona): projekt `api` ma `isolate: false` (`apps/api/vitest.config.ts`, T-021), więc moduł `fastify` jest wspólny dla plików w jednym workerze. `vi.mock("fastify")` działa tylko wtedy, gdy plik testu pokrycia jest pierwszym, który ładuje Fastify w swoim workerze; w przeciwnym razie `buildTestApp` używa niezamockowanej fabryki, hook `onRoute` nie jest dodany i `registered` zostaje puste. Reprodukcja deterministyczna: `pnpm vitest run --project api --maxWorkers=1 --no-file-parallelism --sequence.shuffle.files --sequence.seed=<s> test/health.test.ts test/logs.token-paths.test.ts` — seedy 1, 2, 4, 5, 6 (najpierw `health.test.ts`) → błąd; seed 3 (najpierw test pokrycia) → zielony.

Kryteria akceptacji:

- AC1 — pass: wariant `A%2F<token>` dla podglądu i przyjęcia daje w logu `[redacted]` bez reszty tokenu (uwaga 1 z rundy 1 usunięta).
- AC2 — pass: jak wyżej dla SC-08.
- AC3 — pass: redakcja na zdekodowanej ścieżce, `%2F` pozostaje jak w routerze (przegląd `apps/api/src/logging.ts`).
- AC4 — **fail**: pełny zestaw testów czerwony (nowy test zależny od kolejności plików).

Spot-check: przywrócenie `ASCII_ESCAPE = /%([0-7][0-9a-f])/gi` → 3 testy czerwone (oba integracyjne z wariantami zapisu i test pokrycia), 5 zielonych; plik przywrócony, `git status` czysty. Test pokrycia gryzie, gdy działa — problemem jest tylko mechanizm zbierania tras.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | test suite / niestabilny test | `logs.token-paths.test.ts` zbiera trasy przez `vi.mock("fastify")`, co przy `isolate: false` w projekcie `api` nie działa, jeśli inny plik w tym samym workerze załadował Fastify wcześniej. `pnpm test` czerwony; Evidence („97 plików, 525 testów” zielonych) nie powtarza się. | JUnit z `pnpm test`; powtarzalna reprodukcja seedami (wyżej) | lista tras bez mockowania modułu współdzielonego między plikami, np. z `app.printRoutes({ commonPrefix: false })` po `ready()`, z hooka `onRoute` dodanego przez opcję/plugin w `buildTestApp`, albo test w osobnym projekcie z `isolate: true`; do tego potwierdzenie przebiegiem z najpierw innym plikiem (`--sequence.shuffle.files`) |
| 2 | minor | test quality | Ścieżki web z `:token` są wyciągane regexem ze źródła `apps/web/src/routes.tsx` (`path:\s*"…"`); zmiana zapisu (apostrofy, stała, szablon) po cichu zgubi stronę. Asercja `toContain("/zaproszenie/:token")` łapie tylko tę jedną znaną stronę. | `apps/api/test/logs.token-paths.test.ts`, `webTokenPaths()` | akceptowalne; opcjonalnie eksport tablicy ścieżek z `routes.tsx` albo asercja, że regex znalazł wszystkie `path:` w pliku |

### Poprawka po QA rundy 2

- #1 (blocker): red — `pnpm vitest run --project api --sequence.shuffle --sequence.seed=1|2|4` → `logs.token-paths.test.ts` pada (`expected [] to …`). Poprawka: trasy z `app.printRoutes({ commonPrefix: false })` po `ready()` (`registeredRoutes`), bez `vi.mock("fastify")`; asercja na znaną trasę `/api/v1/lists/:listId/items/:itemId` wywraca test przy zmianie formatu drzewa. Green: seedy 1, 2, 4, 5, 6 (pełny projekt `api`, 255/255) i reprodukcja z QA (`health.test.ts` + test pokrycia, `--maxWorkers=1 --sequence.shuffle.files`, seedy 1 i 3); `pnpm test` 97 plików, 525 testów.
- #2 (minor): `webTokenPaths()` sprawdza, że regex znalazł każde `path:` w `routes.tsx`; inny zapis ścieżki zawodzi test.

## QA round 3 (2026-10-31)

Verdict: pass

Zakres: poprawka po rundzie 2 (`6b93199`): trasy w teście pokrycia z `app.printRoutes({ commonPrefix: false })` zamiast `vi.mock("fastify")`, kontrola kompletności `path:` w `webTokenPaths()`.

Reprodukcja: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality` — bez błędów; `pnpm test` — 97 plików, 525 testów, 0 błędów (JUnit). Reprodukcja z rundy 2 (`health.test.ts` + `logs.token-paths.test.ts`, `--maxWorkers=1 --no-file-parallelism --sequence.shuffle.files`, seedy 1–6) — 5/5 dla każdego seeda; pełny projekt `api` z `--sequence.shuffle.files`, seedy 7 i 11 — 255/255.

Kryteria akceptacji:

- AC1 — pass (bez zmian w kodzie produkcyjnym od rundy 2; testy zielone).
- AC2 — pass (jw.).
- AC3 — pass (jw.).
- AC4 — pass: pełny zestaw zielony, test pokrycia już nie zależy od kolejności plików.

Spot-check: (1) sonda porównująca surowe drzewo `printRoutes` z wynikiem parsera — wszystkie 16 tras odtworzone poprawnie, w tym obie trasy z `:token`; jedyna niedopasowana linia to pusta linia końcowa. (2) Mutacja `INVITATION_TOKEN_PATH` bez `/api/v1/invitations/` i przebieg z `health.test.ts` jako pierwszym plikiem w tym samym wątku — test pokrycia czerwony (1 failed / 4 passed). Plik przywrócony, `git status` czysty.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | test quality | `registeredRoutes()` po cichu pomija linie drzewa, których nie dopasuje wyrażenie (np. parametr z wyrażeniem regularnym zawierającym spację). Asercja na znaną trasę `/api/v1/lists/:listId/items/:itemId` łapie zmianę formatu całego drzewa, ale nie pojedynczy nietypowy węzeł. | `apps/api/test/logs.token-paths.test.ts`, `registeredRoutes()` | opcjonalnie: asercja, że każda niepusta linia drzewa została dopasowana |
