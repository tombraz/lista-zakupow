---
id: T-016
title: "Tokeny typografii w rem (skalowanie tekstu w przeglądarce)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: done     # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [N-04]
threats: []
screens: []
related_tasks: [T-001]
---

# T-016 Tokeny typografii w rem (skalowanie tekstu w przeglądarce)

## Report

- **Actual:** `packages/tokens/src/build.ts` generuje `tokens.css` z rozmiarami typografii w `px` (`--typography-size-body: 16px`), więc rozmiar tekstu ustawiony w przeglądarce nie skaluje fontów.
- **Expected:** Rozmiary typografii w `tokens.css` w `rem` (16px = 1rem); `tokens.ts` dla mobile bez zmian — source: `docs/design/design-system.md:59` („implementacja w `rem`”), WCAG 1.4.4
- **Steps to reproduce:**
  1. Build tokenów; `grep typography-size packages/tokens/generated/tokens.css` → wartości w `px`.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #S4.

## Acceptance criteria

- [ ] AC1: Given `docs/design/tokens.json`, when build tokenów, then każde `--typography-size-*` w `tokens.css` jest w `rem`, a `tokens.ts` ma liczby jak dotąd. — verified by: `packages/tokens/test/build.test.ts`
- [ ] AC2: Given przeglądarka z domyślnym rozmiarem tekstu 20px, when otwarcie SC-06, then tekst skaluje się proporcjonalnie. — verified by: E2E (Playwright, zmieniony font-size dokumentu)
- [ ] AC3: No regression in: wygląd SC-01…SC-09 przy 100% i 200% rozmiaru tekstu.

## TDD plan

