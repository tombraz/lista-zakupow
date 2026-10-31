---
id: T-035
title: "Jeden schemat zdarzenia limitu w logu security: zawsze `limit` (klucz) i `route`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given dowolny limit nadużyć z tabeli w `limits.security.test.ts`, when zostanie przekroczony, then jedyne zdarzenie `limit_reached` / `rate_limited` ma `limit: <klucz>` i `route`; test pokrycia sprawdza to jednym, wspólnym warunkiem (`limit` = klucz scenariusza), nie per scenariusz. — verified by: `limits.security.test.ts`
- [x] AC2: Given 413 na nieistniejącej trasie, when treść przekracza 16 kB, then zdarzenie ma `route` (stała wartość dla trasy nieznanej). — verified by: `body-limit.test.ts`
- [x] AC3: Odpowiedzi API (`{ error: { code, limit } }`, `LimitName`) bez zmian. — verified by: istniejące testy `*.limit.test.ts`
- [x] AC4: No regression in: T-027, T-033, T-034, `security-log.test.ts`, `live.limits.test.ts`, J-01.

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

Kształt zdarzenia limitu składano ręcznie w pięciu miejscach (`logSecurityEvent` dla `DomainError`, limit treści w `apiErrors`, `perIpRateLimit`, `logSecurity` w moście Better Auth, `limitLog` w WS). `SecurityEvent` nie miał pola na klucz limitu, więc domena wpisywała do logu nazwę z odpowiedzi API (`LimitName`) albo nic, a `perIp` nie znał klucza limitu trasy; `route` brano z `routeOptions.url`, które dla nieznanej trasy jest `undefined`. Testy nie złapały tego, bo tabela w `limits.security.test.ts` (T-034) zapisywała oczekiwany kształt osobno dla każdego scenariusza — przepisała więc niespójność, zamiast wymagać jednego schematu.

Inne wystąpienia: brak (wszystkie pięć ścieżek przeniesione na `logLimitEvent`). `list_access_denied` nie jest zdarzeniem limitu i zostaje osobno.

## Fix

- `logLimitEvent(request, event, limit, ids)` w `apps/api/src/logging.ts` — jedyne miejsce kształtu zdarzenia limitu; `route` = `routeOptions.url ?? UNKNOWN_ROUTE` (`"(unknown)"`).
- `LimitKey` w `packages/shared/src/limits.ts` (klucze `RATE_LIMITS`, `BUSINESS_LIMITS`, `HTTP_LIMITS`, `LIVE_LIMITS`); `SecurityEvent` dla limitów wymaga `limit: LimitKey`.
- `perIp(key)` przyjmuje klucz `RATE_LIMITS` i ustawia na trasie `errorResponseBuilder` z tym kluczem; most Better Auth loguje `signInPerIp` / `signUpPerIp` / `signInFailuresPerAccount`.
- Odpowiedzi API (`LimitName`) bez zmian.

## Evidence

