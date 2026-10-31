---
id: T-030
title: "Blokada podwójnego odhaczenia przez useGuardedMutation z lockOf; test, który ją dowodzi"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-08]
threats: []
screens: [SC-06]
related_tasks: [T-007, T-020]
---

# T-030 Blokada podwójnego odhaczenia przez useGuardedMutation z lockOf; test, który ją dowodzi

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-1.md`, C2.

- **Actual:**
  - `useCheckItem` blokuje drugie odhaczenie tej samej pozycji przez `saving.has(item.id)` na asynchronicznym `useState` (`apps/web/src/screens/SC-06-lista/useCheckItem.ts:35,68-71`). Ma wyjątek od lintu `no-restricted-imports` z uzasadnieniem „różne pozycje odhaczane naraz” (`:2`).
  - `useGuardedMutation` ma już `lockOf`, czyli blokadę synchroniczną na klucz (`apps/web/src/api/useGuardedMutation.ts`). Korzysta z niej SC-07 (`useInvitations.ts`), więc uzasadnienie wyjątku jest nieaktualne.
  - Test `ListScreen.check.test.tsx:91-104` robi dwa `await user.click`. Według `docs/architecture/layers/web.md:83` taki test przechodzi także bez blokady, więc nie złapie regresji.
- **Expected:** jedna synchroniczna blokada wysłania dla wszystkich zapisów z przycisku i test na dwóch `fireEvent.click` bez `await` między nimi. Źródło: `layers/web.md:83`, T-020.
- **Steps to reproduce:**
  1. Usunąć `if (saving.has(item.id)) return;` z `useCheckItem.ts`.
  2. `pnpm vitest run --project web ListScreen.check`: test „ignores more clicks while saving” dalej przechodzi.
- **Environment:** lokalnie; `0bd3f0a`.
- **Evidence:** jak wyżej.

## Acceptance criteria

- [ ] AC1: Given pozycja w trakcie zapisu, when padną dwa kliknięcia bez przerysowania między nimi (`fireEvent.click` ×2 bez `await`), then API dostaje jedno żądanie. Test nie przechodzi bez blokady. — verified by: test komponentu SC-06
- [ ] AC2: Given dwie różne pozycje, when użytkownik odhaczy je szybko po sobie, then oba żądania idą, a obie pozycje są odhaczone, z fokusem i ogłoszeniem jak dziś. — verified by: test komponentu SC-06
- [ ] AC3: `useCheckItem` korzysta z `useGuardedMutation` z `lockOf` po `itemId`, a wyjątek `eslint-disable` jest usunięty z pliku i z listy wyjątków w `layers/web.md:83`. — verified by: `pnpm lint`
- [ ] AC4: No regression in: J-03 (odhaczenie), T-007, T-020.

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW i `heldResponse()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `ignores a second click on the same item before re-render (one request, T-030)` (czerwony bez blokady synchronicznej) | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `checks two different items in quick succession (T-030)` (czerwony przy blokadzie bez `lockOf`) | komponent | Vitest + RTL + MSW | AC2 |

**Run:** `pnpm vitest run --project web ListScreen.check` i `pnpm lint`

## QA plan

- **Regression:** J-03, fokus po odhaczeniu (następna / poprzednia), ogłoszenia.
- **Edge cases:** odhaczenie i odznaczenie tej samej pozycji szybko po sobie; zdarzenie na żywo w trakcie zapisu.
- **Platforms:** Chrome na komputerze, telefon (dotyk).

## Root cause

`useCheckItem` (T-007) blokował drugie odhaczenie przez `saving` w `useState`, a T-020 zostawił go jako wyjątek od lintu, bo `useGuardedMutation` nie miał jeszcze `lockOf`. Stan z `useState` widać dopiero po przerysowaniu, więc dwa kliknięcia w jednym przebiegu React (bez przerysowania między nimi) wysyłały dwa `PATCH`. Istniejący test tego nie złapał z dwóch powodów: `await user.click` daje czas na przerysowanie, a `setSaving` przed `mutate` sprawia, że nawet `fireEvent.click` ×2 przerysowuje `ItemRow` (stan „zapisywanie” ignoruje kliknięcia, `ItemRow.tsx:73`) — test przechodził także bez blokady w hooku.

Poprawka: `useGuardedMutation` z `lockOf: ({ itemId }) => itemId`; `setFailure` / `setSaving` w `onMutate` (tylko gdy zapis naprawdę rusza, jak w SC-07). Wyjątek `eslint-disable` usunięty; `layers/web.md` „Pułapki” bez wyjątku, z opisem testu w jednym `act`.

