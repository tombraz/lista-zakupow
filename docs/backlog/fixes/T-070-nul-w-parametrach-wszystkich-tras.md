---
id: T-070
title: "Inwentarz tras i WS: NUL w każdym parametrze i polu tekstowym daje 4xx, nigdy 500"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given aplikacja z `buildTestApp`, when test zbiera wszystkie zarejestrowane trasy (`onRoute`) i porównuje je z tabelą przykładowych żądań, then każda trasa pod `/api/` ma w tabeli wpis albo jawne wyłączenie z powodem (np. trasa bez wejścia, WS `/api/v1/live`, trasa testowa). — verified by: test inwentarza
- [ ] AC2: Given nowa trasa dodana w `apps/api/src` bez wpisu w tabeli, when uruchamiam testy, then test inwentarza pada z nazwą metody i ścieżki brakującej trasy. — verified by: kontrola ręczna (tymczasowa trasa, czerwony wynik w Evidence, trasa usunięta)
- [ ] AC3: Given każda trasa z parametrami ścieżki, when w każdy parametr po kolei wstawiam `%00` (sam i doklejony do poprawnej wartości) jako zalogowany właściciel zasobu, then odpowiedź to 4xx z kodem błędu z kontraktu, nigdy 500. — verified by: test parametrów
- [ ] AC4: Given każda trasa z body JSON, when w każde pole tekstowe przykładowego żądania po kolei wstawiam znak U+0000, then odpowiedź to 4xx (zwykle 400 `validation_failed`), nigdy 500. — verified by: test pól body
- [ ] AC5: Given poprawka T-058 cofnięta lokalnie (bez `personIdSchema` dla `userId`), when uruchamiam test parametrów, then pada na `DELETE /api/v1/lists/:listId/members/:userId`. Analogicznie dla pola body: `requiredName` bez `withoutNul` daje czerwony test pól body. — verified by: kontrola ręczna, czerwone wyniki w Evidence, zmiany cofnięte
- [ ] AC6: Given trasa, która dziś zwraca 500 dla NUL (jeśli test jakąś znajdzie), then jest naprawiona tym samym wzorcem co T-058 (schemat z `packages/shared` z `withoutNul`), a nie wyłączona z testu. — verified by: test parametrów / pól body zielony bez wyłączeń z powodu „500”
- [ ] AC7: Given wiadomość klienta WS `subscribe` lub `unsubscribe` z NUL w `listId` (sam i doklejony do poprawnego UUID), when trafia do `parseClientMessage`, then wynik to `null` (wiadomość odrzucona). Wysłana przez otwarte `/api/v1/live`, dostaje odpowiedź błędu z kontraktu WS bez zapytania do bazy, a połączenie i proces API działają dalej. — verified by: test wiadomości WS
- [ ] SEC1 (TH-20): Given napastnik (zalogowany obcy lub anonim), when wysyła NUL w parametrze lub polu tekstowym dowolnej trasy, then dostaje 4xx bez treści błędu bazy (bez SQL, bez wartości pola), a log nie zawiera surowego wyjątku z bazy. — verified by: test parametrów i pól body (asercja na treść odpowiedzi), przegląd logu w jednym przypadku

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

<Do uzupełnienia przez implementującego.>

## Implementation notes

- Wybór właściciela (2026-11-02): kontrola przez test inwentarza w runtime, nie przez regułę ESLint. Trasy wołają `validate(schema, body)` w handlerze zamiast `schema` Fastify, więc regułę statyczną łatwo obejść innym zapisem kodu.
- Tabela przykładowych żądań: dla każdej trasy (metoda + ścieżka) poprawne parametry i body, z danymi z `test/factories.ts`. Mutacja NUL dotyczy każdego parametru i każdego pola typu string w tym body. Obiekty i tablice przechodzić rekurencyjnie.
- Przypadek z NUL wysyłać jako zalogowany właściciel zasobu, żeby żądanie doszło do walidacji i domeny, a nie skończyło się na 401/404 przed nimi. Wariant anonimowy i obcy (test 4) sprawdza tylko „nigdy 500”.
- Trasy z limitem żądań (`perIp`) dostają losowy IP (`randomIp`) na każde żądanie, żeby 429 nie zastąpiło prawdziwej odpowiedzi.
- Zapisać regułę w `layers/backend.md` („Pułapki”): nowa trasa wymaga wpisu w tabeli testu inwentarza. Zaktualizować wiersz TH-20 w `threat-model.md` („Weryfikacja”: test inwentarza tras z NUL).
