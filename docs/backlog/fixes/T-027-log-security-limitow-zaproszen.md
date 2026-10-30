---
id: T-027
title: "Limity zaproszeń zostawiają zdarzenie w logu security; jeden helper limitu per IP"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-12]
threats: [TH-06, TH-21]
screens: []
related_tasks: [T-008, T-001]
---

# T-027 Limity zaproszeń zostawiają zdarzenie w logu security; jeden helper limitu per IP

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-1.md`, S4 i C7.

- **Actual:**
  - Limit per IP na podgląd i przyjęcie zaproszenia (`apps/api/src/modules/zaproszenia/http/routes.ts:83-96`): `errorResponseBuilder` zwraca `ApiError(429, "rate_limited")`, a `ApiError` nie trafia do `logSecurityEvent` (`apps/api/src/http/api-error.ts:86`). Odgadywanie tokenu (TH-06) nie zostawia więc śladu.
  - Limit 20 uczestników przy tworzeniu linku (`apps/api/src/modules/zaproszenia/domain/invitations.ts:71-73`) rzuca `DomainError("limit_reached")` bez `security`. Pozostałe `limit_reached` je mają (`apps/api/src/modules/listy/domain/lists.ts:74-77`, `pozycje/domain/items.ts:120-123`).
  - Ta sama konfiguracja `@fastify/rate-limit` z `errorResponseBuilder` jest skopiowana w `apps/api/src/modules/health/http/routes.ts:14-22`.
- **Expected:** każde przekroczenie limitu zapisuje zdarzenie w logu `security`. Źródło: `docs/architecture/architecture.md:267` („przekroczenie limitu”), TH-21. Limity logowania już to robią (`konta/http/auth-routes.ts`).
- **Steps to reproduce:**
  1. 31 razy `GET` podglądu zaproszenia z jednego IP.
  2. Odpowiedź 429, w logu brak wpisu `security` z `event: "rate_limited"`.
  3. `POST` tworzenia linku na liście z 20 uczestnikami: 409, w logu brak `limit_reached`.
- **Environment:** lokalnie / CI; `0bd3f0a`.
- **Evidence:** `invitations.logs.test.ts` sprawdza tylko redakcję tokenu.

## Acceptance criteria

- [x] AC1: Given przekroczony limit per IP na trasach z tokenem zaproszenia, when API odpowie 429, then log `security` ma zdarzenie `rate_limited` z trasą i bez tokenu. — verified by: test integracyjny logów
- [x] AC2: Given lista z 20 uczestnikami, when właściciel tworzy link, then 409 `limit_reached` i zdarzenie `security` `limit_reached` z `listId`. — verified by: test integracyjny logów
- [x] AC3: Given trasa `/health/ready` przekroczy limit, when API odpowie 429, then także zostaje zdarzenie `rate_limited`. Obie trasy korzystają z jednego helpera limitu per IP w `apps/api/src/http/`. — verified by: test integracyjny
- [x] AC4: No regression in: J-04, `invitations.rate-limit.test.ts`, health checks.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z przechwyconym logiem pino

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `logs a security event when invitation lookups exceed the IP limit` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `logs limit_reached when creating a link on a full list` | integracja | Vitest + Testcontainers | AC2 |
| 3 | `logs rate_limited on /health/ready` | integracja | Vitest + Testcontainers | AC3 |

**Run:** `pnpm vitest run --project api invitations health`

## QA plan

- **Regression:** J-04; limity per IP (TH-06); readiness w deploy/smoke.
- **Edge cases:** log bez tokenu w URL (TH-08) i bez IP w jawnej postaci, jeśli redakcja tego wymaga.
- **Platforms:** API.

## Root cause

Limit per IP z `@fastify/rate-limit` (T-004 `/health/ready`, skopiowany w T-008 do tras z tokenem) odpowiada przez `errorResponseBuilder` błędem `ApiError(429)`. Jedyny handler błędów loguje zdarzenia `security` tylko dla `DomainError` z `details.security`, więc te 429 nie zostawiały śladu; limity logowania logują same w `auth-routes.ts`. Limit 20 uczestników przy tworzeniu linku (T-008) rzucał `DomainError` bez `security`, w odróżnieniu od tego samego limitu przy przyjęciu (`Lists.requireJoined`). Testy limitów sprawdzały tylko status i treść odpowiedzi, a test logów zaproszeń tylko redakcję tokenu; nic nie sprawdzało, że każde przekroczenie limitu trafia do logu `security`.

Poprawka: helper `apps/api/src/http/rate-limit.ts` (`perIpRateLimit(scope)` rejestruje plugin i w `errorResponseBuilder` zapisuje `rate_limited` z `route` = wzorzec trasy — bez tokenu i bez IP; `perIp(RATE_LIMITS.…)` daje opcje trasy). Obie trasy (`health`, `zaproszenia`) używają helpera. `createInvitation` dodaje `security: { event: "limit_reached", ids: { listId } }`.

Inne wystąpienia:

- Wszystkie pozostałe `DomainError("limit_reached" | "rate_limited")` mają `security` (`listy/domain/lists.ts`, `pozycje/domain/items.ts`, limit tworzenia linków w `invitations.ts`); `ApiError(429)` w `auth-routes.ts` jest poprzedzony `logSecurity`.
- **Poza zakresem (propozycja nowego zadania):** limity WebSocket (TH-25) w `na-zywo/http/routes.ts` — przekroczenie limitu połączeń na sesję (`hub.attach` → `false`) i wiadomości na sekundę (`budget.take()`) zamyka gniazdo `POLICY_VIOLATION` bez zdarzenia w logu `security`. Ta sama klasa błędu, inny moduł i mechanizm (nie przez HTTP i handler błędów).

## Evidence

- Red (przed poprawką), `pnpm vitest run --project api invitations.logs invitations.limit health-rate-limit`: 4 testy czerwone na asercji `AssertionError: expected [] to deeply equal [ ObjectContaining{…} ]`:
  - `invitations.logs.test.ts` › `logs a security event when invitation lookups exceed the IP limit (GET /api/v1/invitations/:token)` i `(POST /api/v1/invitations/:token/accept)` (AC1),
  - `invitations.limit.test.ts` › `logs limit_reached when creating a link on a full list` (AC2),
  - `health-rate-limit.test.ts` › `logs rate_limited on /health/ready` (AC3).
- Green (commit `1fd0b5e`): `pnpm vitest run --project api invitations health` → 13 plików / 36 testów passed; `pnpm test` → 91 plików / 473 testy passed; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm build`, `pnpm quality` (depcruise) bez błędów.
- Reguła lint: tymczasowy plik w `apps/api/src/modules/health/` z `import rateLimit from "@fastify/rate-limit"` → `no-restricted-imports` error; plik usunięty.
- Regresja: `invitations.rate-limit.test.ts` (429 po 30 żądaniach, inne IP przechodzi), `health-rate-limit.test.ts`, `health.test.ts`, testy J-04 (`invitations.*.test.ts`, `sign-up-invitation.test.ts`) — zielone w pełnym przebiegu.

