---
id: T-042
title: "SC-05: ostrzeżenie limitu w pustym stanie i wygasanie odmowy 409 po liczbie list"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given SC-05 w pustym stanie z fokusem w formularzu nowej listy, when API odpowie 409 `limit_reached`, then ostrzeżenie o limicie jest widoczne i ma fokus (nie `body`). — verified by: test komponentu SC-05 (atrapa `test/disabledFocus.ts`)
- [x] AC2: Given SC-05 po odmowie 409, when odświeżenie zwróci tyle samo albo mniej własnych list niż przy odmowie, then blokada obowiązuje do spadku liczby i przycisk wraca do aktywnego stanu, gdy liczba spadnie, niezależnie od tożsamości tablicy w cache. — verified by: test komponentu SC-05
- [x] AC3: SC-05 i SC-06 wyznaczają wygaśnięcie odmowy limitu z API tą samą zasadą (liczba z chwili odmowy) przez jeden wspólny helper. — verified by: przegląd kodu i istniejące testy SC-06
- [x] AC4: No regression in: J-02, T-025 (testy fokusu SC-05), T-023 (limit pozycji SC-06).

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

T-025 (`77eec15`) dodał ostrzeżenie o limicie tylko w gałęzi z kartami `ListsScreen`, więc przy 409 w pustym stanie `limitRef` był `null`, a gdy odświeżenie przełączało ekran na karty, ostrzeżenie montowało się jako nowy element bez zmiany `limitReached` i `useLimitFocus` już nie reagował. Ten sam commit zapamiętał odmowę jako referencję tablicy z cache (`refusedFor === lists`), więc o wygaśnięciu decydowała tożsamość tablicy (structural sharing TanStack), a nie liczba list, inaczej niż w SC-06 (`atCount`). Testy T-025 sprawdzały 409 tylko przy kartach na ekranie i tylko odświeżenia, które zmieniają liczbę list.

Naprawa: wspólny hook `apps/web/src/api/useLimitRefusal.ts` (SC-05 i SC-06) pamięta liczbę z chwili odmowy, a gdy odświeżenie pokaże więcej, podnosi ją do nowej liczby. Bez tego odmowa przy nieaktualnym ekranie (0 albo 49 na ekranie, 50 na serwerze) nie wygasłaby po usunięciu listy (test T-025 „re-enables … following a refusal”). `ListsScreen` ma jedno ostrzeżenie za pustym stanem albo kartami, więc fokus zostaje na nim po odświeżeniu.

Inne wystąpienia: SC-07 (limit uczestników) nie zapamiętuje odmowy API; poza zakresem.

## Evidence

- Red (przed naprawą):
  - `ListsScreen.test.tsx` › „moves focus to the limit warning when the first list is refused (409) (T-042)”: `Unable to find an element with the text: Masz już 50 list — to limit…` (brak ostrzeżenia w pustym stanie).
  - `ListsScreen.live.test.tsx` › „keeps the refusal (409) until the number of own lists drops (T-042)”: `expect(element).toBeDisabled()` / `Received element is not disabled` (nowa tablica z 49 listami zdejmowała blokadę).
- Green: `pnpm test` 92 pliki, 509 testów; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` bez błędów.

## Prevention

Co by zapobiegło: (1) jedna reguła wygasania odmowy limitu z API zamiast dwóch implementacji (teraz `useLimitRefusal`), (2) ostrzeżenie, które dostaje fokus, renderowane jednym elementem we wszystkich stanach ekranu, w których przycisk może dostać `disabled`, (3) testy 409 przy nieaktualnym ekranie (pusty stan, odświeżenie z tą samą liczbą). Propozycja: wpis w „Pułapki” `layers/web.md` (odmowa limitu tylko przez `useLimitRefusal`, nigdy przez tożsamość danych z cache; ostrzeżenie z fokusem poza gałęziami stanu ekranu). Czeka na decyzję użytkownika.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

Reproduce: `pnpm install --frozen-lockfile`, `pnpm test` (92 files, 509 tests pass), `pnpm typecheck`, `pnpm lint`, `pnpm format:check` clean; `design-check --scan` on SC-05, SC-06, `api/`: 0 hard-coded values.

Acceptance criteria:

- AC1 pass: `ListsScreen.test.tsx` "moves focus to the limit warning when the first list is refused (409) (T-042)" asserts focus on the `role=status` warning while the empty state is still shown, CTA disabled, and focus kept after the refresh switches to 50 cards (one `InlineAlert` slot shared by both branches keeps its identity).
- AC2 pass: `ListsScreen.live.test.tsx` "keeps the refusal (409) until the number of own lists drops (T-042)" uses a new array with the same 49 lists (button stays disabled), then 48 (enabled, warning gone).
- AC3 pass: `apps/web/src/api/useLimitRefusal.ts` used by `useNewList` (SC-05) and `useAddItem` (SC-06); SC-06 limit tests (AC5, T-023 AC1, QA round 1 #3) pass.
- AC4 pass: full suite green, including T-025 focus tests and T-023 SC-06 limit tests.

Spot-checks (all reverted, `git status` clean):

1. Warning only in card branch → T-042 empty-state test fails.
2. No bump of the remembered count when the refresh shows more → T-042 empty-state test and T-025 "re-enables … following a refusal" fail (confirms the root-cause claim).
3. Helper never refuses → 7 SC-05/SC-06 limit tests fail.

Red evidence for both planned tests is recorded. Root cause explains why T-025 tests missed the bug.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | code | `AddWarning.kind: "duplicate"` is now a single-variant discriminant that nothing reads (dead field after removing the `limit` variant). | `apps/web/src/screens/SC-06-lista/useAddItem.ts:25-30,42` | Drop `kind` or keep the union only if a second variant is planned. |
| 2 | note | design | In the empty state the limit warning renders below the EmptyState CTA; with cards it renders above „+ Nowa lista”. SC-05 does not fix the order. | `ListsScreen.tsx:51-71` | Optional: consistent placement relative to the disabled button. |
