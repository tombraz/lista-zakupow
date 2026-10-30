---
id: T-016
title: "Tokeny typografii w rem (skalowanie tekstu w przeglądarce)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: in-qa           # todo | in-progress | in-qa | done | blocked
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

**Run:** `pnpm vitest run --project tokens`; `pnpm test:e2e -- rozmiar-tekstu` (z `apps/web`: `npx playwright test rozmiar-tekstu` po buildzie)

## QA plan

- **Regression:** wygląd SC-01…SC-09 przy 100% i 200% rozmiaru tekstu
- **Edge cases:** tylko `typography.size.*` w `rem` — odstępy, rozmiary (cel dotyku 48 px, wiersz 60 px), promienie i `focus` zostają w `px` (`--spacing-lg: 16px` w teście); `tokens.ts` (mobile) bez zmian, bo React Native skaluje tekst sam; przy 200% tekstu długie nazwy zawijają się w wierszu (`min-height`, nie stała wysokość); interlinie są bezwymiarowe, więc skalują się z fontem
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

Platforma `css` w `packages/tokens/src/build.ts` (T-001) używała samej grupy `transformGroup: "css"`, która przepisuje wymiary bez zmiany jednostki, więc `typography.size.*` z `tokens.json` (`"16px"`) trafiały do `tokens.css` w `px`. Zdanie „implementacja w `rem`” z `design-system.md:59` nie weszło do kryteriów T-001 (AC8 mówiło tylko o generowaniu tokenów). Poprawka: transform `typography-size/pxToRem` (16 px = 1 rem) dodany tylko do platformy `css`, tylko dla `typography.size.*`.

**Dlaczego testy nie złapały:** test T-001 (`build.test.ts`) utrwalał błędną wartość (`--typography-size-body: 16px;`), a żaden test nie zmieniał rozmiaru tekstu przeglądarki. Skany axe nie sprawdzają WCAG 1.4.4.

**Inne wystąpienia:** w `apps/web/src` wszystkie `font-size` biorą zmienne z tokenów (brak rozmiarów tekstu w `px` na sztywno); mobile (`tokens.ts`) zgodnie z AC1 bez zmian.

## Evidence

- Red (Vitest): `build.test.ts` › writes typography sizes in rem… — `expected [ '1.5rem', '1.25rem', '1.125rem', '1rem', '0.875rem' ]`, `received [ '24px', '20px', '18px', '16px', '14px' ]`.
- Red (E2E, stare tokeny): `rozmiar-tekstu.spec.ts` (telefon i komputer) — po `Page.setFontSizes({ standard: 20 })` oczekiwane `[25, 22.5, 17.5]`, otrzymane `[20, 18, 14]` (tytuł, nazwa pozycji, notatka).
- Green: oba testy przechodzą; `pnpm check` exit 0 (90 plików, 431 testów, w tym mobile); `pnpm test:e2e` 40 passed.
- Diff `tokens.css`: zmieniły się tylko `--typography-size-*` (24/20/18/16/14 px → 1.5/1.25/1.125/1/0.875 rem); `tokens.ts` bez zmian.

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