**Seam:** `buildTokens` (wynik `tokens.css`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `packages/tokens/test/build.test.ts` › writes typography sizes in rem so they follow the browser text size (T-016 AC1) | jednostkowy | Vitest | AC1 |
| 2 | `packages/tokens/test/build.test.ts` › writes TypeScript constants for mobile with the same values (`TypographySizeBody = "16px"`) | jednostkowy | Vitest | AC1 (mobile bez zmian) |
| 3 | `apps/web/e2e/rozmiar-tekstu.spec.ts` › SC-06 text scales with the browser text size | E2E | Playwright (CDP `Page.setFontSizes`, standard 20 px) | AC2 |
| 4 | `apps/web/e2e/rozmiar-tekstu.spec.ts` › SC-06 AppBar title stays within 2 lines at 200% text on a phone | E2E | Playwright (390 px, standard 32 px) | AC3 (QA runda 1 #1) |

**Run:** `pnpm vitest run --project tokens`; `pnpm test:e2e -- rozmiar-tekstu` (z `apps/web`: `npx playwright test rozmiar-tekstu` po buildzie)

## QA plan

- **Regression:** wygląd SC-01…SC-09 przy 100% i 200% rozmiaru tekstu
- **Edge cases:** tylko `typography.size.*` w `rem` — odstępy, rozmiary (cel dotyku 48 px, wiersz 60 px), promienie i `focus` zostają w `px` (`--spacing-lg: 16px` w teście); `tokens.ts` (mobile) bez zmian, bo React Native skaluje tekst sam; przy 200% tekstu długie nazwy zawijają się w wierszu (`min-height`, nie stała wysokość); interlinie są bezwymiarowe, więc skalują się z fontem
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

Platforma `css` w `packages/tokens/src/build.ts` (T-001) używała samej grupy `transformGroup: "css"`, która przepisuje wymiary bez zmiany jednostki, więc `typography.size.*` z `tokens.json` (`"16px"`) trafiały do `tokens.css` w `px`. Zdanie „implementacja w `rem`” z `design-system.md:59` nie weszło do kryteriów T-001 (AC8 mówiło tylko o generowaniu tokenów). Poprawka: transform `typography-size/pxToRem` (16 px = 1 rem) dodany tylko do platformy `css`, tylko dla `typography.size.*`.

**Dlaczego testy nie złapały:** test T-001 (`build.test.ts`) utrwalał błędną wartość (`--typography-size-body: 16px;`), a żaden test nie zmieniał rozmiaru tekstu przeglądarki. Skany axe nie sprawdzają WCAG 1.4.4.

**QA runda 1 #1 (AppBar):** skalowanie tekstu odsłoniło błąd T-002 w `AppBar.module.css`: tytuł bez limitu 2 linii (wymóg `design-system.md`, AppBar) i z `overflow-wrap: anywhere`, a przy 200% tekstu „Wstecz” i ikony zostawiały mu 74 px szerokości (9 linii, słowa łamane w środku). Poprawka: `line-clamp: 2` z wielokropkiem, `overflow-wrap: break-word`, a przy `max-width: 24em` (em w media query idzie za rozmiarem tekstu przeglądarki) tytuł przechodzi do własnego wiersza pod przyciskami. Przy 100% na telefonie 390 px układ bez zmian (jeden wiersz). Red: wysokość tytułu 450 px przy limicie 100 px; po samym clampie „Zakupy” na 2 liniach.

**Inne wystąpienia:** w `apps/web/src` wszystkie `font-size` biorą zmienne z tokenów (brak rozmiarów tekstu w `px` na sztywno); mobile (`tokens.ts`) zgodnie z AC1 bez zmian.

## Evidence

- Red (Vitest): `build.test.ts` › writes typography sizes in rem… — `expected [ '1.5rem', '1.25rem', '1.125rem', '1rem', '0.875rem' ]`, `received [ '24px', '20px', '18px', '16px', '14px' ]`.
- Red (E2E, stare tokeny): `rozmiar-tekstu.spec.ts` (telefon i komputer) — po `Page.setFontSizes({ standard: 20 })` oczekiwane `[25, 22.5, 17.5]`, otrzymane `[20, 18, 14]` (tytuł, nazwa pozycji, notatka).
- Green: oba testy przechodzą; `pnpm check` exit 0 (90 plików, 431 testów, w tym mobile); `pnpm test:e2e` 40 passed.
- Runda 2: `pnpm check` exit 0 (431 testów), `pnpm test:e2e` 42 passed; zrzuty SC-06 i SC-05 przy 320/390/1280 px i 16/32 px sprawdzone ręcznie.
- Diff `tokens.css`: zmieniły się tylko `--typography-size-*` (24/20/18/16/14 px → 1.5/1.25/1.125/1/0.875 rem); `tokens.ts` bez zmian.

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: fail

**Reproduce:** `pnpm install --frozen-lockfile`, `pnpm --filter @lista/tokens build` → `tokens.css` has `--typography-size-*` 1.5/1.25/1.125/1/0.875 rem, `tokens.ts` unchanged (`TypographySizeBody = "16px"`). `pnpm check` exit 0 (format, lint, typecheck, quality, design-check, backlog, workflow, Vitest 90 files / 431 tests, mobile Jest 10 tests). `pnpm test:e2e`: 39 passed, 1 failed (`j03-pozycje` › SC-06 at 500 items, [komputer], 120 s timeout during an 18.9 min run under heavy machine load); rerun alone together with `rozmiar-tekstu`: 4/4 passed.

**Acceptance criteria**

- AC1 — pass. `build.test.ts` asserts all five sizes in rem by literal values, plus `--spacing-lg: 16px` (only typography changes) and `TypographySizeBody = "16px"` in `tokens.ts`. Spot-check: removing `transforms: ["typography-size/pxToRem"]` from the `css` platform makes the AC1 test fail (1 failed / 2 passed); restored, `git status` clean.
- AC2 — pass. `rozmiar-tekstu.spec.ts` passes on telefon and komputer; it asserts 20/18/14 px before and 25/22.5/17.5 px after `Page.setFontSizes({ standard: 20 })` (literal values, correct 1.25 ratio). Red evidence for both tests is in the Evidence section.
- AC3 — fail. Own screenshots of SC-01, SC-02, SC-04, SC-05, SC-06, SC-07, SC-08 (invalid link), SC-09 at 16 px and 32 px default text (CDP `Page.setFontSizes`), telefon 390 px and komputer 1280 px. Most screens reflow well (one column, nothing cut, item names wrap, row `min-height` grows). SC-06 on the phone at 200% does not: see #1.

**Findings**

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | AC3 / design (AppBar) | At 200% text on a 390 px phone, the SC-06 AppBar title "Zakupy na weekend u babci" wraps to 9 lines and breaks inside words ("Zak/upy", "we/eke/nd", "bab/ci"); the AppBar takes about 465 of 844 px, leaving about 200 px for the list above the AddBar. Cause: `.title` in `apps/web/src/components/AppBar/AppBar.module.css` has `overflow-wrap: anywhere` and no line limit, and the "Wstecz" text and icon buttons now grow with the text and squeeze the title column. Before this fix the browser text size had no effect, so this layout is new with T-016. (At 100% the same title already takes 3 lines, also over the spec.) | Screenshot `telefon-32-SC06.png` (QA scratchpad), compared with `telefon-16-SC06.png` and `komputer-32-SC06.png` (one line). | `design-system.md` AppBar states: "tytuł zawinięty do 2 linii, potem skrócony z wielokropkiem"; words not split mid-word when they fit; AC3 "no regression in SC-01…SC-09 at 200%". Add a 2-line clamp with ellipsis (full name stays available, e.g. the `h1` text itself or `title`), break at word boundaries (`overflow-wrap: break-word`), and cover it in `rozmiar-tekstu.spec.ts` (AppBar height ≤ 2 lines of title at 200% on telefon). |
| 2 | minor | tests / CI | `j03-pozycje` › "SC-06 at 500 items…" hit its 120 s timeout in the full local E2E run (Windows, 1 worker, busy machine); passes alone in about 30 s. Not caused by T-016. | `pnpm test:e2e` log: 1 failed, 39 passed; rerun 2/2 passed. | Stable under load (e.g. seed the 500 items in one batch, or a larger margin). |
| 3 | note | product (outside scope) | When a second item is submitted with Enter while the first add is still in flight, the second submit is dropped and the name and note fields keep their text, with no message. Seen while scripting screenshots (`add` twice in a row). | Page snapshot: textbox "Co kupić?" = "Chleb", note still filled, only 1 item. | Either queue the submit or show that it was not added; check against SC-06 spec. |

**Code review:** the change is small and in the right place (`css` platform only, filter on `typography.size.*`, mobile untouched); no scope creep. Root cause section explains why the T-001 test missed it (it pinned `16px`). No security surface (no threats listed; build-time tokens only).

**Accessibility:** the axe E2E scans pass. Manual 200% text check: see #1. The auth screens, SC-04, SC-05, SC-07, SC-08, SC-09 reflow at 200% with nothing cut.

**To fix (round 2):** #1 — AppBar title limited to 2 lines with ellipsis and word-boundary wrapping at 200% text on the phone, with a test that proves it.

## QA round 2 (2026-10-30)

Verdict: pass

**Reproduce:** `pnpm install --frozen-lockfile`; `pnpm check` exit 0 (format, lint, typecheck, quality, design-check, backlog, workflow, Vitest 90 files / 431 tests, mobile Jest 10 tests). `pnpm test:e2e`: 42 passed (5.9 min), including both `rozmiar-tekstu` tests on telefon and komputer; `j03-pozycje` 500 items passed this time (48 s).

**Acceptance criteria**

- AC1 — pass (unchanged since round 1, test still green).
- AC2 — pass (`rozmiar-tekstu.spec.ts` › text scales, both projects).
- AC3 — pass. Round 1 #1 is fixed. Own measurements with a temporary Playwright script (deleted afterwards) on SC-06, at widths 320/360/390/1280 px and default text 16/32 px, with three titles (25 characters, 100 characters with words, 100 characters as a single word): the `h1` is never taller than 2 line heights (50/100 px), it gets an ellipsis when cut, nothing scrolls sideways, and no word is split when it fits. At 200% on a phone the title moves to its own row under "Wstecz" and the icons (bar 172 px out of 844, was about 465 px). SC-05, SC-07 and SC-09 at 360 px and 16/32 px: title on 1 line, no horizontal scroll. Screenshots are in the QA scratchpad (`med-390-32.png`, `word-360-32.png`, `page-listy-360-16.png`).

**Findings**

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | tests | The new test does not prove the 2-line clamp. Its title, "Zakupy na weekend u babci", fits in 2 lines on its own row at 200%, so the test still passes with `line-clamp` removed. Only the media query is protected: with it disabled, 2 tests fail ("Zakupy" on 2 lines). | Spot-check: `-webkit-line-clamp`/`line-clamp: none` → 2 passed; `@media (max-width: 1px)` → 2 failed (Expected 1, Received 2); restored, `git status` clean. | Use a title long enough to need the clamp (e.g. 100 characters) and assert height ≤ 2 lines plus `scrollHeight > clientHeight` (text cut). |
| 2 | minor | design (AppBar) | The `max-width: 24em` breakpoint also applies at 100% text on phones narrower than 384 px (320/360 px). There, even short titles ("Moje listy", "Konto", "Uczestnicy") move under the buttons, the bar grows from 64 to 97 px and leaves an empty left half next to the icon. Nothing breaks and the design system does not fix the bar layout, but it changes the layout at 100% on common 360 px Android phones. | Measurements: SC-05 at 360/16 → bar 97 px, at 390/16 → about 64–66 px; screenshot `page-listy-360-16.png`. | Accept, or wrap only when the title would be too narrow (e.g. a lower breakpoint, or a `flex-wrap` with a minimum title width). Designer's call. |
| 3 | note | design (AppBar) | At 100% on a 390 px phone with "Wstecz" and 2 icons, the title column is 138 px, so a 25-character name is already cut ("Zakupy na weekend u…"). This matches the spec (2 lines, then an ellipsis). The full name stays in the `h1` for screen readers and is visible on the SC-05 card. | Screenshot `med-390-16.png`. | Nothing required. |

Round 1 #2 (E2E timeout under load) was not reproduced. Round 1 #3 (a second Enter during an add in flight) is outside this task and still open as a follow-up.

**Code review:** `AppBar.module.css` only. It uses tokens (design-check clean). It removes `overflow-wrap: anywhere` and adds `min-width: 0` so the flex item can shrink. `margin-inline-start: auto` keeps the actions on the right when the bar wraps. Root cause section updated. No scope creep beyond the AppBar fix requested in round 1.

**Accessibility:** the axe E2E scans pass. The heading keeps its full text in the DOM, the focus ring on `h1` is not clipped (screenshot), nothing scrolls sideways at 200%, and the 48 px targets are unchanged.

**Security:** no surface (CSS and build-time tokens only; `threats: []`).
