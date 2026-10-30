---
id: T-032
title: "Utworzenie listy wysyła lists.changed do właściciela (inne karty i urządzenia)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa                 # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-05, F-14, N-06]
threats: []
screens: [SC-05]
related_tasks: [T-003, T-005, T-009, T-025]
---

# T-032 Utworzenie listy wysyła lists.changed do właściciela (inne karty i urządzenia)

## Report

Źródło: QA T-025 runda 1 #3.

- **Actual:** `POST /api/v1/lists` (`apps/api/src/modules/listy/http/routes.ts:49-54`) nie wysyła żadnego zdarzenia. `PATCH` i `DELETE` tej samej trasy wysyłają `lists.changed` (`:77`, `:89`). Nowa lista utworzona na telefonie albo w drugiej karcie nie pojawia się na otwartym SC-05 w innej karcie tego samego konta; ta karta nie widzi też, że osiągnięto limit 50 list (dopiero 409 przy próbie utworzenia, T-025).
- **Expected:** po utworzeniu listy kanał `user:<id>` właściciela dostaje `lists.changed`, a SC-05 w jego innych kartach i na innych urządzeniach odświeża się w ≤ 5 s. — source: `docs/architecture/architecture.md:125` („`lists.changed` do kanałów `user:<id>` wszystkich osób z dostępem”), F-14, N-06, SC-05 „Zmiany innych osób … pojawiają się bez odświeżania”.
- **Steps to reproduce:**
  1. Zaloguj się w dwóch kartach, w obu SC-05.
  2. W karcie A utwórz listę.
  3. W karcie B lista się nie pojawia (aż do odświeżenia lub powrotu do okna).
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` @ `387a8e8`.
- **Evidence:** `routes.ts`: `live.notify(…, { type: "lists.changed" })` tylko w `PATCH` i `DELETE`.

## Acceptance criteria

- [x] AC1: Given właściciel z otwartym kanałem na żywo, when utworzy listę przez `POST /api/v1/lists`, then jego kanał użytkownika dostaje `lists.changed`. — verified by: test API (`app.inject` + klient WebSocket)
- [x] AC2: Given odmowa (409 `limit_reached`, 400 walidacji), when `POST /api/v1/lists`, then zdarzenie nie jest wysyłane. — verified by: test API
- [x] AC3: Given inny użytkownik z kanałem na żywo, when właściciel tworzy listę, then on nie dostaje zdarzenia (lista nie jest jeszcze udostępniona; TH-04). — verified by: test API
- [x] AC4: No regression in: J-02 (utworzenie listy), T-009 (zmiany na żywo), T-025 (SC-05 po 409).

## TDD plan

**Seam:** HTTP API + kanał WebSocket (jak w istniejących testach `lists.changed` dla PATCH/DELETE)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `POST /lists notifies the owner with lists.changed` | integracja API | Vitest + Fastify inject + WS | AC1 |
| 2 | `POST /lists sends nothing when refused` | integracja API | Vitest + Fastify inject + WS | AC2 |
| 3 | `POST /lists does not notify other users` | integracja API | Vitest + Fastify inject + WS | AC3 |

**Run:** `pnpm vitest run --project api -t T-032`

## QA plan

- **Regression:** J-02, T-009, T-025; testy na żywo SC-05 (`ListsScreen.live.test.tsx`).
- **Edge cases:** utworzenie przy otwartej tylko jednej karcie (własna karta dostaje zdarzenie i odświeża listy — bez podwójnego ogłoszenia „Nowa lista: …” i bez ruchu fokusu); 409 limitu.
- **Platforms:** API (CI Linux); ręcznie dwie karty Chrome.

## Root cause

`POST /api/v1/lists` powstał w T-005, zanim istniał kanał na żywo; T-009 dopisał `lists.changed` do tras, które zmieniają **istniejące** listy (PATCH, DELETE, pozycje, przyjęcie zaproszenia), a tworzenie pominął. Testy T-009 (`live.lists.test.ts`) obejmowały tylko zmianę nazwy, usunięcie i zaproszenia — nie było przypadku „własna akcja w jednej karcie, druga karta tego samego konta”, a test SC-05 na żywo podstawia zdarzenie zamiast sprawdzać, kiedy API je wysyła.

Inne wystąpienia: brak. Wszystkie pozostałe trasy, które zmieniają zawartość SC-05 (`listy` PATCH/DELETE, `pozycje/http/item-events.ts`, `zaproszenia/http/invitation-events.ts`), już wysyłają `lists.changed`; utworzenie i odwołanie zaproszenia nie zmieniają SC-05.

Poprawka: `live.notify([user.id], { type: "lists.changed" })` po `createList` — świeża lista ma tylko właściciela, więc bez zapytania o osoby z dostępem. Web nie wymaga zmian: `LiveProvider` odświeża SC-05 na `lists.changed`, a `useNewListAnnouncement` ogłasza tylko listy z rolą `participant`, więc własna karta nie ogłasza nowej listy podwójnie ani nie rusza fokusu.

## Evidence

- Red (przed poprawką): `T-032: POST /lists notifies the owner with lists.changed` → `Error: no "lists.changed" within 1000 ms; got []` (`apps/api/test/live.lists.test.ts`). Testy AC2 i AC3 przechodziły już przed poprawką (strażnicy regresji).
- Green: `pnpm vitest run --project api -t T-032` → 3 passed; `pnpm test` → 91 plików / 469 testów passed; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` bez błędów. Commit `8bd33f2`.
- Regresja: J-02 (`lists.create.test.ts`), T-009 (`live.*.test.ts`, `ListsScreen.live.test.tsx`), T-025 (`lists.limit.test.ts`, testy SC-05) w pełnym przebiegu — zielone.

## Prevention

## Incident note

<Nie dotyczy.>
