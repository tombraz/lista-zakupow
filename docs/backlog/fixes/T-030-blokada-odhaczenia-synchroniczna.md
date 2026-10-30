---
id: T-030
title: "Blokada podwójnego odhaczenia przez useGuardedMutation z lockOf; test, który ją dowodzi"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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
| 1 | `ignores a second click on the same item before re-render (one request)` (czerwony po usunięciu blokady) | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `checks two different items in quick succession` | komponent | Vitest + RTL + MSW | AC2 |

**Run:** `pnpm vitest run --project web ListScreen.check` i `pnpm lint`

## QA plan

- **Regression:** J-03, fokus po odhaczeniu (następna / poprzednia), ogłoszenia.
- **Edge cases:** odhaczenie i odznaczenie tej samej pozycji szybko po sobie; zdarzenie na żywo w trakcie zapisu.
- **Platforms:** Chrome na komputerze, telefon (dotyk).

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note
