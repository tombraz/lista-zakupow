---
id: T-017
title: "Spóźniona odpowiedź HTTP nie nadpisuje nowszej zmiany z WebSocket; jeden zegar updatedAt"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: in-qa               # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web, backend]
requirements: [F-14]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-007, T-009]
---

# T-017 Spóźniona odpowiedź HTTP nie nadpisuje nowszej zmiany z WebSocket; jeden zegar updatedAt

## Report

- **Actual:** `replaceItem` (`apps/web/src/screens/SC-06-lista/itemsCache.ts:33-36`, wołane z `useEditItem.ts`, `useCheckItem.ts`) bezwarunkowo podmienia pozycję odpowiedzią HTTP. Gdy zdarzenie WS ze zmianą osoby B dotrze przed spóźnioną odpowiedzią na zmianę A, autor A widzi swoją wersję, choć w bazie jest B. Do tego `updatedAt` pozycji ustawiają dwa zegary: edycja `now()` bazy (`apps/api/src/modules/pozycje/infra/items-repository.ts:85`), odhaczenie `Clock` aplikacji (`:129-130`).
- **Expected:** Cache klienta przyjmuje wersję pozycji tylko, gdy jej `updatedAt` jest nowsze niż posiadana (dla HTTP i WS); `updatedAt` pozycji zawsze z wstrzykiwanego `Clock` — source: T-009 AC4, `docs/architecture/api.md:95`, `layers/db.md` „Konwencje”
- **Steps to reproduce:**
  1. Test komponentu: edycja A z opóźnioną odpowiedzią MSW; w międzyczasie zdarzenie WS `item.updated` z nowszym `updatedAt` (B).
  2. Po odpowiedzi A cache pokazuje A.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #P1, #S6, #P3.

## Acceptance criteria

- [ ] AC1: Given zdarzenie WS z nowszym `updatedAt` przed odpowiedzią HTTP własnej zmiany, when przyjdzie odpowiedź, then SC-06 pokazuje nowszą wersję. — verified by: test komponentu SC-06 (podstawiony klient WS)
- [ ] AC2: Given `testClock` w API, when edycja pozycji, then `updatedAt` = czas z zegara (jak przy odhaczeniu). — verified by: test integracyjny API
- [ ] AC3: No regression in: J-05 (zmiany na żywo), własna zmiana bez podświetlenia, edycja i odhaczenie tej samej pozycji przez dwie osoby.

## TDD plan

**Seam:** cache SC-06 (`replaceItem` / `upsertNewer`); repozytorium pozycji

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `ListScreen.live.test.tsx` › keeps Tomek's newer edit when the response to Ania's own edit comes later | komponent | Vitest + RTL + MSW, podstawiony klient WS | AC1 |
| 2 | `ListScreen.live.test.tsx` › keeps Tomek's newer uncheck when the response to Ania's own check comes later | komponent | Vitest + RTL + MSW, podstawiony klient WS | AC1 |
| 3 | `items.update.test.ts` › stamps updatedAt of an edit with the app clock, as a check does | integracyjny API | Vitest + Fastify inject + Postgres | AC2 |
| 4 | `items.update.test.ts` › stamps createdAt and updatedAt of a new item with the app clock | integracyjny API | Vitest + Fastify inject + Postgres | AC2 (to samo źródło przy dodaniu) |

**Run:** `pnpm --filter @lista/web test`; `pnpm --filter @lista/api test`

## QA plan

- **Regression:** J-05 (zmiany na żywo), własna zmiana bez podświetlenia, edycja i odhaczenie tej samej pozycji przez dwie osoby
- **Edge cases:** odpowiedź HTTP z tym samym `updatedAt` co zdarzenie WS własnej zmiany (cache bez zmian, fokus i ogłoszenie działają); pozycja usunięta na żywo przed odpowiedzią na edycję (odpowiedź jej nie przywraca); edycja i odhaczenie w jednym `PATCH`; dodanie pozycji, potem edycja (oba znaczniki z jednego zegara)
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

`replaceItem` (od T-006) podmieniał pozycję odpowiedzią API bez porównania `updatedAt`; regułę api.md „tylko nowsza wersja” stosował tylko `upsertNewer` dla zdarzeń WS (T-009), więc spóźniona odpowiedź nadpisywała nowszą zmianę innej osoby. W API `updatedAt` pozycji ustawiały dwa zegary: edycja `now()` bazy (T-006), odhaczenie `Clock` aplikacji (T-007), a dodanie `defaultNow()` bazy — przy rozjechanych zegarach porównanie wersji w kliencie byłoby niewiarygodne.

**Dlaczego testy nie złapały:** mocki MSW zapisu zwracały pozycję z niezmienionym `updatedAt` (prawdziwe API zawsze daje nowsze), a jedyny test „WS przed odpowiedzią” (T-009) wysyłał to samo co odpowiedź; testy API edycji i dodania nie sterowały zegarem.

**Inne wystąpienia:** dodanie pozycji (`insert`, `defaultNow()`) — ta sama przyczyna i warstwa, poprawione tutaj. `touchList` i zmiana nazwy listy nadal używają `now()` bazy dla `updated_at` listy; służy ono tylko kolejności SC-05, klient nie porównuje nim wersji — bez zmian, ewentualnie osobne zadanie.

## Evidence

Red (przed poprawką):

- test 1: `TestingLibraryElementError: Unable to find an element with the text: /2 l/` (pokazana „1 l” z odpowiedzi Ani)
- test 2: `Unable to find an element with the text: 2 do kupienia` (Mleko w „Kupione” z odpowiedzi Ani)
- test 3: `- "updatedAt": "2026-10-28T10:05:00.000Z"  + "updatedAt": "2026-10-29T20:44:50.576Z"`
- test 4: `- "createdAt": "2026-10-28T09:00:00.000Z"  + "createdAt": "2026-10-29T20:51:49.777Z"`

Green: `pnpm test` 89 plików, 423 testy pass; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 klonów, 0 naruszeń zależności), `pnpm build` — bez błędów.

Mocki MSW zapisu w `ListScreen.check`, `.edit`, `.dup-bought` zwracają teraz nowsze `updatedAt` przez `savedItem` (`apps/web/test/lists.ts`), jak prawdziwe API — wcześniej przechodziły tylko dzięki brakowi porównania.

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
