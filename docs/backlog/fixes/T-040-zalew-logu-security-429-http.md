---
id: T-040
title: "Odpowiedzi 429 w HTTP zalewają log security"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-027, T-035, T-038]
---

# T-040 Odpowiedzi 429 w HTTP zalewają log security

## Report

Źródło: `/fix T-038`, sekcja „Poza zakresem / inne wystąpienia” (2026-10-30); przyjęte przez użytkownika jako osobne zadanie. Ten sam wzorzec co T-038 (WS), ale w warstwie `http` i z kluczem IP / konta zamiast sesji.

- **Actual:** każda odpowiedź 429 zapisuje jedno zdarzenie `rate_limited` w logu `security`:
  - `perIp(key)` (`apps/api/src/http/rate-limit.ts`, `errorResponseBuilder`) — `healthReadyPerIp`, `invitationLookupPerIp`;
  - most Better Auth (`apps/api/src/modules/konta/http/auth-routes.ts`) — `signUpPerIp`, `signInPerIp`, `signInFailuresPerAccount`;
  - `invitationsCreatedPerList` (`DomainError` z `security`, `zaproszenia/domain/invitations.ts` → handler w `http/api-error.ts`).
  Klient powtarzający żądania ponad limit z jednego IP (albo na jedno konto / listę) daje jedną linię `security` na żądanie; objętość logu rośnie liniowo z liczbą prób.
- **Expected:** nadużycie zostaje w logu `security` (TH-21), ale objętość jest ograniczona: najwyżej jedno zdarzenie na klucz limitu i podmiot (IP / `accountKey` / `listId`) w oknie czasu, jak `LimitLogWindow` z T-038 — do wyboru w `/fix` (np. wspólny mechanizm w `logging.ts` / `logLimitEvent` zamiast osobnego w `na-zywo`). Adres IP nadal nie trafia do logu. — source: TH-21
- **Steps to reproduce:**
  1. `RATE_LIMITS.healthReadyPerIp.max + N` żądań `GET /health/ready` z jednego `remoteAddress` (`app.inject`).
  2. Liczba wpisów `rate_limited` / `healthReadyPerIp` w logu `security` (`captureLogs()`) = N.
- **Environment:** lokalnie, Testcontainers; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-038, sekcja Root cause („Poza zakresem / inne wystąpienia”).

## Acceptance criteria

- [ ] AC1: Given podmiot (IP, konto, lista) ponad limitem z `RATE_LIMITS`, when wykona N kolejnych żądań w oknie limitu, then każde dostaje 429 `rate_limited`, a log `security` ma ograniczoną liczbę wpisów (niezależną od N) w oknie czasu, każdy w kształcie `logLimitEvent` (`limit`, `route`, identyfikatory), bez adresu IP. — verified by: testy limitów HTTP (`health-rate-limit.test.ts`, `sign-in-rate-limit.test.ts`, `invitations.rate-limit.test.ts` lub nowy wspólny)
- [ ] AC2: Dwa różne podmioty (dwa IP, dwa konta) ponad limitem → osobne zdarzenia (deduplikacja nie ukrywa drugiego atakującego).
- [ ] AC3: No regression in: T-027, T-034, T-035, T-038, `limits.security.test.ts` (nadal dokładnie jedno zdarzenie na pierwsze przekroczenie).

## TDD plan

**Seam:** HTTP (`app.inject` z `remoteAddress`) + `captureLogs()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | wiele żądań ponad `perIp` z jednego IP → ograniczona liczba wpisów `rate_limited` | integracja | Vitest + Testcontainers | AC1 |
| 2 | wiele prób logowania ponad `signInPerIp` / `signInFailuresPerAccount` → ograniczona liczba wpisów | integracja | Vitest + Testcontainers | AC1 |
| 3 | dwa IP ponad limitem → dwa wpisy | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api rate-limit limits.security`

## QA plan

- **Regression:** T-027, T-034, T-035, T-038, limity logowania i zaproszeń.
- **Edge cases:** klucz deduplikacji bez IP w logu (IP tylko w pamięci); `trustedProxies` (adres klienta zza proxy); okno deduplikacji a `windowSeconds` limitu; nowy próg (jeśli powstanie) w `NOT_ABUSE_LIMITS` tabeli `limits.security.test.ts`; czy `LimitLogWindow` z T-038 przenieść do wspólnego miejsca.
- **Platforms:** API.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
