---
id: T-032
title: "Utworzenie listy wysyła lists.changed do właściciela (inne karty i urządzenia)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given właściciel z otwartym kanałem na żywo, when utworzy listę przez `POST /api/v1/lists`, then jego kanał użytkownika dostaje `lists.changed`. — verified by: test API (`app.inject` + klient WebSocket)
- [ ] AC2: Given odmowa (409 `limit_reached`, 400 walidacji), when `POST /api/v1/lists`, then zdarzenie nie jest wysyłane. — verified by: test API
- [ ] AC3: Given inny użytkownik z kanałem na żywo, when właściciel tworzy listę, then on nie dostaje zdarzenia (lista nie jest jeszcze udostępniona; TH-04). — verified by: test API
- [ ] AC4: No regression in: J-02 (utworzenie listy), T-009 (zmiany na żywo), T-025 (SC-05 po 409).

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

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