Inne wystąpienia: brak — `grep "eslint-disable.*no-restricted-imports" apps/web/src` jest pusty, wszystkie zapisy idą przez `useGuardedMutation`.

Znalezisko poza zakresem (istniało przed zmianą): przy szybkim odhaczeniu dwóch sąsiednich pozycji cel fokusu drugiej (liczony w chwili kliknięcia, `neighbourOf`) to pierwsza, która już jest w zwiniętym „Kupione” — fokus nigdzie nie trafia (w przeglądarce spada na `body`, WCAG 2.4.3). Test #2 nie sprawdza fokusu z tego powodu. Propozycja osobnego zadania.

## Evidence

- Czerwone przed poprawką: #1 `expected [ { …(2) }, { …(2) } ] to deeply equal [ { …(2) } ]` (dwa `PATCH` tej samej pozycji; kliknięcia w jednym `act`). Wariant z samym `fireEvent.click` ×2 (bez wspólnego `act`) przechodził także po usunięciu `if (saving.has(item.id)) return;` — potwierdza raport.
- #2 czerwony, gdy `useGuardedMutation` bez `lockOf` (blokada wspólna): `Tests 1 failed | 10 passed`.
- Po poprawce: `ListScreen.check` 11/11 (3 przebiegi); web + tokens 26 plików / 229 testów; `pnpm test` 92 pliki / 498 testów; `pnpm lint`, `pnpm typecheck`, Prettier, `pnpm quality`, `pnpm design-check` czyste; build web OK. E2E nie uruchamiane (zmiana w hooku, pokryta testami komponentu; J-03 bez zmian w zachowaniu).

## Prevention

Co by zapobiegło: wyjątek od lintu w komentarzu przeżył zmianę, która usunęła jego powód (`lockOf` w T-020) — nikt nie musiał go ponownie uzasadnić. Test przechodził bez blokady, bo przerysowanie w `act` dawało ochronę przypadkiem.

- Zrobione w zadaniu (AC3): „Pułapki” w `layers/web.md` bez wyjątku i z opisem testu w jednym `act`.
- Przyjęte przez użytkownika (2026-10-30): `@eslint-community/eslint-plugin-eslint-comments` 4.8.1, reguła `eslint-comments/no-restricted-disable` dla `no-restricted-imports` w `apps/web` — wyjątek od blokady wysłania tylko przez `eslint.config.js`, nie komentarzem w kodzie. Sprawdzone: przywrócony `// eslint-disable-next-line no-restricted-imports` w `useCheckItem.ts` daje `Disabling 'no-restricted-imports' is not allowed`; bez niego `pnpm lint` czysty.
- Znalezisko o fokusie przy dwóch odhaczeniach: T-039.

## Incident note

## QA round 1 (2026-10-30)

Verdict: pass

Kryteria: AC1 pass (test #1 w jednym `act`; czerwony po usunięciu `if (locked.current.has(lock)) return;` w `useGuardedMutation` — spot-check QA), AC2 pass (test #2 czerwony przy `lockOf` → `() => undefined` — spot-check QA; fokus nie sprawdzany, patrz #1), AC3 pass (`pnpm lint` czyste, `grep "eslint-disable.*no-restricted-imports" apps/web/src` pusty, `web.md:85` bez wyjątku), AC4 pass (`pnpm test` 498/498, E2E `j03` 14/14 na telefonie i komputerze; `ListScreen.check` 11/11).

Sprawdzone też: `pnpm typecheck` czyste; `design-check` SC-06 bez `HARD-CODED`. Testy eksploracyjne (tymczasowy plik, usunięty): ponowienie po błędzie 500 wysyła nowe żądanie (blokada zwolniona w `onSettled`); trzy kliknięcia w jednym `act` + czwarte w trakcie zapisu → jedno żądanie; odhaczenie i odznaczenie tej samej pozycji po sobie → dwa żądania (`checked: true`, potem `false`). Root cause wyjaśnia, czemu stary test nie łapał błędu.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | a11y / poza zakresem | Opisane przez autora: przy szybkim odhaczeniu dwóch sąsiednich pozycji cel fokusu drugiej (`neighbourOf` w chwili kliknięcia) to pierwsza, już w zwiniętym „Kupione” — fokus spada na `body` (WCAG 2.4.3). Istniało przed T-030; brak zadania w backlogu. | `useCheckItem.ts:80,90-95`; sekcja „Root cause” | Osobne zadanie fix: cel fokusu liczony przy zapisie albo pominięcie pozycji w trakcie zapisu. |
| 2 | note | proces | Sekcja „Prevention” pusta. | plik zadania | Uzupełnić po QA (jak T-037), jeśli proces tego wymaga. |
