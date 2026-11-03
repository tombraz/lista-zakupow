---
id: T-070
title: "Inwentarz tras i WS: NUL w każdym parametrze i polu tekstowym daje 4xx, nigdy 500"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
depends_on: [T-058]
layers: [backend]
requirements: [N-02]
threats: [TH-20]
screens: []
related_tasks: [T-005, T-026, T-058]
---

# T-070 Inwentarz tras i WS: NUL w każdym parametrze i polu tekstowym daje 4xx, nigdy 500

Zakres: trasy HTTP `/api/*` i wiadomości klienta WS `/api/v1/live` (WS dopisany na prośbę właściciela 2026-11-02, bo TH-20 obejmuje oba).

## Report

Źródło: propozycja QA T-058 runda 1, zaplanowana przez `/plan-backlog` 2026-11-02 na prośbę właściciela.

- **Actual:** NUL w danych z żądania doszedł do bazy i dał 500 już trzy razy: QA T-005 runda 1 (tekst w body), T-026 (imię przy rejestracji bez `withoutNul`), QA T-058 runda 1 (`DELETE /api/v1/lists/:listId/members/:userId` z `%00` w `userId`). Każdy z tych przypadków złapał dopiero ręczny test QA. Reguła z `layers/backend.md` („Pułapki”: tekst do bazy tylko przez `requiredName` / `withoutNul`) i TH-20 („zod na każdej trasie”) nie mają automatycznego strażnika.
- **Expected:** CI pada, gdy jakakolwiek trasa API przyjmuje NUL w parametrze ścieżki lub polu tekstowym body bez odpowiedzi 4xx. Nowa trasa nie może ominąć tej kontroli.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` po T-058.

## Acceptance criteria

- [x] AC1: Given aplikacja z `buildTestApp`, when test zbiera wszystkie zarejestrowane trasy (`onRoute`) i porównuje je z tabelą przykładowych żądań, then każda trasa pod `/api/` ma w tabeli wpis albo jawne wyłączenie z powodem (np. trasa bez wejścia, WS `/api/v1/live`, trasa testowa). — verified by: test inwentarza
- [x] AC2: Given nowa trasa dodana w `apps/api/src` bez wpisu w tabeli, when uruchamiam testy, then test inwentarza pada z nazwą metody i ścieżki brakującej trasy. — verified by: kontrola ręczna (tymczasowa trasa, czerwony wynik w Evidence, trasa usunięta)
- [x] AC3: Given każda trasa z parametrami ścieżki, when w każdy parametr po kolei wstawiam `%00` (sam i doklejony do poprawnej wartości) jako zalogowany właściciel zasobu, then odpowiedź to 4xx z kodem błędu z kontraktu, nigdy 500. — verified by: test parametrów
- [x] AC4: Given każda trasa z body JSON, when w każde pole tekstowe przykładowego żądania po kolei wstawiam znak U+0000, then odpowiedź to 4xx (zwykle 400 `validation_failed`), nigdy 500. — verified by: test pól body
- [x] AC5: Given poprawka T-058 cofnięta lokalnie (bez `personIdSchema` dla `userId`), when uruchamiam test parametrów, then pada na `DELETE /api/v1/lists/:listId/members/:userId`. Analogicznie dla pola body: `requiredName` bez `withoutNul` daje czerwony test pól body. — verified by: kontrola ręczna, czerwone wyniki w Evidence, zmiany cofnięte
- [x] AC6: Given trasa, która dziś zwraca 500 dla NUL (jeśli test jakąś znajdzie), then jest naprawiona tym samym wzorcem co T-058 (schemat z `packages/shared` z `withoutNul`), a nie wyłączona z testu. — verified by: test parametrów / pól body zielony bez wyłączeń z powodu „500”
- [x] AC7: Given wiadomość klienta WS `subscribe` lub `unsubscribe` z NUL w `listId` (sam i doklejony do poprawnego UUID), when trafia do `parseClientMessage`, then wynik to `null` (wiadomość odrzucona). Wysłana przez otwarte `/api/v1/live`, dostaje odpowiedź błędu z kontraktu WS bez zapytania do bazy, a połączenie i proces API działają dalej. — verified by: test wiadomości WS
- [x] SEC1 (TH-20): Given napastnik (zalogowany obcy lub anonim), when wysyła NUL w parametrze lub polu tekstowym dowolnej trasy, then dostaje 4xx bez treści błędu bazy (bez SQL, bez wartości pola), a log nie zawiera surowego wyjątku z bazy. — verified by: test parametrów i pól body (asercja na treść odpowiedzi), przegląd logu w jednym przypadku

## TDD plan

**Test seams:** HTTP API przez `buildTestApp` (Fastify `inject`), rejestr tras przez hook `onRoute`; prawdziwy PostgreSQL (Testcontainers).

**Tests in order:**

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Inwentarz: zbiór zarejestrowanych tras `/api/*` równy kluczom tabeli przykładowych żądań + wyłączeń | integration | Vitest | AC1, AC2 |
| 2 | Każda trasa z parametrami: `%00` w każdym parametrze (sam i doklejony) → 4xx, nie 500, bez treści bazy | integration | Vitest + Testcontainers | AC3, AC5, SEC1 |
| 3 | Każda trasa z body: U+0000 w każdym polu tekstowym przykładowego body → 4xx, nie 500 | integration | Vitest + Testcontainers | AC4, AC5, SEC1 |
| 4 | Ten sam przebieg anonimowo i jako zalogowany obcy: 4xx (401/404), nigdy 500 | integration | Vitest + Testcontainers | SEC1 |
| 5 | `parseClientMessage`: NUL w `listId` dla `subscribe` / `unsubscribe` → `null`; przez `/api/v1/live`: odpowiedź błędu, brak zapytania do bazy, połączenie żyje | unit + integration | Vitest (+ Testcontainers) | AC7 |

**Run:** `pnpm vitest run --project api routes-nul`; `pnpm vitest run live` (pakiet `shared`)

**Mocks:** brak; mailer jak w innych testach API (Mailpit/testowy), zegar z `test/clock.ts`, jeśli trasa go wymaga.

## QA plan

- **Edge cases:** `%00` na początku, w środku i na końcu parametru; `%2500` (podwójnie zakodowany NUL nie może dać 500); pole tekstowe zagnieżdżone w body i tablice tekstów, jeśli kontrakt je ma; parametr dłuższy niż `maxParamLength` (414 zostaje akceptowane jako 4xx).
- **Kompletność:** porównać tabelę z listą tras w `api.md` i z wynikiem `app.printRoutes()`; sprawdzić, że trasy Better Auth wystawione przez API (`/api/auth/*`) są w tabeli albo wyłączone z uzasadnieniem.
- **Security / privacy:** w odpowiedziach 4xx brak SQL i wartości pola; w logu pino brak surowego wyjątku z bazy (TH-20, `layers/backend.md` „Pułapki”).
- **WS:** NUL i `%00` jako tekst w `listId`, nieznany `type` z NUL, NUL w kluczu JSON; połączenie po odrzuconej wiadomości nadal przyjmuje poprawny `subscribe`.
- **Regression:** pełny zestaw testów API; wyłączenia w tabeli mają powód, a nie „bo dawało 500”.

## Root cause

Reguła „tekst do bazy tylko przez `requiredName` / `withoutNul`” istniała tylko jako zdanie w `layers/backend.md`, bez strażnika: każda trasa sama decydowała, czy jej wejście przejdzie przez schemat, zanim dotknie bazy. Test inwentarza znalazł czwarty taki przypadek: od T-060 (`6225bc9`) nazwa pozycji z NUL (`POST /api/v1/lists/:listId/items`, `PATCH …/items/:itemId`) dostaje od schematu `invalid` (NUL to znak `Cc`, który odrzuca filtr ukrytych znaków TH-29), więc `onlyItemNameInvalid` uznaje ją za „może duplikat”, a `duplicateBeforeRefusal` szuka jej klucza w bazie — PostgreSQL odrzuca NUL (22021) i trasa odpowiada 500 zamiast 400. W WS `listId` z NUL przechodził `parseClientMessage` i `subscribe` pytał bazę o sesję, zanim `requireListAccess` odrzucił go jako nie-UUID.

Dlaczego testy tego nie złapały: testy NUL były pisane ręcznie dla pojedynczych pól (`unexpected-error.test.ts` — nazwa listy, `sign-up.test.ts` — imię, T-058 — `userId`), a testy T-060 sprawdzały ukryte znaki Cf w nazwie pozycji, nie NUL. Nic nie wymuszało przypadku NUL dla nowej trasy ani nowej ścieżki przed walidacją.

Inne wystąpienia: przegląd wszystkich tras `/api/*` (tabela `EXAMPLES`) — poza pozycjami brak. Ta sama ścieżka „kontrola przed walidacją z odczytem bazy” istnieje tylko w `pozycje/http/routes.ts` (`duplicateBeforeRefusal`, obie trasy) i jest naprawiona tutaj.

## Evidence

Testy reprodukujące, czerwone przed poprawką:

- `apps/api/test/routes-nul.test.ts` › `POST /api/v1/lists/:listId/items: NUL in every path parameter and text field is 4xx, never 500` i to samo dla `PATCH /api/v1/lists/:listId/items/:itemId` — `expected [ { caller: 'owner', case: 'name#0', status: 500 }, … ] to deeply equal []`; w logu `DrizzleQueryError` / `22021` z `DrizzleItemsRepository.nameKeyTaken` ← `refuseDuplicateName` ← `duplicateBeforeRefusal`.
- `packages/shared/test/live.test.ts` › `rejects NUL in the listId of subscribe and unsubscribe, alone or next to a valid id` — `expected { listId: ' ', parsed: { …(2) } } to deeply equal { listId: ' ', parsed: null }`.
- `apps/api/test/live.nul.test.ts` › `answers validation_failed without a database query and keeps the connection usable` — `expected { type: 'error', code: 'not_found', listId } to deeply equal { type: 'error', code: 'validation_failed' }`.

Kontrole ręczne (zmiany cofnięte, `git status` czysty w tych plikach):

- AC2: tymczasowa `app.post("/api/v1/lists/:listId/archive", …)` w `listy/http/routes.ts` → `has an example request or a stated exclusion for every /api route` czerwony: `missingInTable: [ "POST /api/v1/lists/:listId/archive" ]`.
- AC5 (parametr): bez `personIdSchema.safeParse(userId)` w trasie T-058 → czerwony `DELETE /api/v1/lists/:listId/members/:userId` (`:userId=%00`, `%00<id>`, `<id>%00` → 500) i test logu.
- AC5 (treść): `requiredName` przepuszczający NUL (`withoutHiddenCharacters` z usuniętym ` ` przed sprawdzeniem) → czerwone sign-up, `PATCH /api/v1/me`, `POST`/`PATCH` list, `POST`/`PATCH` pozycji i test logu (7 testów).

Poprawka: `withoutNul` (eksport z `@lista/shared`) przed odczytem bazy w `duplicateBeforeRefusal` (`pozycje/http/routes.ts`) — NUL daje 400 `validation_failed` `name: invalid`; `listId` wiadomości WS z `.refine(withoutNul)` (`packages/shared/src/api/live.ts`) — `validation_failed` bez zapytania do bazy, połączenie przyjmuje potem poprawny `subscribe`.

Po poprawce: `pnpm test` 144 pliki / 1132 testy zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality`, `pnpm build` bez błędów. `pnpm vitest run --project api --sequence.shuffle` z seedami 7 i 99 zielone; seed 4242: pada tylko `database.test.ts › starts the next test with empty tables`, także uruchomiony sam (shuffle miesza testy w pliku, a ten zależy od kolejności) — niezwiązane z T-070.

Regresja: pozycje (`items.*.test.ts`, w tym duplikat T-060 `items.duplicate.test.ts`), WS (`live.*.test.ts`) — zielone w pełnym zestawie.

## Implementation notes

- Wybór właściciela (2026-11-02): kontrola przez test inwentarza w runtime, nie przez regułę ESLint. Trasy wołają `validate(schema, body)` w handlerze zamiast `schema` Fastify, więc regułę statyczną łatwo obejść innym zapisem kodu.
- Tabela przykładowych żądań: dla każdej trasy (metoda + ścieżka) poprawne parametry i body, z danymi z `test/factories.ts`. Mutacja NUL dotyczy każdego parametru i każdego pola typu string w tym body. Obiekty i tablice przechodzić rekurencyjnie.
- Przypadek z NUL wysyłać jako zalogowany właściciel zasobu, żeby żądanie doszło do walidacji i domeny, a nie skończyło się na 401/404 przed nimi. Wariant anonimowy i obcy (test 4) sprawdza tylko „nigdy 500”.
- Trasy z limitem żądań (`perIp`) dostają losowy IP (`randomIp`) na każde żądanie, żeby 429 nie zastąpiło prawdziwej odpowiedzi.
- Odstępstwo od notatki „rejestr tras przez hook `onRoute`”: `buildApp` rejestruje trasy głównej instancji synchronicznie, więc hook dodany przez test po `buildApp` ich nie widzi, a wstrzyknięcie hooka do `buildApp` tylko dla testu to zmiana kodu produkcyjnego. Inwentarz czyta `app.printRoutes()` z metodami (ten sam wzorzec co `logs.token-paths.test.ts`, „Pułapki”: bez `vi.mock` przy `isolate: false`).
- `nulAccepted` (NUL poprawną treścią, oczekiwane tylko „nigdy 500”): `password` przy rejestracji i logowaniu, `newPassword` przy resecie (do bazy trafia skrót scrypt; HMAC dopełnia klucz zerami, więc poprawne hasło z NUL na końcu loguje — własność kryptografii, wymaga znajomości hasła) oraz `invitationToken` przy rejestracji (zły token nie blokuje rejestracji, F-12: 200 z `invitation_invalid`).
- Każda trasa: świeży właściciel (lista, uczestnik, pozycja, link, token resetu), mutacje jako właściciel (4xx), obcy i anonim (nigdy 500); na końcu poprawne żądanie na świeżych danych ze statusem z tabeli (`ok`), żeby wpis naprawdę dochodził do handlera.
- Zapisać regułę w `layers/backend.md` („Pułapki”): nowa trasa wymaga wpisu w tabeli testu inwentarza. Zaktualizować wiersz TH-20 w `threat-model.md` („Weryfikacja”: test inwentarza tras z NUL).

## QA round 1 (2026-11-02)

Verdict: pass

Odtworzenie: `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych; `pnpm test` 144 pliki / 1132 testy zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 klonów, 0 naruszeń zależności) bez błędów.

Kryteria:

- AC1 pass — `has an example request or a stated exclusion…` zielony; inwentarz (22 wpisy `EXAMPLES` + 4 `EXCLUDED`) zgodny 1:1 z 26 trasami w `api.md`; test sprawdza też kierunek odwrotny (`notRegistered`), więc błąd parsera `printRoutes` nie przejdzie po cichu.
- AC2 pass — QA dodał tymczasowo `POST /api/v1/lists/:listId/qa-temp`: test czerwony z `missingInTable`; cofnięte.
- AC3 pass — każdy parametr dostaje `%00` sam, z przodu, z tyłu, w środku, `%2500`; właściciel musi dostać 4xx z kodem z kontraktu.
- AC4 pass — każde pole tekstowe (rekurencyjnie) z NUL w 4 pozycjach; `nulAccepted` tylko dla haseł i `invitationToken`, z powodem, i nadal „nigdy 500”.
- AC5 pass — QA usunął `personIdSchema.safeParse(userId)` (listy/http/routes.ts:130): czerwony `DELETE …/members/:userId` i test logu; cofnięte.
- AC6 pass — usunięcie `if (!withoutNul(name)) return;` w `pozycje/http/routes.ts` daje czerwone `POST …/items`, `PATCH …/items/:itemId` i test logu; brak wyłączeń „bo 500”.
- AC7 pass — usunięcie `.refine(withoutNul)` w `shared/src/api/live.ts` daje czerwone `live.test.ts` i `live.nul.test.ts`; test WS liczy zapytania do bazy (0) i sprawdza poprawny `subscribe` po odrzuceniu.
- SEC1 pass — wariant obcy i anonim w każdej trasie, regex na ślady bazy w treści odpowiedzi, test logu (brak `level >= 50`, brak `22021`).

Eksploracja (tymczasowy test, usunięty): NUL w kluczu JSON, treść jako tekst / tablica, `name` jako tablica / obiekt z NUL, dodatkowy klucz z NUL w `PATCH /api/v1/me`, NUL w `note` i `id` pozycji, NUL przy duplikacie nazwy i z Cf, NUL w e-mailu logowania, `%00` w ciasteczku, w zapytaniu (`?x=%00`), w ścieżce nieznanej trasy i `/api/v1/live%00`, parametr > `maxParamLength` z `%00` — wszystkie 4xx albo ignorowane pole (200), żadnego 500 ani śladu bazy.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | API / kontrakt błędów | Treść z surowym (nieescapowanym) NUL to niepoprawny JSON: odpowiedź 400 w domyślnym kształcie Fastify `{statusCode, code:"FST_ERR_CTP_INVALID_JSON_BODY", error, message}`, nie `{error:{code}}` z `api.md`. Tak samo 414 `FST_ERR_MAX_PARAM_LENGTH`. Przed T-070, świadomie (`api-error.ts`: „błędy klienta z Fastify obsługuje jego handler”), bez 500 i bez treści bazy. | `POST /api/v1/lists` z payloadem `{"name":"<raw NUL>"}` → 400 FST_ERR_CTP_INVALID_JSON_BODY | Rozważyć mapowanie błędów klienta Fastify na `validation_failed` w kształcie kontraktu. |
| 2 | note | Test | Inwentarz parsuje tekst `printRoutes()` (odstępstwo od `onRoute`, uzasadnione w notatkach). Zmiana formatu w nowej wersji Fastify da głośny błąd (`toContain`, `notRegistered`), nie cichą lukę. | `routes-nul.test.ts` › `registeredRoutes` | Bez zmian; przy aktualizacji Fastify sprawdzić. |
| 3 | note | Test | Evidence: `--sequence.shuffle` seed 4242 wywraca `database.test.ts › starts the next test with empty tables` (zależność od kolejności w pliku), niezwiązane z T-070. | Evidence autora | Osobne zadanie, jeśli shuffle ma być w CI. |

Root cause: wyjaśnia, dlaczego testy nie złapały błędu (ręczne testy NUL dla pojedynczych pól, T-060 testował Cf, nie NUL). Test reprodukujący pada bez poprawki (spot-check wyżej). `git status` czysty po spot-checkach.

## Prevention

Co by zapobiegło: automatyczny strażnik zamiast zdania w przewodniku. To jest sam wynik tego zadania: `routes-nul.test.ts` (inwentarz tras z NUL, pada dla nowej trasy bez wpisu) i `live.nul.test.ts` (WS) w CI, a w `layers/backend.md` „Pułapki” reguła wpisu nowej trasy do tabeli i `withoutNul` przed odczytem bazy w kontroli sprzed walidacji.

Do decyzji właściciela (propozycje, niezastosowane):

- Błędy klienta z Fastify (niepoprawny JSON, np. surowy NUL; 414 `maxParamLength`) w kształcie `api.md` (`validation_failed`) zamiast domyślnego — QA runda 1, uwaga minor #1; zmiana kontraktu błędów → zadanie przez `/plan-backlog`.
- `database.test.ts › starts the next test with empty tables` zależy od kolejności testów w pliku (pada przy `--sequence.shuffle --sequence.seed=4242`) — osobne zadanie fix, jeśli shuffle ma trafić do CI.
