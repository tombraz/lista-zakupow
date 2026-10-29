---
id: T-016
title: "Tokeny typografii w rem (skalowanie tekstu w przeglądarce)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/tokens test`

## QA plan

- **Regression:** wygląd SC-01…SC-09 przy 100% i 200% rozmiaru tekstu
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
