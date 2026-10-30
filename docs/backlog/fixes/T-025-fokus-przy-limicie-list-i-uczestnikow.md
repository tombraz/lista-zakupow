---
id: T-025
title: "Fokus nie spada na body przy limicie list (SC-05) i uczestników (SC-07); blokada SC-05 znika po spadku liczby list"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-05, F-12, N-04]
threats: []
screens: [SC-05, SC-07]
related_tasks: [T-005, T-008, T-015, T-023]
---

# T-025 Fokus nie spada na body przy limicie list (SC-05) i uczestników (SC-07); blokada SC-05 znika po spadku liczby list

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-1.md`, S1, S2, P5.

- **Actual:**
  - SC-07: „Utwórz link” dostaje `disabled={full}` (`apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.tsx:104,143-150`), także gdy ma fokus. Dzieje się tak po 409 `limit_reached` (wtedy `useInvitations.ts:50-52` odświeża listę) albo po `members.changed`, gdy lista ma już 20 osób. Fokus spada na `body`, a ostrzeżenie limitu (`:118`) nie dostaje fokusu. Po unieważnieniu linku `onRevoked` (`:99-101`) przenosi fokus na wyłączony przycisk.
  - SC-05: po 409 `limit_reached` `refusedByLimit` (`apps/web/src/screens/SC-05-moje-listy/useNewList.ts:33-36`) zamyka formularz z fokusem. Przycisk „+ Nowa lista” wraca jako `disabled` (`ListsScreen.tsx:26`), więc fokus spada na `body`. To samo dzieje się, gdy `lists.changed` podnosi liczbę własnych list do 50, a fokus jest na przycisku.
  - SC-05 (P5): `refusedByApi` zostaje `true` na stałe (`useNewList.ts:12,20`). Po usunięciu listy (na żywo albo w innej karcie) przycisk dalej jest wyłączony, aż ekran zamontuje się ponownie.
- **Expected:**
  - Fokus przechodzi na ostrzeżenie limitu (`InlineAlert`, `tabIndex={-1}`), tak jak w SC-06 przy limicie 500 pozycji (`useLimitFocus`, T-023). Źródło: WCAG 2.4.3, `docs/architecture/layers/web.md:85`.
  - Blokada SC-05 po odmowie API trwa tylko, dopóki liczba własnych list się nie zmniejszy, tak jak `atCount` w `apps/web/src/screens/SC-06-lista/useAddItem.ts:56-58`. Źródło: `docs/design/screens/SC-05-moje-listy.md:45,57`, F-05.
- **Steps to reproduce:**
  1. SC-07: lista z 19 uczestnikami. W drugiej karcie ktoś dołącza, a w pierwszej fokus jest na „Utwórz link” (albo kliknięcie zwraca 409). Wtedy `document.activeElement` to `body`.
  2. SC-05: konto z 49 własnymi listami. W drugiej karcie powstaje 50. lista, a w pierwszej Enter w polu nazwy daje 409. Fokus jest na `body`.
  3. SC-05: po kroku 2 usunięcie listy w drugiej karcie. W pierwszej „+ Nowa lista” zostaje nieaktywny.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` @ `0bd3f0a`.
- **Evidence:** testy `ParticipantsScreen.test.tsx:290-316` i `ListsScreen.test.tsx:257-270` sprawdzają tylko `toBeDisabled()`.

## Acceptance criteria

- [ ] AC1: Given SC-07 z fokusem na „Utwórz link”, when API odpowie 409 `limit_reached` albo `members.changed` doprowadzi listę do 20 osób, then fokus jest na ostrzeżeniu o limicie, nie na `body`. — verified by: test komponentu SC-07 (atrapa `test/disabledFocus.ts`)
- [ ] AC2: Given SC-07 z pełną listą i otwartym linkiem, when właściciel unieważni link, then fokus nie spada na `body` (trafia na ostrzeżenie o limicie). — verified by: test komponentu SC-07
- [ ] AC3: Given SC-05 z formularzem nowej listy i fokusem w polu nazwy, when API odpowie 409 `limit_reached`, then fokus jest na ostrzeżeniu o limicie. To samo dla fokusu na „+ Nowa lista”, gdy `lists.changed` podniesie liczbę własnych list do 50. — verified by: test komponentu SC-05
- [ ] AC4: Given SC-05 po odmowie 409, when liczba własnych list spadnie poniżej liczby z chwili odmowy, then „+ Nowa lista” jest aktywny, a ostrzeżenie znika. — verified by: test komponentu SC-05
- [ ] AC5: No regression in: J-02 (utworzenie listy), J-04 (link, przyjęcie), T-023 (limit pozycji), T-015.