## Prevention

Przyjęte przez użytkownika (2026-10-30): reguła lint `no-restricted-imports` na `@fastify/rate-limit` poza `apps/api/src/http/`, czyli helper limitu per IP to jedyne miejsce rejestracji. Dodać ją w ramach tego zadania (dziś złamałaby lint w `health` i `zaproszenia`). — dodana w `eslint.config.js` (wyjątek: `apps/api/src/http/rate-limit.ts`); mapa kodu w `layers/backend.md` zaktualizowana.

Co by zapobiegło: jedno miejsce rejestracji limitu, które samo loguje przekroczenie — zamiast kopiowanej konfiguracji pluginu, w której łatwo pominąć log. Regułę lint wymusza CI.

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

Reproduce: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm quality` — all clean; `pnpm test` → 473/473 passed (Testcontainers on local Docker).

Acceptance criteria:

- AC1 pass — `invitations.logs.test.ts` (GET and POST accept): 31 requests from one IP via `fastify.inject` against the local test app, exactly one `security` entry `rate_limited` with the route pattern; asserts no token in any log line and no IP in the event.
- AC2 pass — `invitations.limit.test.ts`: list with 20 participants, 409 and one `limit_reached` event with `listId`, `limit`, route.
- AC3 pass — `health-rate-limit.test.ts`: `rate_limited` with `route: "/health/ready"` and `requestId`, no IP. Both modules use `perIpRateLimit` / `perIp` from `apps/api/src/http/rate-limit.ts`.
- AC4 pass — `invitations.rate-limit.test.ts`, `health*.test.ts`, J-04 invitation tests green in the full run.

Test quality: spot-check removed the `securityLog(...)` line in `rate-limit.ts` and the `security` detail in `createInvitation` → all 4 new tests red (`4 failed | 7 passed`); restored, `git status` clean. Red evidence present in Evidence. Root cause explains why existing tests missed it (asserted only status/body). Lint rule spot-checked: a temporary file in `modules/health/` importing `@fastify/rate-limit` → `no-restricted-imports` error; file removed. No other config block overrides `no-restricted-imports` for `apps/api/src`.

Threats: TH-06 / TH-21 exercised locally through the test harness (repeated token lookups from one IP → 429 + security event, no token or IP in the log). No production environment touched.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Logging consistency | `limit_reached` from `createInvitation` logs only `listId`; the other `limit_reached` events also log the acting `userId` (`listy/domain/lists.ts:76`, `pozycje/domain/items.ts:122`). | `apps/api/src/modules/zaproszenia/domain/invitations.ts:74` | Same identifier set as sibling events (owner `userId` + `listId`), if the domain function has access to it. |
| 2 | note | Scope | WebSocket limits (TH-25) close the socket without a `security` event — the author already flagged it as out of scope. | `apps/api/src/modules/na-zywo/http/routes.ts` | Separate fix task, if the user agrees. |