- **Red** (`pnpm vitest run --project api limits.security body-limit`): 10 failed | 8 passed. Np. `signInPerIp: exceeding the limit logs one security event` — `- "limit": "signInPerIp"`, otrzymano zdarzenie bez `limit`, z `accountKey` (nieodróżnialne od `signInFailuresPerAccount`); `logs limit_reached with a route when the body exceeds 16 kB on an unknown route` — `- "route": "(unknown)"`, otrzymano zdarzenie bez `route`.
- **Green:** te same testy 18/18. Zaktualizowane asercje logu w `lists.limit`, `items.limit`, `invitations.limit` (`listsPerOwner`, `itemsPerList`, `participantsPerList`); asercje odpowiedzi API bez zmian.
- **Pełny zestaw:** `pnpm test` 92 pliki / 492 testy zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm quality` (depcruise) czyste.
- **Uwaga (poza zakresem):** w jednym przebiegu pełnego zestawu padł `live.limits.test.ts › frees a slot when a connection closes` (zielony 3× w izolacji i w kolejnym pełnym przebiegu). Kod huba i `attach` nie był zmieniany; wygląda na wyścig między zamknięciem po stronie klienta a `hub.detach` na serwerze.

## Prevention

Zapobiegłby temu jeden punkt budowy zdarzenia wymuszony automatycznie — niespójność wracała czwarty raz (T-027, T-033, T-034, T-035). Przyjęte przez użytkownika 2026-10-30:

1. **Reguła eslint** (`eslint.config.js`, `API_LIMIT_LOG_SYNTAX`, `apps/api/src` poza `logging.ts` i `http/rate-limit.ts`): zakaz wywołania `warn/info/error` z obiektem `event: "limit_reached" | "rate_limited"` oraz `config.rateLimit` w opcjach trasy. Zamyka też uwagę minor 1 z QA rundy 1 (trasa z ręcznym `rateLimit` dałaby 429 bez zdarzenia). Sprawdzone próbką: oba wzorce dają błąd lintu.
2. **„Pułapki” w `layers/backend.md`**: jedyna ścieżka to `logLimitEvent`, `limit` = `LimitKey`, `perIp(key)` (uwaga 3 z QA).
3. **T-036** (nowe zadanie): niestabilny `live.limits.test.ts › frees a slot when a connection closes` (z Evidence).

Uwaga 2 z QA (`route` w `list_access_denied` / `sign_in_failed`) poza zakresem; bez zadania.

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

Reproduction (QA, clean `pnpm install --frozen-lockfile`): `pnpm vitest run --project api limits.security body-limit` 18/18; `pnpm test` 92 files / 492 tests green (the `live.limits` flake from the Evidence did not occur); `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` clean.

Acceptance criteria:

- AC1 pass: the coverage table asserts one shared condition `objectContaining({ route: any(String), ...expected, limit: key })` with `limit: key` last, so a scenario cannot override it; all abuse limits covered (coverage test green).
- AC2 pass: `body-limit.test.ts` POST `/api/v1/nope` > 16 kB → 413 and one `limit_reached` with `limit: "bodyBytes"`, `route: "(unknown)"`.
- AC3 pass: response bodies still use `LimitName` (`domainErrorBody` unchanged; `*.limit.test.ts` response assertions unchanged, only log assertions renamed to keys).
- AC4 pass: full suite green, incl. `security-log`, `live.limits`, auth/sign-in tests.

Spot-checks (reverted, `git status` clean): removing `?? UNKNOWN_ROUTE` in `logging.ts` fails the AC2 test; labelling the Better Auth 429 as `signInFailuresPerAccount` in `auth-routes.ts` fails `signInPerIp: exceeding the limit logs one security event`. Red evidence present in the task. Root cause explains why the T-034 table missed it (per-scenario expected shapes). TH-21: `logLimitEvent` spreads `ids` before `route`/`limit`, so identifiers cannot overwrite them; no body, e-mail, token, cookie or IP in the event (existing negative assertions in `body-limit`/`limits.security` still pass). Exploit attempts were the integration scenarios above run locally (Testcontainers).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Security / robustness | The plugin-level `errorResponseBuilder` was removed from `perIpRateLimit`; logging now lives only in `perIp(key)`. A route that sets `config: { rateLimit: {...} }` by hand inside a `perIpRateLimit` scope would return the plugin's default 429 body and leave no `security` event. The eslint rule only blocks importing `@fastify/rate-limit`, not hand-written route config. | `apps/api/src/http/rate-limit.ts` | Keep a fallback builder at plugin level (logging with an "unknown" limit is impossible with `LimitKey`, so e.g. throw/lint) or an eslint `no-restricted-syntax` on `rateLimit` property in route config outside `rate-limit.ts`. |
| 2 | note | Consistency | Non-limit security events keep the old route sources: `list_access_denied` uses `routeOptions.url` (may be `undefined`), `sign_in_failed` uses `request.url`. Out of scope (task covers limit events only). | `api-error.ts` `logSecurityEvent`, `auth-routes.ts` `logSecurity` | Consider one `route` helper for every `security` event. |
| 3 | note | Docs | `layers/backend.md` "Pułapki" still names the old paths (`perIpRateLimit`, `limitLog`) and not `logLimitEvent` / `LimitKey`. Prevention section is empty. | `docs/architecture/layers/backend.md` line 88 | Update in the Prevention step. |
