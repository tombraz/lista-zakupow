---
id: T-029
title: "Wywołania zwrotne zapisu w opcjach hooka, nie w mutate (uśpiona utrata wyniku dodania)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-020, T-024]
---

# T-029 Wywołania zwrotne zapisu w opcjach hooka, nie w mutate (uśpiona utrata wyniku dodania)

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

**Zmiana klasyfikacji (2026-10-30, decyzja użytkownika):** scenariusz z raportu jest nieosiągalny z UI (patrz Evidence): `AddBar` w czasie zapisu nic nie wysyła. Zadanie zmienia się z `bug` na `small-change`. Cel: utwardzić kod, żeby wadliwy wzorzec nie mógł się obudzić. Wywołania zwrotne trafiają do opcji hooka, regułę lint wymusza `pnpm lint`, poprawione zostaje nieprawdziwe uzasadnienie wyjątku. Pierwotne AC1–AC3 zastąpione poniższymi.

## Acceptance criteria

- [ ] AC1: Given wywołanie `mutate(vars, { onSuccess | onError | onSettled })` w `apps/web/src`, when `pnpm lint`, then błąd `no-restricted-syntax` z odesłaniem do T-029. — verified by: `pnpm lint` (red: 6 błędów przed zmianą)
- [ ] AC2: Wszystkie zapisy w `apps/web/src` mają wywołania zwrotne w opcjach `useGuardedMutation` / `useMutation`: `useAddItem`, `useEditItem` (zapis i usunięcie), `useListNameForm`, `useSignInForm`, `useSignUpForm`. Dodawanie pozycji idzie przez `useGuardedMutation`, bez wyjątku lintu. — verified by: `pnpm lint`, grep `eslint-disable` w `useAddItem.ts`
- [ ] AC3: Given dodanie w toku, when użytkownik wpisze inną treść i naciśnie Enter, then nic nie zostaje wysłane, a po odpowiedzi pierwsza pozycja jest na liście, jest ogłoszona i wpisana treść zostaje w polu. — verified by: `ListScreen.add.test.tsx` › sends nothing when Enter is pressed while the previous item is saving (T-029)
- [ ] AC4: No regression in: J-01, J-03, T-006 (dodanie, ponowienie z tym samym `id`), T-020, T-024, edycja i usuwanie pozycji, zmiana nazwy listy (SC-05/SC-06), logowanie (SC-01), rejestracja (SC-02).

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW i `heldResponse()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | reguła `no-restricted-syntax` (`WEB_MUTATE_SYNTAX` w `eslint.config.js`) | statyczny | ESLint | AC1, AC2 |
| 2 | `sends nothing when Enter is pressed while the previous item is saving (T-029)` | komponent | Vitest + RTL + MSW | AC3 |

**Run:** `pnpm lint`; `pnpm vitest run --project web ListScreen.add`

## QA plan

- **Regression:** J-01, J-03, T-006, T-020, T-024; edycja i usunięcie pozycji, zmiana nazwy listy, logowanie, rejestracja.
- **Edge cases:** wywołania zwrotne opcji hooka działają także po odmontowaniu, a te z `mutate` nie. Sprawdzić: zamknięcie arkusza „Edytuj pozycję” w trakcie zapisu (cache dostaje odpowiedź, brak błędów w konsoli); wyjście z SC-02 w trakcie rejestracji (po odpowiedzi sesja i przekierowanie jak po zwykłej rejestracji). Szybkie podwójne Enter w AddBar daje jedno żądanie (`useGuardedMutation`).
- **Platforms:** Chrome na komputerze, Safari iOS z VoiceOver.

## Root cause

`useAddItem` (T-006) podawał `onSuccess`/`onError` w drugim argumencie `mutate`. TanStack Query wywołuje je tylko dla ostatniego `mutate`, więc przy dwóch dodaniach naraz pierwsze gubiłoby wynik albo błąd. Dziś do tego nie dochodzi, bo `AddBar` (od T-006, `AddBar.tsx:39`) w czasie zapisu nic nie wysyła. Wyjątek od lintu T-020 opisał to zachowanie błędnie („Enter w trakcie zapisu wysyła nową treść”). Na tym błędnym opisie przegląd E-01 oparł C1.

**Dlaczego testy nie złapały:** zachowanie jest nieosiągalne z UI, więc żaden test nie może pokazać utraty wyniku. Brakowało za to testu, że Enter w trakcie zapisu nic nie wysyła. To od tej blokady zależy poprawność (dodany, AC3). Żadna reguła nie pilnowała miejsca wywołań zwrotnych.

**Inne wystąpienia:** ten sam wzorzec w `useEditItem` (zapis, usunięcie), `useListNameForm`, `useSignInForm`, `useSignUpForm`. Wszystkie przez `useGuardedMutation`, czyli jeden zapis naraz, więc bez utraty wyniku. Przeniesione razem z `useAddItem`, bo obejmuje je przyjęta reguła lint. `useCheckItem` miał już wywołania zwrotne w opcjach hooka.

## Evidence

**Próba reprodukcji (2026-10-30): scenariusz z raportu nieosiągalny z UI.**

- Testy komponentu SC-06 (`ListScreen.add.test.tsx`, osobny `heldResponse()` dla każdej nazwy): „Mleko{Enter}”, wyczyszczenie pola, „Chleb{Enter}”. Wszystkie trzy padają na `expect.poll(() => requests.length).toBe(2)`: `expected 1 to be 2`. Drugie żądanie nigdy nie wychodzi.
- Przyczyna: `AddBar` od T-006 (`apps/web/src/components/AddBar/AddBar.tsx:39`) ignoruje wysłanie, gdy `pending`: `if (!pending) onSubmit();`. W trakcie zapisu można pisać, ale wysłać nie można. Dwa równoległe `mutate` z różną treścią nie powstają.
- Uzasadnienie wyjątku lintu w `useAddItem.ts:8` („wpisanie i Enter w trakcie zapisu wysyła nową treść”) jest więc nieprawdziwe. Wadliwy wzorzec (wywołania zwrotne w `mutate`) jest uśpiony: wystarczy zdjąć blokadę z `AddBar`, żeby zgubić wynik.
- Jedyne okno: `isPending` dochodzi do renderu z opóźnieniem planowania TanStack Query, więc bardzo szybkie podwójne wysłanie może przejść blokadę. Ta sama treść ma wtedy to samo `id` (T-006 AC6), serwer odpowiada tą samą pozycją, a wywołania zwrotne drugiego `mutate` dodają ją do listy. Skutku widocznego dla użytkownika brak.

**Red (po zmianie klasyfikacji):** reguła `WEB_MUTATE_SYNTAX` w `eslint.config.js`, `pnpm eslint apps/web/src` przed zmianą kodu: 6 błędów `no-restricted-syntax` (`listName.ts:40`, `useSignInForm.ts:41`, `useSignUpForm.ts:97`, `useAddItem.ts:85`, `useEditItem.ts:76`, `useEditItem.ts:117`).

**Green:** `pnpm lint` 0 błędów i ostrzeżeń; `pnpm test` 91 plików / 461 testów pass (w tym nowy test AC3); `pnpm typecheck`, `pnpm format:check`, `pnpm quality` (0 klonów, 0 naruszeń zależności), `pnpm build` (exit 0). Testy reprodukujące z pierwszej próby usunięte, bo opisywały zachowanie nieosiągalne z UI.

## Prevention

**Co by zapobiegło:** reguła, która nie pozwala podać wywołań zwrotnych w `mutate`, oraz test blokady wysłania w AddBar, od której zależy poprawność.

**Przyjęte przez użytkownika (2026-10-30), zrobione:**

- lint `no-restricted-syntax` (`WEB_MUTATE_SYNTAX` w `eslint.config.js`) na `mutate` z dwoma argumentami w `apps/web/src` (bez testów); komunikat odsyła do `layers/web.md`,
- wpis „Pułapki” w `docs/architecture/layers/web.md` i poprawiony wpis T-020 o wyjątkach (dodawanie pozycji bez wyjątku).

## Incident note

<Nie dotyczy.>
