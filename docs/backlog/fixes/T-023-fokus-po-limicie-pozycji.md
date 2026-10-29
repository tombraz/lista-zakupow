---
id: T-023
title: "Fokus nie spada na body, gdy własne dodanie osiąga limit 500 pozycji"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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
- **Steps to reproduce:**
  1. Lista z 499 pozycjami, fokus w „Co kupić?”.
  2. Dodaj pozycję Enterem; po odpowiedzi API `document.activeElement` to `body`.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** znalezione przy T-015 (sekcja „Root cause”, inne wystąpienia).

## Acceptance criteria

- [ ] AC1: Given SC-06 z 499 pozycjami i fokusem w „Co kupić?”, when użytkownik doda pozycję, then fokus nie jest na `body`, a ostrzeżenie o limicie jest ogłaszane. — verified by: test komponentu SC-06 + E2E (jsdom nie zdejmuje fokusu z `disabled`, `layers/web.md` „Pułapki”)
- [ ] AC2: No regression in: limit 500 po wczytaniu listy (AddBar nieaktywny, E2E `j03-pozycje.spec.ts` „500 items”), T-015, T-020.

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW; E2E dla fokusu

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm vitest run apps/web/src/screens/SC-06-lista/ListScreen.add.test.tsx`; E2E `pnpm test:e2e`

## QA plan

- **Regression:** limit 500 po wczytaniu listy; dodawanie pozycji (T-006); T-015 (aria-disabled)
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
