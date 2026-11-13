---
id: T-120
title: "Prośby o reset nie wyczerpują dobowego limitu maili dostawcy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, db]
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

- [ ] AC1: Given dobowe okno per e-mail (10 na 24 h od pierwszej prośby; zatwierdził właściciel 2026-11-13), when przychodzi kolejna prośba dla tego adresu, then odpowiedź jest taka sama jak przy limicie 15-minutowym — 429 `rate_limited` (TH-11: ten sam status i treść dla istniejącego i nieistniejącego konta; decyzja właściciela 2026-11-13), mail nie wychodzi, a w logu `security` jest jedno zdarzenie `rate_limited` z `limit: passwordResetPerEmailDaily`. — verified by: test integracyjny
- [ ] AC2: Given wyczerpany globalny dobowy budżet maili resetu (100 na 24 h od pierwszego maila; dwa okna w dobie Brevo + 96 alarmów < 300; zatwierdził właściciel 2026-11-13), when przychodzi prośba, then mail nie wychodzi, odpowiedź się nie zmienia, a właściciel projektu dostaje jeden alarm (tłumiony jak w T-088). — verified by: test integracyjny z adapterem przechwytującym maile
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
| 3a | `limits.security.test.ts` › `passwordResetPerEmailDaily: exceeding the limit repeatedly logs one security event` (żadna tabela nie przybiera wierszy po `atLimit`) | integracja | Vitest + Testcontainers | AC1, AC4 |
| 3b | `cleanup.retention.test.ts` › `deletes daily reset mail counters after their 24 h window`; `cleanup.logs.test.ts` z `mail_quota` | integracja | Vitest + Testcontainers | AC4 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** reset hasła (T-053–T-055, T-088), alarmy N-03, limity per IP i per e-mail.
- **Edge cases:**
  - nieistniejący e-mail liczy się do limitów tak samo jak istniejący;
  - granica doby (strefa Europe/Warsaw jak w sprzątaniu);
  - restart procesu w trakcie doby.
- **Platforms:** API.

## Root cause

T-053 dodał tylko limit 15-minutowy per e-mail (3 / 15 min), bez górnej granicy na dobę ani budżetu łącznego. Analiza limitu Brevo w `deployment.md` liczyła tylko zwykłe resety („kilka miesięcznie”) i alarmy (≤ 96 / dobę), nie nadużycie, więc żaden test nie sprawdzał, ile maili wychodzi w dobie. Testy przypinały wyłącznie okna 15-minutowe i 1-minutowe.

Poprawka: nowa tabela `mail_quota` (okno 24 h od pierwszego maila, licznik jak w `sign_in_failure`). Nie w `rate_limit`, bo Better Auth przy odnowieniu okna kasuje wiersze `rate_limit` starsze niż jego najdłuższe okno (1 h; `better-auth/dist/api/rate-limiter/index.mjs`, `deleteExpiredRows`). Limit per e-mail (`passwordResetPerEmailDaily`, 10) jest sprawdzany na trasie po limicie 15-minutowym, przed `forward()` (429 jak przy limicie 15-minutowym, TH-11). Budżet łączny (`passwordResetMailsDaily`, 100) jest sprawdzany w `sendResetMail` w tle, tylko dla wysyłanych maili, więc odpowiedź się nie zmienia; ponad budżet: log `password_reset_budget_exhausted` i alarm do właściciela (tłumiony per zdarzenie 15 min, T-088). Alarmy nie przechodzą przez budżet (rezerwa, AC3).

Inne wystąpienia: inne maile wychodzą tylko jako alarmy N-03 (już tłumione, T-088). Brak innych tras wysyłających maile.

## Evidence

- Red (przed poprawką), `pnpm vitest run --project api password-reset.daily-limits`:
  - `stops sending reset mail to one address after the daily limit, with the same answer` — `expected [200 ×12] to deeply equal [200 ×10, 429, 429]`.
  - `stops sending reset mail after the daily budget and alerts the owner once` — `expected [] to have a length of 1 but got +0` (brak alarmu po 100 mailach).
- Green: oba testy przechodzą; pełny zestaw 159 plików / 1297 testów, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — bez błędów.
- Decyzje właściciela 2026-11-13: progi 10 / e-mail i 100 łącznie na 24 h; po limicie dobowym per e-mail odpowiedź 429 `rate_limited` (jak limit 15-minutowy).
- Uwaga dla QA: okno dobowe liczone od pierwszej prośby (nie doba kalendarzowa Europe/Warsaw) — jak w pozostałych limitach; budżet 100 jest dobrany tak, by dwa okna w jednej dobie Brevo plus alarmy mieściły się w 300. Licznik w bazie, więc restart procesu go nie zeruje.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