## TDD plan

**Seam:** ekran (`renderApp`) z MSW i podstawionym kanałem na żywo; fokus w przeglądarce w E2E, jeśli test komponentu nie wystarcza

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `focus at the limit of 20 participants (T-025) › moves focus to the limit warning when creating a link is refused (409)` | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `20th participant joins (T-025) › moves focus from „Utwórz link” to the limit warning` | komponent | Vitest + RTL + MSW (WS) | AC1 |
| 3 | `20th participant joins (T-025) › leaves focus elsewhere on the screen where it is` | komponent | Vitest + RTL + MSW (WS) | edge: fokus nie „skacze” |
| 4 | `focus at the limit of 20 participants (T-025) › keeps focus off body after revoking a link on a full list` | komponent | Vitest + RTL + MSW | AC2 |
| 5 | `focus at the limit of 20 participants (T-025) › leaves focus on the heading when the list is already full on entry` | komponent | Vitest + RTL + MSW | edge: brak kradzieży fokusu przy wejściu |
| 6 | `limit of 50 own lists (AC3) › moves focus to the limit warning when a new list is refused (409) (T-025)` | komponent | Vitest + RTL + MSW | AC3 |
| 7 | `limit of 50 own lists from another tab (T-025) › moves focus from „+ Nowa lista” to the limit warning at the 50th list` | komponent | Vitest + RTL + MSW (WS) | AC3 |
| 8 | `limit of 50 own lists (AC3) › leaves focus on the heading when the lists load already at the limit (T-025)` | komponent | Vitest + RTL + MSW | edge: brak kradzieży fokusu przy wejściu |
| 9 | `limit of 50 own lists from another tab (T-025) › re-enables „+ Nowa lista” after an own list is deleted following a refusal (409)` | komponent | Vitest + RTL + MSW (WS) | AC4 |

**Run:** `pnpm vitest run --project web src/screens/SC-05-moje-listy src/screens/SC-07-uczestnicy -t T-025`

## QA plan

- **Regression:** J-02, J-04, SC-06 limit pozycji (T-023), stan zapisu przycisków (T-015).
- **Edge cases:** limit przy otwartym formularzu; limit z innej karty bez fokusu na przycisku (fokus nie może „skakać”); unieważnienie, które zwalnia miejsce.
- **Platforms:** Chrome na komputerze (klawiatura), Safari iOS z VoiceOver.

## Root cause

SC-05 (T-005) i SC-07 (T-008) wyłączają przycisk (`disabled`), gdy limit przychodzi z odpowiedzi 409 albo z odświeżenia na żywo, i nic nie przenosi fokusu — przeglądarka zdejmuje go z elementu `disabled` (albo z zamkniętego formularza) i spada on na `body`; `onRevoked` na SC-07 dodatkowo celował w wyłączony przycisk. Blokada SC-05 po 409 była flagą `refusedByApi` bez warunku wygaśnięcia. Testy nie złapały tego, bo sprawdzały tylko `toBeDisabled()`; atrapa utraty fokusu (`test/disabledFocus.ts`, T-023) pojawiła się później i nikt nie dopisał asercji fokusu dla tych ekranów.

