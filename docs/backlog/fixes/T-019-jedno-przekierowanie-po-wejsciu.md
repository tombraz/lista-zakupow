---
id: T-019
title: "Jedno przekierowanie po logowaniu/rejestracji (bez dodatkowego accept zaproszenia)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-12]
threats: []
screens: [SC-01, SC-02, SC-08]
related_tasks: [T-004, T-008, T-010]
---

# T-019 Jedno przekierowanie po logowaniu/rejestracji (bez dodatkowego accept zaproszenia)

## Report

- **Actual:** Po rejestracji z zaproszeniem cel wybierają dwa mechanizmy: formularz (`apps/web/src/screens/SC-02-rejestracja/useSignUpForm.ts:44-49`: `navigate` ze stanem `joinedListId`, potem `setSession`) i strażnik `PublicOnly` (`apps/web/src/session/guards.tsx:38-46`). Gdy strażnik zobaczy sesję przed nowym `location.state`, kieruje na SC-08 z auto-`accept` — drugi `accept` daje `already_member` zamiast „Dołączyłeś”. Objaw: `InvitationScreen.entry.test.tsx` niestabilny (`accepts.count` 1 zamiast 0), notowany też w QA T-010. Mechanizm to hipoteza przeglądu — potwierdzić.
- **Expected:** O celu po wejściu decyduje jedno miejsce; rejestracja z ważnym zaproszeniem kończy się na udostępnionej liście bez dodatkowego `accept` — source: F-12, T-008 (rejestracja z tokenem)
- **Steps to reproduce:**
  1. `InvitationScreen.entry.test.tsx` uruchamiany wielokrotnie albo równolegle z drugim przebiegiem web.
  2. Okresowo `expected 1 to be 0` (accepts).
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #C1.

## Acceptance criteria

- [ ] AC1: Given rejestracja z ważnym tokenem, when API odpowiada `invitation.listId`, then klient przechodzi na SC-06 tej listy i nie wysyła `accept`; test stabilny w 50 powtórzeniach. — verified by: `InvitationScreen.entry.test.tsx` z powtórzeniami
- [ ] AC2: Given logowanie z SC-08, when sesja ustawiona, then dokładnie jeden `accept`. — verified by: test komponentu
- [ ] AC3: No regression in: powrót na chroniony ekran po logowaniu, zalogowany na SC-01 → SC-05, E2E J-03.

## TDD plan

**Seam:** router + formularze SC-01 / SC-02

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/web exec vitest run src/screens/SC-08-zaproszenie`

## QA plan

- **Regression:** powrót na chroniony ekran po logowaniu, zalogowany na SC-01 → SC-05, E2E J-03
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
