---
id: T-042
title: "SC-05: ostrzeżenie limitu w pustym stanie i wygasanie odmowy 409 po liczbie list"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-05]
threats: []
screens: [SC-05]
related_tasks: [T-025, T-023, T-006]
---

# T-042 SC-05: ostrzeżenie limitu w pustym stanie i wygasanie odmowy 409 po liczbie list

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-2.md`, P11, P12, C15; QA T-025 runda 2 #1.

- **Actual:**
  - W pustym stanie SC-05 (`apps/web/src/screens/SC-05-moje-listy/ListsScreen.tsx:51-53`) nie ma `InlineAlert` limitu; jest tylko w gałęzi z listami (`:63-67`). Gdy 409 `limit_reached` przyjdzie przy 0 listach na ekranie (cache nieaktualny, np. zerwany WS), „Utwórz pierwszą listę” dostaje `disabled`, `limitRef` jest `null`, a fokus spada na `body`. Po odświeżeniu ostrzeżenie się pojawia, ale fokus już nie wraca (`useLimitFocus` reaguje tylko na przejście „nie limit → limit”).
  - `useNewList` pamięta odmowę jako referencję tablicy (`refusedFor === lists`, `useNewList.ts:13,21`). Gdy odświeżenie po 409 przyniesie te same dane (50. lista zniknęła w międzyczasie), structural sharing TanStack zostawia tę samą referencję i blokada trwa przy 49 listach.
  - SC-06 rozwiązuje ten sam problem liczbą (`atCount`, `SC-06-lista/useAddItem.ts:56-58,69`).
- **Expected:**
  - Przy limicie widać ostrzeżenie, przycisk jest nieaktywny, a po 409 fokus jest na ostrzeżeniu, także w pustym stanie. Źródło: `docs/design/screens/SC-05-moje-listy.md:45`, T-025 AC3.
  - Po spadku liczby własnych list poniżej liczby z chwili odmowy przycisk jest aktywny. Źródło: T-025 AC4.
- **Steps to reproduce:**
  1. Test komponentu: SC-05 z 0 list, kliknij „Utwórz pierwszą listę”, wyślij nazwę, API odpowiada 409, a odświeżenie zwraca 50 list. Fokus jest na `body`.
  2. Test komponentu: 49 list, 409, odświeżenie zwraca te same 49 list. „+ Nowa lista” zostaje `disabled`.
- **Environment:** lokalnie; `b8998c4`.
- **Evidence:** cytaty wyżej.

## Acceptance criteria

- [ ] AC1: Given SC-05 w pustym stanie z fokusem w formularzu nowej listy, when API odpowie 409 `limit_reached`, then ostrzeżenie o limicie jest widoczne i ma fokus (nie `body`). — verified by: test komponentu SC-05 (atrapa `test/disabledFocus.ts`)
- [ ] AC2: Given SC-05 po odmowie 409, when odświeżenie zwróci tyle samo albo mniej własnych list niż przy odmowie, then blokada obowiązuje do spadku liczby i przycisk wraca do aktywnego stanu, gdy liczba spadnie, niezależnie od tożsamości tablicy w cache. — verified by: test komponentu SC-05
- [ ] AC3: SC-05 i SC-06 wyznaczają wygaśnięcie odmowy limitu z API tą samą zasadą (liczba z chwili odmowy) przez jeden wspólny helper. — verified by: przegląd kodu i istniejące testy SC-06
- [ ] AC4: No regression in: J-02, T-025 (testy fokusu SC-05), T-023 (limit pozycji SC-06).

## TDD plan

**Seam:** ekran SC-05 przez `renderApp` z MSW

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | 409 w pustym stanie → fokus na ostrzeżeniu | component | vitest + Testing Library | AC1 |
| 2 | 409, odświeżenie z tymi samymi 49 listami, potem usunięcie listy → przycisk aktywny | component | vitest + Testing Library | AC2 |

**Run:** `pnpm vitest run apps/web/src/screens/SC-05-moje-listy apps/web/src/screens/SC-06-lista`

## QA plan

- **Regression:** J-02 (utworzenie listy), limit 500 pozycji w SC-06.
- **Edge cases:** 409 przy 0, 49 i 50 listach na ekranie; `lists.changed` w trakcie odświeżenia.
- **Platforms:** web na komputerze i telefonie.

## Root cause

## Evidence

## Prevention

<!-- QA rounds are appended below by /qa-task -->
