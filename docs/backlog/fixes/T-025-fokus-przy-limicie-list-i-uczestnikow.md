---
id: T-025
title: "Fokus nie spada na body przy limicie list (SC-05) i uczestników (SC-07); blokada SC-05 znika po spadku liczby list"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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
| 1 | `moves focus to the limit warning when creating a link is refused (409)` | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `moves focus to the limit warning when members.changed fills the list` | komponent | Vitest + RTL + MSW | AC1 |
| 3 | `keeps focus off body after revoking a link on a full list` | komponent | Vitest + RTL + MSW | AC2 |
| 4 | `moves focus to the limit warning when a new list is refused (409)` | komponent | Vitest + RTL + MSW | AC3 |
| 5 | `re-enables „+ Nowa lista” after an own list is deleted` | komponent | Vitest + RTL + MSW | AC4 |

**Run:** `pnpm vitest run --project web`

## QA plan

- **Regression:** J-02, J-04, SC-06 limit pozycji (T-023), stan zapisu przycisków (T-015).
- **Edge cases:** limit przy otwartym formularzu; limit z innej karty bez fokusu na przycisku (fokus nie może „skakać”); unieważnienie, które zwalnia miejsce.
- **Platforms:** Chrome na komputerze (klawiatura), Safari iOS z VoiceOver.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

Przyjęte przez użytkownika (2026-10-30): w `layers/web.md` „Pułapki” jest lista kontrolna. Każde `disabled={…}` zależne od API lub zdarzeń na żywo ma test komponentu, który sprawdza, gdzie trafia fokus.

## Incident note
