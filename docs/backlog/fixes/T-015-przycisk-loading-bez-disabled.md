---
id: T-015
title: "Przycisk w stanie zapisu zachowuje fokus (aria-disabled zamiast disabled)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [N-04]
threats: []
screens: [SC-06, SC-07, SC-09]
related_tasks: [T-005, T-007, T-008]
---

# T-015 Przycisk w stanie zapisu zachowuje fokus (aria-disabled zamiast disabled)

## Report

- **Actual:** `Button` z `loading` dostaje `disabled` (`apps/web/src/components/Button/Button.tsx:19`). Przycisk z fokusem traci go w czasie zapisu; w `ConfirmDialog` fokus wypada z pułapki dialogu (np. „Usuń listę”, „Usuń kupione”), tak samo „Utwórz link zaproszenia” i „Wyloguj”.
- **Expected:** W czasie zapisu przycisk ma `aria-disabled="true"` i `aria-busy`, ignoruje kliknięcia i Enter, a fokus zostaje na nim — source: `accessibility.md` „Build” (zarządzanie fokusem), WCAG 2.4.3 / 2.1.2
- **Steps to reproduce:**
  1. SC-06 → „Więcej opcji” → „Usuń listę” → Enter na „Usuń” przy wolnym API.
  2. `document.activeElement` to `body`, poza dialogiem.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #S3.

## Acceptance criteria

- [ ] AC1: Given ConfirmDialog z wolnym zapisem, when użytkownik zatwierdzi klawiaturą, then fokus zostaje na przycisku w dialogu. — verified by: test komponentu SC-06
- [ ] AC2: Given SC-07 i SC-09, when trwa zapis, then przycisk ma `aria-disabled="true"` i fokus. — verified by: testy komponentów
- [ ] AC3: No regression in: wszystkie przyciski z `loading`; styl nieaktywnego przycisku (kontrast `color.action.disabled`); współgra z T-020 (blokada podwójnego wysłania).

## TDD plan

**Seam:** komponent `Button` i ekrany go używające

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/web test`

## QA plan

- **Regression:** wszystkie przyciski z `loading`; styl nieaktywnego przycisku (kontrast `color.action.disabled`); współgra z T-020 (blokada podwójnego wysłania)
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
