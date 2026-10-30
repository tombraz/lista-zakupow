---
id: T-029
title: "Równoległe dodawanie pozycji nie gubi wyniku ani błędu wcześniejszego zapisu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-020, T-024]
---

# T-029 Równoległe dodawanie pozycji nie gubi wyniku ani błędu wcześniejszego zapisu

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-1.md`, C1.

- **Actual:**
  - `useAddItem` dopuszcza równoległe zapisy. Wyjątek od lintu ma uzasadnienie „wpisanie i Enter w trakcie zapisu wysyła nową treść” (`apps/web/src/screens/SC-06-lista/useAddItem.ts:8`).
  - `onSuccess` i `onError` są jednak podane do `mutation.mutate(…)` (`:84-95`). TanStack Query v5 wywołuje te funkcje tylko dla ostatniego wywołania `mutate`: nowe wywołanie nadpisuje opcje i odpina obserwatora od poprzedniej mutacji.
  - Przy Enter w trakcie zapisu pierwszej pozycji nie wykonuje się jej `added()`: brak wpisu do cache, czyszczenia szkicu i ogłoszenia. Bez echa WS pozycja nie pojawia się mimo 201. Nie wykonuje się też `failed()`, więc błąd pierwszej (duplikat, limit) ginie po cichu.
  - `useCheckItem.ts:53-66` rozwiązuje to poprawnie: wywołania zwrotne siedzą w opcjach `useMutation`.
- **Expected:** każdy wysłany zapis dostaje swój wynik: pozycja na liście i ogłoszenie albo komunikat błędu. Źródło: F-07, SC-06 „Accessibility” (ogłoszenie dodania), T-006 AC.
- **Steps to reproduce:**
  1. SC-06, wpisać „Mleko” i Enter. Odpowiedź API jest wstrzymana, a WS odłączony albo opóźniony.
  2. Wpisać „Chleb” i Enter.
  3. Zwolnić obie odpowiedzi: „Mleko” nie pojawia się w liście ani w ogłoszeniu.
- **Environment:** lokalnie; `0bd3f0a`.
- **Evidence:** `ListScreen.add.test.tsx:288-306` wysyła drugą pozycję dopiero po `response.release()`, więc zapisy się nie nakładają.

## Acceptance criteria

- [ ] AC1: Given pierwsze dodanie w toku (wstrzymana odpowiedź) i brak echa WS, when użytkownik doda drugą pozycję, a obie odpowiedzi dojdą, then obie pozycje są na liście i obie są ogłoszone. — verified by: test komponentu SC-06 z `heldResponse()`
- [ ] AC2: Given pierwsze dodanie w toku, when druga pozycja zostanie wysłana, a pierwsza dostanie 409 `duplicate_item` lub `limit_reached`, then użytkownik widzi ostrzeżenie dla pierwszej. — verified by: test komponentu SC-06
- [ ] AC3: No regression in: J-03, T-020 (blokada podwójnego wysłania tej samej treści, idempotentne `id`), T-024 (tylko nowsza wersja), T-023.

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW i `heldResponse()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `keeps the first item when a second one is added while the first is saving` | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `shows the warning for the first item when it fails while a second is saving` | komponent | Vitest + RTL + MSW | AC2 |

**Run:** `pnpm vitest run --project web SC-06`

## QA plan

- **Regression:** J-03, T-020, T-024.
- **Edge cases:** szkic po pierwszym sukcesie nie kasuje treści wpisanej dla drugiej; ogłoszenia nie nadpisują się bez śladu.
- **Platforms:** Chrome na komputerze, Safari iOS z VoiceOver.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

Przyjęte przez użytkownika (2026-10-30): reguła lint `no-restricted-syntax` na drugi argument `mutate(vars, { onSuccess | onError | onSettled })` w `apps/web/src`. Wywołania zwrotne tylko w opcjach `useMutation` / `useGuardedMutation`. Dodać w ramach tego zadania (dziś złamałaby lint w `useAddItem.ts`). Przy okazji sprawdzić inne wywołania `mutate` z drugim argumentem.

## Incident note
