---
id: T-023
title: "Fokus nie spada na body, gdy własne dodanie osiąga limit 500 pozycji"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07, N-04]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-015]
---

# T-023 Fokus nie spada na body, gdy własne dodanie osiąga limit 500 pozycji

## Report

- **Actual:** Gdy użytkownik doda 500. pozycję, `AddItemBar` dostaje `disabled` (`apps/web/src/screens/SC-06-lista/AddItemBar.tsx:38`: `disabled || state.limitReached`), więc pole „Co kupić?” (z fokusem) i „Dodaj” stają się `disabled` i fokus spada na `body`.
- **Expected:** AddBar nieaktywny i ostrzeżenie o limicie (SC-06, stan „Error — limit pozycji”, F-07), a fokus zostaje w sensownym miejscu, nie na `body` — source: `accessibility.md` „Build” (zarządzanie fokusem), WCAG 2.4.3. Gdzie ma trafić fokus (ostrzeżenie, pole z `aria-disabled`/`readOnly`), spec SC-06 nie mówi — do decyzji użytkownika w `/fix`.
- **Decyzja użytkownika (2026-10-30):** fokus na ostrzeżeniu o limicie (`InlineAlert`, `tabIndex={-1}`), AddBar zostaje naprawdę nieaktywny (`disabled`).
- **Steps to reproduce:**
  1. Lista z 499 pozycjami, fokus w „Co kupić?”.
  2. Dodaj pozycję Enterem; po odpowiedzi API `document.activeElement` to `body`.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** znalezione przy T-015 (sekcja „Root cause”, inne wystąpienia).

## Acceptance criteria

- [x] AC1: Given SC-06 z 499 pozycjami i fokusem w „Co kupić?”, when użytkownik doda pozycję, then fokus nie jest na `body`, a ostrzeżenie o limicie jest ogłaszane. — verified by: test komponentu SC-06 + E2E (jsdom nie zdejmuje fokusu z `disabled`, `layers/web.md` „Pułapki”)
- [x] AC2: No regression in: limit 500 po wczytaniu listy (AddBar nieaktywny, E2E `j03-pozycje.spec.ts` „500 items”), T-015, T-020.

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW; E2E dla fokusu

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `moves focus to the limit warning when the own 500th item is added (T-023 AC1)` (odtwarza błąd) | komponent (cała aplikacja) | Vitest + RTL + MSW | AC1 |
| 2 | `moves focus to the limit warning when the API says the list is full (T-023 AC1)` | komponent | Vitest + RTL + MSW | AC1 (409 `limit_reached`) |
| 3 | `leaves focus on the heading when the list opens already full (T-023 AC2)` | komponent | Vitest + RTL + MSW | AC2 (bez kradzieży fokusu przy wejściu) |
| 4 | `Tomek's 500th item (T-023) › moves focus from the AddBar to the limit warning` | komponent | Vitest + RTL + MSW (WS) | ta sama przyczyna: limit z cudzej zmiany na żywo |
| 5 | `Tomek's 500th item (T-023) › leaves focus elsewhere on the screen where it is` | komponent | Vitest + RTL + MSW (WS) | fokus poza AddBar zostaje |
| 6 | J-03 `SC-06 adding the 500th item moves focus to the limit warning (T-023)` | E2E | Playwright | AC1 w przeglądarce (spadek na `body` widać tylko tu) |

**Run:** `pnpm vitest run apps/web/src/screens/SC-06-lista/ListScreen.add.test.tsx apps/web/src/screens/SC-06-lista/ListScreen.live.test.tsx -t T-023`; E2E `pnpm test:e2e -g T-023`

## QA plan

