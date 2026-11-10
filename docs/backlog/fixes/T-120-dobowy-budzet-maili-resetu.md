---
id: T-120
title: "Prośby o reset nie wyczerpują dobowego limitu maili dostawcy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-03, N-03]
threats: [TH-10, TH-11, TH-32]
screens: []
related_tasks: [T-053, T-055, T-088]
---

# T-120 Prośby o reset nie wyczerpują dobowego limitu maili dostawcy

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #3 (medium).

- **Actual:** limit per e-mail (`passwordResetPerEmail`: 3 na 15 min, `packages/shared/src/limits.ts:12-14`) pozwala na ok. 288 maili resetu na dobę na jeden adres. Limit per IP (3/min) go nie zawęża. Darmowy plan Brevo ma 300 maili na dobę (`docs/architecture/deployment.md`). Właściciel listy zna e-maile uczestników (TH-19), więc wystarczą dwa znane adresy, żeby wyczerpać dobowy limit dostawcy. Wtedy nikt nie dostaje maila resetu, a alarmy do właściciela projektu (N-03, `owner-alerts.ts`) nie wychodzą.
- **Expected:** prośby o reset nie zużywają całego dobowego limitu maili; alarmy właściciela mają rezerwę; ofiara nie dostaje setek maili dziennie. Źródło: TH-10 („zalewanie skrzynki”), MC-04, N-03.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** analiza kodu, `cad0509`; limity Brevo z `deployment.md`.
- **Evidence:** `limits.ts:12-14`, `konta/http/auth-routes.ts:224-238`.

## Acceptance criteria

- [ ] AC1: Given dobowe okno per e-mail (np. 10 na dobę, próg do zatwierdzenia przez właściciela), when przychodzi kolejna prośba dla tego adresu, then odpowiedź jest taka sama jak zwykle (TH-11: ten sam status i treść dla istniejącego i nieistniejącego konta), mail nie wychodzi, a w logu `security` jest jedno zdarzenie `limit_reached`. — verified by: test integracyjny
- [ ] AC2: Given wyczerpany globalny dobowy budżet maili resetu (np. 200, poniżej limitu dostawcy), when przychodzi prośba, then mail nie wychodzi, odpowiedź się nie zmienia, a właściciel projektu dostaje jeden alarm (tłumiony jak w T-088). — verified by: test integracyjny z adapterem przechwytującym maile
- [ ] AC3: Given wyczerpany budżet resetu, when trzeba wysłać alarm N-03, then alarm wychodzi (rezerwa). — verified by: test integracyjny
- [ ] AC4: Liczniki nie zapisują nic przed limitem per IP (TH-27) i są sprzątane przez codzienne sprzątanie (T-064). — verified by: test liczby wierszy
- [ ] AC5: No regression in: `password-reset*.test.ts`, `cleanup.retention.test.ts`, J-01.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers i przechwytującym `Mailer`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `stops sending reset mail to one address after the daily limit, with the same answer` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `stops sending reset mail after the daily budget and alerts the owner once` | integracja | Vitest + Testcontainers | AC2, AC3 |
| 3 | `writes no counter rows once the IP limit is exceeded` | integracja | Vitest + Testcontainers | AC4 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** reset hasła (T-053–T-055, T-088), alarmy N-03, limity per IP i per e-mail.
- **Edge cases:**
  - nieistniejący e-mail liczy się do limitów tak samo jak istniejący;
  - granica doby (strefa Europe/Warsaw jak w sprzątaniu);
  - restart procesu w trakcie doby.
- **Platforms:** API.

## Root cause

<Do uzupełnienia przy poprawce.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
