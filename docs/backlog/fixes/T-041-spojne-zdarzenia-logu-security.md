---
id: T-041
title: "Spójne zdarzenia logu security: userId przy limicie linków, każdy limit WS osobno, jeden kształt `route`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

Trzy osobne przyczyny tego samego typu — kształt zdarzenia `security` składany poza jedną funkcją albo przypięty testem do stanu faktycznego:

1. Limit tworzenia linków od początku rzucał `DomainError` z `ids: { listId }`; tabela `limits.security.test.ts` (T-035) przepisała ten kształt jako oczekiwany, zamiast wymagać `userId` z `backend.md`.
2. Flaga `logged` w `limitLog` (T-033, „raz na połączenie”) powstała, zanim istniało okno `LimitLogWindow` (T-038/T-040). Po dodaniu okna flaga została i tłumiła także inne limity tego samego połączenia; testy przekraczały tylko jeden limit na połączenie.
3. T-035 ujednolicił tylko zdarzenia limitów (`logLimitEvent`); `sign_in_failed` (`request.url`) i `list_access_denied` (`routeOptions.url` bez wartości zastępczej) składano ręcznie, a żaden test nie sprawdzał `route` tych zdarzeń.

Inne wystąpienia: po poprawce `securityLog(...).warn` woła tylko `src/logging.ts` (`securityEvent`); `test/logging.test.ts` używa `securityLog` do testu redakcji — bez zmian.

## Evidence

Testy odtwarzające (czerwone przed poprawką, `pnpm vitest run apps/api/test/...`):

- `limits.security.test.ts` › `invitationsCreatedPerList: exceeding the limit repeatedly logs one security event` — `AssertionError`: brak `"userId"` w zdarzeniu `rate_limited`.
- `live.limits.test.ts` › `logs each limit a connection exceeds once` — `expected [ { level: 40, …(10) } ] to deeply equal [ ObjectContaining{…}, …(1) ]`: brak wpisu `messageBytes`.
- `security-log.test.ts` › `logs the route pattern, not the raw URL, for a failed sign-in` — `route: "/api/auth/sign-in/email?x=1"` zamiast `"/api/auth/sign-in/email"`.

Poprawka: `securityEvent(request, event, fields)` w `src/logging.ts` (route `routeOptions.url ?? UNKNOWN_ROUTE`), na niej `logLimitEvent`, `sign_in_failed` i `list_access_denied`; `userId: ownerId` w `invitationsCreatedPerList`; usunięta flaga `logged` w `limitLog` (powtórzenia tłumi okno per sesja i limit).

Po poprawce: `pnpm test` 92 pliki / 507 testów zielone; `pnpm typecheck`, `pnpm lint`, `pnpm build` bez błędów.

## Prevention

Zaakceptowane w przeglądzie: zdanie w `docs/architecture/layers/backend.md` „Pułapki” — każde zdarzenie `security` przez jedną funkcję w `logging.ts`.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

Środowisko: lokalnie, Postgres i Mailpit z `docker compose` (działające). Commit implementacji `e3af22b`.

**Reprodukcja:** `pnpm test` 92 pliki / 507 testów zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd 0 klonów, depcruise bez naruszeń) bez błędów.

**Kryteria akceptacji:**

- AC1 — pass. `limits.security.test.ts` (`invitationsCreatedPerList`) oczekuje `userId: ania.id` i `listId`; spot-check: usunięcie `userId: ownerId` w `invitations.ts` → test czerwony.
- AC2 — pass. `live.limits.test.ts` › `logs each limit a connection exceeds once`: po `messagesPerSecond` i dwóch wiadomościach ponad `messageBytes` dokładnie dwa wpisy (powtórzenie `messageBytes` stłumione). Spot-check: przywrócenie flagi `logged` w `limitLog` → test czerwony. Test `logs repeated attempts over the socket limit once per session` nadal zielony.
- AC3 — pass. `securityEvent` w `src/logging.ts` jest jedynym wywołaniem `securityLog(...).warn` w `src/`; `logLimitEvent`, `sign_in_failed` i `list_access_denied` z niego korzystają; `route` ustawiane po `fields`, więc identyfikatory nie mogą go nadpisać. `security-log.test.ts` sprawdza `sign_in_failed` przy `?x=1`; spot-check: `route = request.url` → test czerwony. `UNKNOWN_ROUTE` pokrywa `body-limit.test.ts`. Sonda (tymczasowa, cofnięta): `GET /api/v1/lists/:id?x=1` jako obcy użytkownik → `list_access_denied` z `route: "/api/v1/lists/:listId"`.
- AC4 — pass. Wymienione pliki zielone w pełnym przebiegu.

**Fix task:** „Root cause” wyjaśnia, czemu testy nie wyłapały każdej z trzech przyczyn; czerwone dowody dla trzech testów są w Evidence i potwierdzone spot-checkami.

**TH-21 (próba nadużycia):** usunięcie flagi `logged` nie otwiera zalewu logu — liczba wpisów na sesję jest ograniczona liczbą limitów WS w oknie `LimitLogWindow` (potwierdzają to testy okna). Brak danych osobowych w nowych polach (tylko identyfikatory).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | testy | AC3 mówi o każdym zdarzeniu `security`, a test `route` z query jest tylko dla `sign_in_failed`; `list_access_denied` nie ma asercji na `route` (zachowanie poprawne — sprawdzone sondą). | `lists.authz.test.ts:95-110` sprawdza tylko `userId`, `listId`, `requestId` | asercja `route: "/api/v1/lists/:listId"` przy adresie z query w teście autoryzacji |
| 2 | note | kod | Komentarz `logLimitEvent` nadal mówi „jedyne miejsce kształtu zdarzenia przekroczenia limitu”, choć kształt składa teraz `securityEvent`. | `src/logging.ts`, JSDoc `logLimitEvent` | komentarz wskazuje `securityEvent` jako miejsce kształtu |

Spot-checki cofnięte; `git status` czysty poza plikami backlogu.
