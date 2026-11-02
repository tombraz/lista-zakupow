---
id: T-077
title: "Usunięcie uczestnika: zdarzenie member_removed w logu i 204 niezależnie od rozesłania zdarzeń"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-14]
threats: [TH-21, TH-04]
screens: [SC-07]
related_tasks: [T-058]
---

# T-077 Usunięcie uczestnika: zdarzenie member_removed w logu niezależnie od rozesłania zdarzeń

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P5 (minor). QA T-058 zgłaszało to dwa razy.

- **Actual:** w `apps/api/src/modules/listy/http/routes.ts:133-139` wywołanie `securityEvent("member_removed")` stoi po `await withdrawAccess(...)`. Jeśli `peopleWithAccess` rzuci po zatwierdzonym `DELETE`, właściciel dostaje 500 za udane usunięcie, a w logu bezpieczeństwa brakuje śladu odebrania dostępu.
- **Expected:** ślad `member_removed` zapisuje się zawsze po zatwierdzonym usunięciu, a odpowiedź to 204. `revoke` dalej idzie od razu (TH-04); błąd dalszego rozesłania trafia tylko do logu. Źródło: `T-058-usuniecie-uczestnika.md:48` (SEC4).
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given `peopleWithAccess` rzuca po zatwierdzonym usunięciu, when `DELETE …/members/:userId`, then 204, w logu jest `member_removed`, a `revoke` dla usuniętej osoby zostało wykonane. — verified by: test integracyjny (`captureLogs`, podstawione repozytorium albo `gated-pool`)
- [ ] AC2: No regression in: T-058 (wszystkie AC i SEC), T-059.

## TDD plan

**Seam:** trasa przez `buildTestApp`, `captureLogs()`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Błąd po DELETE: 204 + `member_removed` + `revoke` | integration | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api members`

## QA plan

- **Regression:** usunięcie uczestnika z SC-07 przy dwóch klientach WS.
- **Edge cases:** ponowienie po 500 (404 traktowane jako sukces w web).
- **Platforms:** API.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Rozważyć razem z T-074 (jedna funkcja zdarzeń członkostwa).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
