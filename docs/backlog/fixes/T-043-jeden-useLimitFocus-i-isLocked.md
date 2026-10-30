---
id: T-043
title: "Jeden useLimitFocus w SC-06; stan zapisu na klucz z useGuardedMutation (SC-06, SC-07)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07, F-08, F-11]
threats: []
screens: [SC-06, SC-07]
related_tasks: [T-023, T-025, T-020, T-030]
---

# T-043 Jeden useLimitFocus w SC-06; stan zapisu na klucz z useGuardedMutation (SC-06, SC-07)

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-2.md`, C14, C16.

- **Actual:**
  - `apps/web/src/screens/SC-06-lista/AddItemBar.tsx:51-63` ma prywatną kopię `useLimitFocus` z T-023. Ogólny hook o tej samej nazwie i logice jest w `apps/web/src/components/useFocus.ts:40-51` (T-025). `docs/architecture/layers/web.md:89` odsyła do „`useLimitFocus`, T-023”.
  - Stan „zapis w toku” na klucz ma dwie implementacje obok blokady `lockOf` w `useGuardedMutation` (`apps/web/src/api/useGuardedMutation.ts:24,37-40`):
    - SC-06 trzyma własny `Set` `saving` (`useCheckItem.ts:38,76,88`).
    - SC-07 liczy `revoke.isPending && revoke.variables === link.id` (`ParticipantsScreen.tsx:143`).
  - Przy dwóch równoległych unieważnieniach w SC-07 pierwszy link traci `loading`, a `lockOf` dalej go blokuje, więc kliknięcie nic nie robi i nic tego nie pokazuje.
- **Expected:** element w trakcie zapisu ma `aria-disabled` i wskaźnik ładowania, dopóki jego blokada trwa. Źródło: `docs/architecture/layers/web.md:89` (przycisk w stanie zapisu), T-030. Jedna reguła ma jedną implementację (`CODING_STANDARDS.md:40`).
- **Steps to reproduce:**
  1. SC-07 z dwoma linkami, odpowiedź `DELETE` wstrzymana.
  2. Unieważnij link A, potem link B.
  3. Link A nie ma już stanu `loading`, a kliknięcie A nic nie robi.
- **Environment:** lokalnie; `b8998c4`.
- **Evidence:** cytaty wyżej.

## Acceptance criteria

- [ ] AC1: Given SC-07 z dwoma linkami i wstrzymanymi odpowiedziami, when właściciel unieważni oba, then oba przyciski są w stanie zapisu (`aria-disabled="true"`), dopóki ich odpowiedź nie wróci. — verified by: test komponentu SC-07
- [ ] AC2: `useGuardedMutation` udostępnia reaktywne `isLocked(key)`; SC-06 (odhaczanie) i SC-07 (unieważnienie) używają go zamiast własnego stanu. — verified by: istniejące testy SC-06 `ListScreen.check.test.tsx` i nowy test AC1
- [ ] AC3: AddBar w SC-06 używa `useLimitFocus` z `components/useFocus.ts`; prywatna kopia usunięta, `web.md:89` wskazuje jedno miejsce. — verified by: istniejące testy fokusu limitu 500 pozycji (T-023)
- [ ] AC4: No regression in: J-03, J-04, T-023, T-030, T-039.

## TDD plan

**Seam:** ekrany SC-06 i SC-07 przez `renderApp` z MSW

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Dwa równoległe unieważnienia → oba `aria-disabled` do odpowiedzi | component | vitest + Testing Library | AC1 |

**Run:** `pnpm vitest run apps/web/src`

## QA plan

- **Regression:** J-03 (pozycje, limit 500), J-04 (linki), odhaczanie dwóch pozycji.
- **Edge cases:** błąd odpowiedzi przy jednym z dwóch równoległych zapisów; odmontowanie ekranu w trakcie zapisu.
- **Platforms:** web.

## Root cause

Blokada na klucz w `useGuardedMutation` (T-020) żyła tylko w `useRef`, więc nie była reaktywna i ekrany musiały same wyprowadzić stan zapisu do renderu. SC-07 (T-008) liczył go z `revoke.isPending && revoke.variables`, a TanStack Query trzyma `variables` tylko ostatniego `mutate` — przy dwóch równoległych unieważnieniach pierwszy link tracił `loading`, choć `lockOf` dalej go blokował. SC-06 (T-007) zrobił to samo poprawnie, ale osobnym `Set`. Testy nie złapały tego, bo test T-020 sprawdzał tylko liczbę żądań (`delay(50)`), a nie stan przycisku pierwszego linku w trakcie zapisu drugiego.

Ten sam wzorzec (stan na klucz obok `lockOf`): tylko SC-06 odhaczanie i SC-07 unieważnianie — oba poprawione tutaj (`isLocked(key)`). Duplikat `useLimitFocus` w `AddItemBar.tsx` (T-023) usunięty; AddBar dostał `formRef`, żeby wspólny hook obejmował cały formularz (pole, „Dodaj”, notatka), jak prywatna kopia.

## Evidence

- Test reprodukujący: `ParticipantsScreen.test.tsx` › „keeps both links saving while two revokes are held (T-043)”.
  - Red (przed poprawką): `expect(revokeOf(0)).toHaveAttribute("aria-disabled", "true")` → `Received: null` (linia 258).
  - Green po poprawce.
- `pnpm test`: 92 pliki, 510 testów — pass (w tym `ListScreen.check.test.tsx` i testy fokusu limitu 500 pozycji T-023).
- `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm build`, `pnpm quality` (0 klonów, 0 naruszeń zależności) — pass.
- E2E (J-03, J-04) nie uruchamiane w tej sesji.

## Prevention

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

Reproduce: `pnpm install --frozen-lockfile`, `pnpm test` (92 files, 510 tests pass), `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm quality` (0 dependency violations), `pnpm design-check` (0 hard-coded) - all green. E2E `j03-pozycje`, `j03-kupione`, `j04-zaproszenie` on telefon + komputer: 22 passed.

Acceptance criteria:

- AC1 pass - `ParticipantsScreen.test.tsx` "keeps both links saving while two revokes are held (T-043)" asserts `aria-disabled="true"` on both links, and on A after B returns. Spot-check: restoring `revoke.isPending && revoke.variables === link.id` makes it fail.
- AC2 pass - `useGuardedMutation` returns `isLocked(key)` backed by state synced on `mutate` and `onSettled`; `useCheckItem` and SC-07 use it, own `Set` removed. Spot-check: `isSaving` → `false` fails "keeps the item in „Do kupienia” with a saving checkbox until the API answers".
- AC3 pass - private `useLimitFocus` removed from `AddItemBar.tsx`; shared hook used with `formRef`; `web.md:89` points to `components/useFocus.ts`. Spot-check: dropping `formRef` fails 3 T-023 focus tests (add, live, API 409).
- AC4 pass - full suite and E2E J-03/J-04 green.

Exploratory: temporary test (removed) - two held revokes, A answers 500: A leaves the saving state and can be retried, B stays `aria-disabled` until its response. Root cause section explains why T-020 tests missed it (request count only). Red evidence recorded.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | tests | No committed test for the error path of one of two parallel locked saves (QA plan edge case); verified only by a temporary QA test. | QA exploratory test above | A regression test for release of one key on error while another stays locked |
| 2 | note | tests | SC-06 has no test that two parallel item checks both show the saving checkbox (only the single-item case asserts `isSaving`). | `ListScreen.check.test.tsx:72,110` | Optional: AC1-style test for SC-06 |
| 3 | note | docs | `## Prevention` section still empty. | task file | Fill in after QA (as in T-042) |

`git status` clean after spot-checks and the temporary test.
