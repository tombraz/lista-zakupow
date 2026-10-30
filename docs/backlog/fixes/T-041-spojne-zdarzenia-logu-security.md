---
id: T-041
title: "Spójne zdarzenia logu security: userId przy limicie linków, każdy limit WS osobno, jeden kształt `route`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-02, F-11]
threats: [TH-21]
screens: []
related_tasks: [T-027, T-033, T-035, T-038, T-040]
---

# T-041 Spójne zdarzenia logu security: userId przy limicie linków, każdy limit WS osobno, jeden kształt `route`

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-2.md`, S16, S18/C17, S19/C18.

- **Actual:**
  - Limit tworzenia linków (`invitationsCreatedPerList`) loguje `rate_limited` tylko z `listId` (`apps/api/src/modules/zaproszenia/domain/invitations.ts:93-95`), choć `ownerId` jest dostępny. Tabela `apps/api/test/limits.security.test.ts:134-138` przypina ten brak.
  - `limitLog` w `apps/api/src/modules/na-zywo/http/routes.ts:132-142` ma flagę `logged` (raz na połączenie dla wszystkich limitów) obok okna `LimitLogWindow`. Po `messagesPerSecond` limit `messageBytes` na tym samym połączeniu nie trafia do logu.
  - `sign_in_failed` loguje `route: request.url` (`apps/api/src/modules/konta/http/auth-routes.ts:102`), czyli surowy adres z query. `logLimitEvent` używa `routeOptions.url ?? UNKNOWN_ROUTE` (`apps/api/src/logging.ts:143`), a `list_access_denied` używa `routeOptions.url` bez wartości zastępczej (`apps/api/src/http/api-error.ts:44-49`).
- **Expected:** zdarzenie limitu ma `limit` oraz identyfikatory osoby (`userId`) i listy, zapisuje się raz na podmiot i limit, a `route` jest zawsze — źródło: `docs/architecture/layers/backend.md:88`, `architecture.md:267`.
- **Steps to reproduce:**
  1. Przekrocz `invitationsCreatedPerList` jako właściciel; wpis `rate_limited` nie ma `userId`.
  2. Na jednym połączeniu WS przekrocz `messagesPerSecond`, potem wyślij wiadomość ponad `messageBytes`; drugiego wpisu nie ma.
  3. Nieudane logowanie na `/api/auth/sign-in/email?x=1`; `route` zawiera query.
- **Environment:** lokalnie / CI; `b8998c4`.
- **Evidence:** cytaty wyżej.

## Acceptance criteria

- [ ] AC1: Given właściciel przekroczy limit tworzenia linków, when API odpowie 429, then zdarzenie `rate_limited` w logu `security` ma `userId` i `listId`. — verified by: scenariusz w `limits.security.test.ts`
- [ ] AC2: Given jedno połączenie WS przekroczy dwa różne limity, when oba zostaną przekroczone, then log `security` ma po jednym zdarzeniu na każdy limit (okno `LimitLogWindow` nadal tłumi powtórzenia tego samego limitu). — verified by: test integracyjny WS
- [ ] AC3: Given dowolne zdarzenie w logu `security` (`sign_in_failed`, `list_access_denied`, zdarzenia limitów), when zostanie zapisane, then `route` to wzorzec trasy albo `UNKNOWN_ROUTE`, nigdy surowy URL. Zdarzenia składa jedna funkcja w `logging.ts`, na której opiera się `logLimitEvent`. — verified by: test logów
- [ ] AC4: No regression in: `limits.security.test.ts`, `sign-in-rate-limit.test.ts`, `live.limits.test.ts`, `invitations.logs.test.ts`.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) i WS z przechwyconym logiem pino (`captureLogs()`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Scenariusz `invitationsCreatedPerList` oczekuje `userId` | integration | vitest | AC1 |
| 2 | Dwa różne limity na jednym połączeniu WS → dwa wpisy | integration | vitest | AC2 |
| 3 | `sign_in_failed` przy adresie z query ma `route` bez query | integration | vitest | AC3 |

**Run:** `pnpm vitest run apps/api/test`

## QA plan

- **Regression:** J-01 (logowanie), J-04 (link, przyjęcie), zmiany na żywo.
- **Edge cases:** nieznana trasa (`UNKNOWN_ROUTE`); przekroczenie tego samego limitu WS wiele razy (nadal jeden wpis w oknie).
- **Platforms:** API lokalnie.

## Root cause

## Evidence

## Prevention

Zaakceptowane w przeglądzie: zdanie w `docs/architecture/layers/backend.md` „Pułapki” — każde zdarzenie `security` przez jedną funkcję w `logging.ts`.

<!-- QA rounds are appended below by /qa-task -->