- **Regression:** limit 500 po wczytaniu listy; dodawanie pozycji (T-006); T-015 (aria-disabled)
- **Edge cases:** wejście na listę już pełną — fokus zostaje na `h1` (AppBar), ostrzeżenie nie kradnie fokusu (reaguje tylko przejście „nie limit → limit”); 409 `limit_reached` z API przy mniejszej liczbie pozycji na ekranie; 500. pozycja innej osoby na żywo — fokus w AddBar przechodzi na ostrzeżenie, fokus np. na checkboxie zostaje; usunięcie pozycji po limicie włącza AddBar bez ruchu fokusu (istniejący test QA r1 #3 z T-006).
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

`AddItemBar` (T-006) przekazuje `disabled || state.limitReached` do pola „Co kupić?” i „Dodaj”. Gdy limit pojawia się w chwili, gdy pole ma fokus (własne dodanie 500. pozycji, 409 z API, cudza pozycja na żywo), przeglądarka zdejmuje fokus z elementu `disabled` i spada on na `body`; nic go nie przenosi. Testy nie złapały tego, bo jsdom nie zdejmuje fokusu z `disabled` (`web.md` „Pułapki”, T-015), a jedyny E2E limitu (`500 items`) wchodzi na listę już pełną.

Inne wystąpienie tej samej klasy (poza zakresem, inny ekran): SC-05 — odpowiedź 409 na 51. listę (`useNewList.refusedByLimit`) zamyka formularz z polem w fokusie i wyłącza „Nowa lista” (`disabled`), więc fokus prawdopodobnie też spada na `body` (niezweryfikowane w przeglądarce). Propozycja: osobne zadanie.

## Evidence

- Red (przed poprawką): `ListScreen.add.test.tsx` — testy 1 i 2 padały na `expect(element).toHaveFocus()` (fokus na polu, w jsdom); E2E J-03 test 6 padał na `toBeFocused()`: „Received: inactive” (telefon i komputer). Test 4 sprawdzony osobno: bez poprawki pada, z poprawką przechodzi.
- Green: `AddItemBar.tsx` — `useLimitFocus`: przy przejściu do limitu, gdy fokus jest w formularzu AddBar albo na `body`, fokus na ostrzeżeniu o limicie. `pnpm test`: 90 plików, 449 testów zielone; `pnpm typecheck`, `pnpm lint`, `pnpm design-check`, build web — OK.
- E2E: pełny przebieg 47 passed, 1 failed — istniejący `SC-06 at 500 items…` [telefon] przekroczył limit 120 s w `addViaApi` (API zwolniło przy 399. pozycji, przed jakąkolwiek asercją; znane zamieranie API przy E2E na Windows, `web.md` „Pułapki”). Powtórzony osobno: 4/4 passed (`-g 500`). Nowy test E2E dodaje ~35 s na projekt (499 pozycji przez API).

## Prevention

<Uzupełnia /fix.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | a11y / zachowanie | Gałąź `focused === document.body` w `useLimitFocus` przenosi fokus na ostrzeżenie także wtedy, gdy fokus był „nigdzie” z innego powodu (np. klik w puste tło), a limit przyszedł z cudzej zmiany na żywo. Nieszkodliwe (fokus i tak był na `body`), ale to przeniesienie fokusu bez akcji użytkownika. | `AddItemBar.tsx` `useLimitFocus` | Do rozważenia; zgodne z decyzją użytkownika. |
| 2 | note | ten sam błąd gdzie indziej | SC-05: 409 na 51. listę wyłącza „Nowa lista” (`disabled`) i zamyka formularz z fokusem — prawdopodobnie fokus na `body` (opisane w „Root cause”, niezweryfikowane). | `ListsScreen.tsx:26`, `useNewList.ts:20` | Osobne zadanie fix, decyzja użytkownika. |

**Reprodukcja (QA):** `pnpm test` 449/449 zielone; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `design-check --scan SC-06-lista` OK (0 hard-coded). E2E `-g "T-023|500 items"`: 4/4 passed (telefon i komputer).

**Kryteria:**
- AC1 — pass. Testy 1, 2, 4 (komponent) i 6 (E2E) przechodzą i asertują fokus na `role="status"` z tekstem limitu. E2E w Chromium: fokus na ostrzeżeniu, pole `disabled`.
- AC2 — pass. Test 3 (pełna lista przy wejściu → fokus na `h1`), istniejący E2E „500 items” zielony, pełny zestaw (T-006, T-015, T-020) zielony. Kolejność efektów sprawdzona w kodzie: `AppBar` (wcześniej w drzewie) ustawia fokus na `h1` w tym samym commicie, w którym wczytanie listy daje `limitReached`, więc hook widzi `h1` i nie kradnie fokusu.

**Spot-checki (przywrócone, `git status` czysty):**
- Usunięcie `ref.current?.focus()`: testy 1, 2, 4 czerwone; E2E T-023 [komputer] czerwony („Received: inactive”) — potwierdza, że w przeglądarce bez poprawki fokus spada.
- Fokus zawsze przy limicie (bez warunku przejścia i bez warunku „w AddBar/body”): testy 3 i 5 czerwone.

**Przegląd kodu:** zmiana ograniczona do `AddItemBar.tsx` (hook `useLimitFocus`, `ref` do istniejącego `InlineAlert` z `tabIndex={-1}`); bez scope creep. Ostrzeżenie ma `role="status"` i globalny `:focus-visible`. „Root cause” wyjaśnia, czemu testy nie złapały błędu (jsdom nie zdejmuje fokusu z `disabled`; jedyny E2E wchodził na listę już pełną). Threats: brak; dane użytkownika nietknięte.
