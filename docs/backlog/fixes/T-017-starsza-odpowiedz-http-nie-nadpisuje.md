---
id: T-017
title: "Spóźniona odpowiedź HTTP nie nadpisuje nowszej zmiany z WebSocket; jeden zegar updatedAt"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: done               # todo | in-progress | in-qa | done | blocked
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

## QA round 1 (2026-10-29)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | web, spójność reguły api.md | `useAddItem.added` (`apps/web/src/screens/SC-06-lista/useAddItem.ts:61`) nadal bezwarunkowo wstawia odpowiedź `POST` do cache. Gdy inna osoba zdąży na żywo edytować albo usunąć nową pozycję przed spóźnioną odpowiedzią na dodanie, odpowiedź nadpisze nowszą wersję albo przywróci usuniętą. Ta sama klasa błędu co T-017, wąskie okno wyścigu, poza AC. | odczyt kodu; `replaceItem`/`upsertNewer` używają `isNewer`, `added` nie | Odpowiedź na dodanie przechodzi przez `isNewer` (i nie przywraca pozycji usuniętej na żywo), osobne zadanie |
| 2 | note | testy | Nowe testy 1 i 2 czekają na `delay(100)` z wyłączeniem reguły T-021 (uzasadnione: kolejność WS przed HTTP). Deterministyczny wariant: zwolnić odpowiedź po potwierdzeniu, że zdarzenie WS trafiło do cache. | `ListScreen.live.test.tsx` | opcjonalnie |
| 3 | note | api | `touchList` i zmiana nazwy listy nadal stemplują `updated_at` listy `now()` bazy; opisane w „Root cause”, klient nie porównuje nim wersji. | `items-repository.ts:158` | ewentualnie osobne zadanie |

**Reprodukcja:** `pnpm install --frozen-lockfile`; `pnpm test` 89 plików / 423 testy pass; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 naruszeń zależności) bez błędów; `pnpm test:e2e` 36/36 pass (w tym J-05 na żywo, J-03 pozycje i kupione). `git status` czysty po instalacji.

**Kryteria:**

- AC1 pass: testy 1 i 2 (`ListScreen.live.test.tsx`) wysyłają nowszą wersję Tomka przez podstawiony klient WS przed odpowiedzią Ani i sprawdzają widoczny stan (notatka „2 l”, „2 do kupienia”, Mleko w „Do kupienia”). Test 2 pokrywa też przypadek brzegowy „własne zdarzenie WS z tym samym `updatedAt` co odpowiedź” (ogłoszenie „Odhaczono Mleko” działa).
- AC2 pass: testy 3 i 4 (`items.update.test.ts`, prawdziwy Postgres) sterują `testClock` i sprawdzają literalne znaczniki dla edycji, odhaczenia i dodania.
- AC3 pass: pełny zestaw testów i e2e zielone; istniejące mocki MSW zapisu poprawione na nowsze `updatedAt` (`savedItem`), bez osłabienia asercji.

**Spot-check (fix):** usunięcie `isNewer` z `replaceItem` → testy 1 i 2 czerwone; `updatedAt: sql\`now()\`` w `update` oraz pominięcie `createdAt`/`updatedAt` w `insert` → testy 3 i 4 czerwone (czas zegara bazy zamiast `testClock`). Przywrócone, `git status` czysty. Czerwone dowody w „Evidence” obecne dla wszystkich 4 testów. „Root cause” wyjaśnia, dlaczego testy nie złapały błędu (mocki z niezmienionym `updatedAt`, brak sterowania zegarem).

**Przegląd kodu:** jedna reguła `isNewer` współdzielona przez HTTP (`replaceItem`) i WS (`upsertNewer`) — bez duplikacji wiedzy. Porównanie leksykalne ISO jest poprawne, bo API zawsze zwraca `toISOString()`. Remis (`=`) zachowuje posiadaną wersję. `replaceItem` mapuje tylko istniejące wiersze, więc nie przywraca pozycji usuniętej na żywo. Odhaczenie już odhaczonej (F-10) zwraca starszy `updatedAt` i jest słusznie ignorowane. `changeItem` z edycją i odhaczeniem w jednym `PATCH` używa dwóch odczytów tego samego zegara (rosnących), wynik ma znacznik odhaczenia. Brak zmian UI/stylów (design-check nie dotyczy), `threats: []` — brak prób exploitów do wykonania; autoryzacja tras bez zmian.
