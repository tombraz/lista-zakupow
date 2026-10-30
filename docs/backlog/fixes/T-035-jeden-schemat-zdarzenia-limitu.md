---
id: T-035
title: "Jeden schemat zdarzenia limitu w logu security: zawsze `limit` (klucz) i `route`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-034]
layers: [backend]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-027, T-033, T-034]
---

# T-035 Jeden schemat zdarzenia limitu w logu security: zawsze `limit` (klucz) i `route`

## Report

Źródło: QA T-034 runda 1 (minor 1 i 2), przyjęte przez użytkownika 2026-10-30 jako osobne zadanie.

- **Actual:**
  - Zdarzenia `rate_limited` limitów per IP (`signInPerIp`, `signUpPerIp`, `healthReadyPerIp`, `invitationLookupPerIp`; `perIpRateLimit` w `http/rate-limit.ts` i most `konta/http/auth-routes.ts`) oraz `invitationsCreatedPerList` (`DomainError` w `zaproszenia/domain/invitations.ts`) nie mają pola `limit`.
  - Na trasie logowania `signInPerIp` (429 z Better Auth) i `signInFailuresPerAccount` dają w logu ten sam kształt (`rate_limited`, `accountKey`) — nie da się ich odróżnić.
  - Limity biznesowe logują `limit` jako nazwę z odpowiedzi API (`lists`, `items`, `participants`), a WS i limit treści — klucz stałej (`connectionsPerSession`, `bodyBytes`).
  - 413 na nieistniejącej trasie (`POST /api/v1/nope` z treścią > 16 kB) daje zdarzenie bez `route` (`request.routeOptions.url` jest `undefined`).
- **Expected:** każde zdarzenie limitu w logu `security` ma `limit` równe kluczowi z `RATE_LIMITS`, `BUSINESS_LIMITS`, `LIVE_LIMITS` lub `HTTP_LIMITS` oraz zawsze pole `route` (dla trasy nieznanej — stała wartość). Treść odpowiedzi API (`limit: "lists"` itd., `LimitName`) bez zmian. — source: user (2026-10-30), QA T-034, `layers/backend.md` „Pułapki”.
- **Steps to reproduce:** `apps/api/test/limits.security.test.ts` — oczekiwane kształty scenariuszy różnią się (część bez `limit`, część z nazwą z API).
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** QA T-034 runda 1, tabela uwag (1, 2).

## Acceptance criteria

- [ ] AC1: Given dowolny limit nadużyć z tabeli w `limits.security.test.ts`, when zostanie przekroczony, then jedyne zdarzenie `limit_reached` / `rate_limited` ma `limit: <klucz>` i `route`; test pokrycia sprawdza to jednym, wspólnym warunkiem (`limit` = klucz scenariusza), nie per scenariusz. — verified by: `limits.security.test.ts`
- [ ] AC2: Given 413 na nieistniejącej trasie, when treść przekracza 16 kB, then zdarzenie ma `route` (stała wartość dla trasy nieznanej). — verified by: `body-limit.test.ts`
- [ ] AC3: Odpowiedzi API (`{ error: { code, limit } }`, `LimitName`) bez zmian. — verified by: istniejące testy `*.limit.test.ts`
- [ ] AC4: No regression in: T-027, T-033, T-034, `security-log.test.ts`, `live.limits.test.ts`, J-01.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) i WebSocket (`connectLive`) z przechwyconym logiem pino (`captureLogs`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `%s: exceeding the limit logs one security event` z wymaganiem `limit: key` i `route` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `logs limit_reached with a route when the body exceeds 16 kB on an unknown route` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api limits.security body-limit`

## QA plan

- **Regression:** T-027, T-033, T-034, J-01 (logowanie i rejestracja z limitami), limity biznesowe (`lists`, `items`, `invitations`).
- **Edge cases:** wpis bez treści, e-maila, tokenu, ciasteczka i IP (TH-08, TH-21); jedno zdarzenie na przekroczenie; wspólna funkcja logu limitu zamiast kilku kopii kształtu zdarzenia (uwaga QA T-033 nr 3).
- **Platforms:** API.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