Poprawka: wspólny hook `useLimitFocus(reached, from)` w `components/useFocus.ts` (ta sama reguła co w SC-06, T-023: tylko przejście „nie limit → limit”, tylko gdy fokus jest na wyłączanym elemencie albo na `body`). SC-05: odmowa API trwa, dopóki serwer nie poda nowego stanu list (`refusedFor === lists`; TanStack Query zachowuje referencję przy niezmienionych danych), potem decyduje liczba własnych list. Po 409 `NewListForm` unieważnia `LISTS_KEY` (QA runda 1 #1): `POST /lists` nie wysyła `lists.changed`, więc bez tego ekran zostawał przy 49 listach, a po usunięciu 50. listy serwer zwracał te same 49 (ta sama referencja) i blokada nie znikała. To szersze niż AC4 („spadnie poniżej liczby z chwili odmowy”) celowo: przy odmowie ekran pokazuje 49 list (50. powstała w innej karcie), więc reguła `atCount` jak w SC-06 blokowałaby przycisk także po usunięciu tej 50. listy (49 ≥ 49) — scenariusz z kroku 3 raportu.

Inne wystąpienia: `AddItemBar.tsx` (SC-06) ma własną, prywatną wersję tej samej reguły (T-023) — można ją zastąpić wspólnym hookiem (wymaga refa formularza AddBar); poza zakresem, bez zmiany zachowania. Innych `disabled={…}` zależnych od API/na żywo w `apps/web/src/screens` nie ma (pozostałe: offline i `loading` przez `aria-disabled`, T-015).

## Evidence

- Red (przed poprawką): testy 1, 2, 4, 6, 7 padały na `expect(element).toHaveFocus()` — „Received element with focus:” pusty (`body`); test 9 na `toBeEnabled()` — „Received element is not enabled”. Testy 3, 5, 8 (strażniki) przechodziły już przed poprawką.
- Green: `pnpm test` — 91 plików, 460 testów zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm quality` (0 klonów, 0 naruszeń zależności), `pnpm design-check`, build web — OK. `pnpm format:check`: jedno ostrzeżenie w `apps/web/e2e/j03-pozycje.spec.ts` — istniało przed tą zmianą (plik z T-023, nietknięty).
- Lint React Compiler (`react-hooks/refs`) odrzucał ref ostrzeżenia zwracany w obiekcie `useNewList`, więc `useLimitFocus` jest wołany w `ListsScreen`.
- QA runda 1 #1 (red): test 9 bez sztucznego `lists.changed` po utworzeniu 50. listy w innej karcie (serwer go nie wysyła) padał na `toBeEnabled()` — „Received element is not enabled”. Green po unieważnieniu `LISTS_KEY` przy 409; test czeka też na 50 list na ekranie po odmowie. Test 6 ma w nazwie „T-025” (#2): `-t T-025` uruchamia 9 testów. Po rundzie: `pnpm test` 460/460, `typecheck`, `lint`, `quality`, build web — OK.
- E2E nie dopisano: atrapa `disabledFocus.ts` odtwarza spadek fokusu w jsdom (sprawdzone w T-023), a AC wskazują test komponentu.

## Prevention

Przyjęte przez użytkownika (2026-10-30): w `layers/web.md` „Pułapki” jest lista kontrolna. Każde `disabled={…}` zależne od API lub zdarzeń na żywo ma test komponentu, który sprawdza, gdzie trafia fokus.

## Incident note

## QA round 1 (2026-10-30)

Verdict: fail

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | AC4 / F-05, SC-05 | Krok 3 raportu nadal się odtwarza. Serwer nie wysyła `lists.changed` po `POST /api/v1/lists` (`apps/api/src/modules/listy/http/routes.ts`: tylko PATCH i DELETE), a `NewListForm` po 409 nie odświeża list. Po odmowie ekran pokazuje więc wciąż 49 list, a `refusedFor` to ta sama tablica. Gdy 50. lista zostanie usunięta gdzie indziej, `GET /api/v1/lists` zwraca te same 49 list. Structural sharing w TanStack Query zachowuje referencję, więc `refusedFor === lists` dalej daje `true` i „+ Nowa lista” zostaje `disabled`. | E2E w prawdziwym Chrome (doraźny spec QA, usunięty): 49 list, otwarty formularz, 50. lista przez API (ta sama sesja, bez zdarzenia na żywo), Enter → 409, „links shown after refusal: 49”. `DELETE` 50. listy → 204, potem `lists.changed` i refetch `GET` → 200 z 49 listami. Po 10 s `expect(„+ Nowa lista”).toBeEnabled()` daje „Received: disabled”. Test planu nr 9 przechodzi tylko dlatego, że między odmową a usunięciem wysyła sztuczne `lists.changed` z 50 listami, którego serwer nigdy nie wysyła. | Po odmowie 409, gdy liczba własnych list na serwerze spadnie poniżej liczby z chwili odmowy, „+ Nowa lista” jest aktywny, a ostrzeżenie znika. Np. po 409 unieważnić `LISTS_KEY`, żeby ekran pokazał prawdziwy stan (50 list), i wtedy liczba z serwera decyduje o blokadzie. Test nr 9 ma odwzorować prawdziwą sekwencję zdarzeń: bez `lists.changed` po utworzeniu listy w innej karcie. |
| 2 | minor | Testy | Test nr 6 z planu („limit of 50 own lists (AC3) › moves focus to the limit warning when a new list is refused (409)”) nie ma w nazwie „T-025”, więc polecenie `Run` z planu (`-t T-025`) uruchamia 8 z 9 testów. | `pnpm vitest run --project web … -t T-025` daje 8 testów, zielonych. Test nr 6 uruchomiony osobno przechodzi. | Nazwa albo polecenie obejmuje wszystkie zaplanowane testy. |
| 3 | note | API / F-14 | `POST /api/v1/lists` nie wysyła `lists.changed` do właściciela. Inne karty i urządzenia tego samego konta nie widzą nowej listy na żywo, więc ścieżka AC3 „`lists.changed` podnosi liczbę do 50” w praktyce zachodzi tylko przez inne zdarzenia (np. zmiana pozycji) albo przez refetch po powrocie do okna. Poza zakresem tego zadania (warstwa web). | `routes.ts`: `notify(..., lists.changed)` jest tylko w PATCH i DELETE. | Do decyzji użytkownika: osobne zadanie. |
| 4 | note | CI | `pnpm format:check` pada na `apps/web/e2e/j03-pozycje.spec.ts` (z T-023, nie z tego zadania), więc `pnpm check` jest czerwony. | Wyjście Prettier: „Code style issues found”. | Osobna poprawka formatowania. |

**Reprodukcja (QA):** `pnpm install --frozen-lockfile`, `pnpm services:up`, `pnpm test`: 91 plików, 460/460 zielonych. `typecheck`, `lint` (0 ostrzeżeń), `quality` (0 naruszeń), `design-check` (0 hard-coded) OK. `pnpm build` OK. E2E `j02` + `j04` (komputer): 7/7 zielonych.

**Kryteria:**
- AC1: pass. Testy 1 i 2 są zielone. Spot-check, w którym `useLimitFocus` nie przenosi fokusu, daje czerwone testy 1, 2, 6, 7 („Received element with focus:” pusty).
- AC2: pass. Test 4 jest zielony. Spot-check z powrotem `createRef.current?.focus()` w `onRevoked` daje czerwony test.
- AC3: pass. Prawdziwy Chrome: po prawdziwym 409 z serwera `document.activeElement` to `DIV[role=status]` z ostrzeżeniem o limicie. Testy 6 i 7 są zielone.
- AC4: fail (finding 1). Spot-check z trwałym `refusedByApi` daje czerwony test 9, ale test 9 nie pokrywa rzeczywistej sekwencji.
- AC5: pass. Pełny zestaw i E2E J-02, J-04 są zielone. Testy T-023 i T-015 w pakiecie są zielone.

**Root cause / prevention:** sekcja wyjaśnia, dlaczego testy nie wyłapały błędu (tylko `toBeDisabled()`). Testy nr 1, 2, 4, 6, 7 i 9 padają bez poprawki (spot-check). Strażniki 3, 5 i 8 przechodzą zgodnie z opisem.

**Do zmiany:** finding 1, czyli blokada po 409 musi wygasać po spadku liczby list na serwerze także wtedy, gdy ekran nie dostał zdarzenia o utworzeniu 50. listy. Do tego test odwzorowujący prawdziwą sekwencję. Opcjonalnie finding 2.
