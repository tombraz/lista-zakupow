---
id: T-048
title: "Logowanie: limit per IP przed zapisem licznika nieudanych prób"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, db]
requirements: [F-02]
threats: [TH-13, TH-27]
screens: []
related_tasks: [T-004, T-034, T-040]
---

# T-048 Logowanie: limit per IP przed zapisem licznika nieudanych prób

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-01-2026-10-31-1.md`, znalezisko #1 (high).

- **Actual:** `POST /api/auth/sign-in/email` woła `failures.reserve(accountKey)` (`apps/api/src/modules/konta/http/auth-routes.ts:68`) przed `forward()`. Limit per IP (`signInPerIp`, Better Auth) działa dopiero wewnątrz `forward()`. `reserve()` to `INSERT … ON CONFLICT` (`apps/api/src/modules/konta/infra/sign-in-failures.ts:33-49`), więc każda próba z nowym e-mailem dokłada wiersz do `sign_in_failure`, także gdy odpowiedź to 429. Po 429 `release()` robi drugi zapis i zostawia wiersz z `failures = 0`. Tabela nie ma sprzątania, które zapowiada `data-model.md:134` (zaplanowane w E-02, S-02-05).
- **Expected:** po przekroczeniu limitu per IP żądanie nie pisze do bazy, a tabela liczników ma ograniczony rozmiar. Źródło: TH-13, MC-05 („Rejestracja jest ograniczana, a limity blokują zapychanie danych”), TH-27.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `bf435ce`.
- **Evidence:** w przeglądzie seria prób z jednego IP: 10×401 i 30×429, a `sign_in_failure` urosła o 40 wierszy.

## Acceptance criteria

- [ ] AC1: Given wyczerpany limit per IP dla logowania, when z tego IP przychodzą kolejne próby z nowymi e-mailami, then API odpowiada 429 `rate_limited`, a liczba wierszy `sign_in_failure` się nie zmienia. — verified by: test integracyjny liczby wierszy
- [ ] AC2: Given próba zakończona inaczej niż 401 (sukces, 429 per IP), when licznik konta wraca do 0, then wiersz konta nie zostaje w tabeli. — verified by: test integracyjny
- [ ] AC3: Given limit per konto (TH-09), when równoległe próby na jedno konto z wielu IP, then nadal przechodzi najwyżej 5 porażek w oknie (bez regresji atomowości z QA T-004). — verified by: istniejący `sign-in-rate-limit.test.ts`
- [ ] AC4: Przekroczenie limitu per IP zostawia jedno zdarzenie `rate_limited` w logu `security` w oknie (T-040), bez e-maila. — verified by: test logu
- [ ] AC5: No regression in: J-01, `sign-in.test.ts`, `sign-in-rate-limit.test.ts`, `security-log.test.ts`.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `does not write sign-in failure rows once the IP limit is exceeded` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `removes the account counter when it returns to zero` | integracja | Vitest + Testcontainers | AC2 |
| 3 | istniejące testy limitu per konto i logu | integracja | Vitest + Testcontainers | AC3, AC4 |

**Run:** `pnpm vitest run --project api sign-in`

## QA plan

- **Regression:** J-01 (logowanie, wylogowanie), limity per IP i per konto, log `security`.
- **Edge cases:**
  - warianty e-maila (wielkość liter, spacje) przy liczniku konta;
  - limit per IP za proxy (`TRUSTED_PROXIES`);
  - równoległe żądania na granicy limitu IP.
- **Platforms:** API.

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

Propozycja z przeglądu: reguła „limit przed zapisem” na trasach bez uwierzytelnienia w `backend.md` (TH-27) i szablon testu „liczba wierszy stała po przekroczeniu limitu”.

<!-- QA rounds are appended below by /qa-task -->
