---
id: T-020
title: "Synchroniczna blokada podwójnego wysłania formularzy i akcji"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-05, F-11]
threats: []
screens: [SC-02, SC-05, SC-06, SC-07, SC-08]
related_tasks: [T-004, T-005, T-007, T-008]
---

# T-020 Synchroniczna blokada podwójnego wysłania formularzy i akcji

## Report

- **Actual:** Ochrona przed podwójnym wysłaniem zależy tylko od przerysowania przycisku (`isPending` → `disabled`). Pod obciążeniem SC-07 utworzył link dwa razy (`ParticipantsScreen.test.tsx:79`: `expected 2 to be 1`). Ten sam wzorzec: tworzenie listy (`NewListForm.tsx:63`), rejestracja (`useSignUpForm.ts:96`), „Usuń kupione” (`confirmMutation.ts`), przyjęcie zaproszenia (`InvitationScreen.tsx:36-38`).
- **Expected:** Drugie kliknięcie / Enter przed odpowiedzią nie wysyła drugiego żądania, niezależnie od chwili przerysowania — source: T-008 AC1 („tworzy link raz”), F-05
- **Steps to reproduce:**
  1. Test komponentu: dwa `fireEvent.click` synchronicznie na „Utwórz link zaproszenia”.
  2. MSW liczy 2 żądania POST.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #C2.

## Acceptance criteria

- [ ] AC1: Given SC-07, when dwa kliknięcia synchronicznie, then jedno `POST` linku. — verified by: test komponentu z `fireEvent` ×2
- [ ] AC2: Given tworzenie listy, rejestracja, „Usuń kupione”, przyjęcie zaproszenia, when podwójne wysłanie, then jedno żądanie. — verified by: testy komponentów
- [ ] AC3: Given `layers/web.md` „Pułapki”, then opisuje wspólny mechanizm blokady. — verified by: przegląd dokumentu
- [ ] AC4: No regression in: dodawanie pozycji (idempotentne `id`, T-006) bez zmian; T-015 (aria-disabled).

## TDD plan

**Seam:** hooki zapisu web (wspólny mechanizm, np. blokada w `useRef` przed `mutate`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/web test`

## QA plan

- **Regression:** dodawanie pozycji (idempotentne `id`, T-006) bez zmian; T-015 (aria-disabled)
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
