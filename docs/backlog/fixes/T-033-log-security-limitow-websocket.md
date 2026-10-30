---
id: T-033
title: "Limity WebSocket zostawiają zdarzenie w logu security; limit linku z userId"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-12, N-06]
threats: [TH-21, TH-25]
screens: []
related_tasks: [T-009, T-027]
---

# T-033 Limity WebSocket zostawiają zdarzenie w logu security; limit linku z userId

## Report

Źródło: T-027 („Inne wystąpienia”) i QA T-027 runda 1 (minor).

- **Actual:**
  - `apps/api/src/modules/na-zywo/http/routes.ts` (`serve`): przekroczenie limitu połączeń na sesję (`hub.attach` → `false`) i wiadomości na sekundę (`budget.take()` → `false`) zamyka gniazdo kodem 1008 bez wpisu w logu `security`. Wiadomość ponad `maxPayload` zamyka `ws` kodem 1009, też bez wpisu.
  - `createInvitation` (`zaproszenia/domain/invitations.ts`) przy limicie 20 uczestników loguje `limit_reached` tylko z `listId`; pozostałe zdarzenia `limit_reached` mają też `userId` (`listy/domain/lists.ts`, `pozycje/domain/items.ts`).
- **Expected:** każde przekroczenie limitu zapisuje zdarzenie w logu `security` z identyfikatorami, w tym osoby. — source: `docs/architecture/architecture.md`, „Obserwowalność” („przekroczenie limitu”), TH-21, TH-25.
- **Steps to reproduce:**
  1. Otwórz `LIVE_LIMITS.connectionsPerSession + 1` połączeń WS jedną sesją → ostatnie 1008, w logu brak zdarzenia.
  2. Wyślij `LIVE_LIMITS.messagesPerSecond + 1` wiadomości w sekundę → 1008, brak zdarzenia.
  3. Wyślij wiadomość większą niż `LIVE_LIMITS.messageBytes` → 1009, brak zdarzenia.
  4. Właściciel tworzy link na liście z 20 uczestnikami → zdarzenie `limit_reached` bez `userId`.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` @ `66b7f75`.
- **Evidence:** `live.limits.test.ts` sprawdza tylko kody zamknięcia.

## Acceptance criteria

- [x] AC1: Given sesja z kompletem połączeń WS, when otwiera kolejne, then zamknięcie 1008 i zdarzenie `security` `limit_reached` z `limit: "connectionsPerSession"` i `userId`. — verified by: test integracyjny WS z logiem
- [x] AC2: Given połączenie WS, when wyśle więcej wiadomości na sekundę niż limit, then zamknięcie 1008 i jedno zdarzenie `security` `rate_limited` z `limit: "messagesPerSecond"` i `userId`. — verified by: test integracyjny WS z logiem
- [x] AC3: Given połączenie WS, when wyśle wiadomość ponad limit rozmiaru, then zamknięcie 1009 i zdarzenie `security` `limit_reached` z `limit: "messageBytes"` i `userId`. — verified by: test integracyjny WS z logiem
- [x] AC4: Given lista z 20 uczestnikami, when właściciel tworzy link, then zdarzenie `limit_reached` ma też `userId` właściciela. — verified by: test integracyjny logów
- [x] AC5: No regression in: J-05 (zmiany na żywo), `live.*.test.ts`, J-04, T-027.

## TDD plan

**Seam:** WebSocket przez prawdziwego klienta `ws` (`connectLive`) i HTTP (`fastify.inject`) z przechwyconym logiem pino (`captureLogs`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `logs limit_reached when a session exceeds the connection limit` | integracja | Vitest + Testcontainers + ws | AC1 |
| 2 | `logs rate_limited when a connection exceeds the message rate` | integracja | Vitest + Testcontainers + ws | AC2 |
| 3 | `logs limit_reached when a message exceeds the size limit` | integracja | Vitest + Testcontainers + ws | AC3 |
| 4 | `logs limit_reached when creating a link on a full list` (rozszerzony o `userId`) | integracja | Vitest + Testcontainers | AC4 |

**Run:** `pnpm vitest run --project api live.limits invitations.limit`

## QA plan

- **Regression:** J-05, T-009 (`live.*.test.ts`), J-04, T-027.
- **Edge cases:** wpis bez ciasteczka, tokenu sesji i treści wiadomości (TH-08, TH-21); jedno zdarzenie na zamknięcie (bez zalewania logu przy serii wiadomości).
- **Platforms:** API.

## Root cause

Limity WS (T-009) działają poza ścieżką HTTP: `serve` w `na-zywo/http/routes.ts` zamyka gniazdo sam, a `ws` sam zamyka je 1009 po `maxPayload`. Log `security` dla limitów powstawał tylko z `DomainError` z `security` (handler błędów HTTP) albo z ręcznego `logSecurity` w trasach konta, więc tutaj nic go nie zapisywało. `live.limits.test.ts` sprawdzał tylko kody zamknięcia. `createInvitation` (T-008) dostawał tylko `listId`, więc zdarzenie nie miało `userId` właściciela; QA T-027 to wskazało.

Poprawka: `limitLog(request, userId)` w `na-zywo/http/routes.ts` zapisuje `limit_reached` (`connectionsPerSession`, `messageBytes` — z błędu gniazda `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH`) albo `rate_limited` (`messagesPerSecond`) z `route`, `limit` i `userId`, najwyżej raz na połączenie. `createInvitation(ctx, listId, ownerId)` loguje `userId` i `listId`.

Inne wystąpienia: brak. Po T-027 i T-033 każdy limit z `RATE_LIMITS`, `BUSINESS_LIMITS` i `LIVE_LIMITS` (poza progami bicia serca, które nie są limitem nadużyć) zapisuje zdarzenie `security`; wyjątek: limit treści HTTP 16 kB (`bodyLimit`, TH-13) — 413 obsługuje handler Fastify (`isClientError` w `http/api-error.ts`) bez zdarzenia `security`. Poza zakresem tego zadania (inny mechanizm, dotyczy wszystkich tras); do decyzji użytkownika, czy osobne zadanie.

## Evidence

- Red (przed poprawką), `pnpm vitest run --project api live.limits invitations.limit`: 4 testy czerwone na asercji:
  - `live.limits.test.ts` › `logs limit_reached when a session exceeds the connection limit`, `logs rate_limited when a connection exceeds the message rate`, `logs limit_reached when a message exceeds the size limit` → `AssertionError: expected [] to deeply equal [ ObjectContaining{…} ]` (AC1–AC3),
  - `invitations.limit.test.ts` › `logs limit_reached when creating a link on a full list` → `expected [ { level: 40, …(10) } ] to deeply equal [ ObjectContaining{…} ]` (brak `userId`, AC4).
- Green (commit `bd8da4f`): `pnpm vitest run --project api live invitations` → 20 plików / 62 testy passed; `live.limits` 5 przebiegów z rzędu zielonych; `pnpm test` → 91 plików / 476 testów passed; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm build`, `pnpm quality` (depcruise) bez błędów.
- Regresja: `live.*.test.ts` (J-05, T-009), `invitations.*.test.ts` (J-04, T-027) w pełnym przebiegu — zielone.

## Prevention

<Propozycja po QA.>

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | Logi / TH-21 | Wiadomość ponad `maxPayload` zapisuje też wpis `level: 50` (`RangeError: Max payload size exceeded`, ze stosem) przez domyślny `errorHandler` `@fastify/websocket`. Nadużycie klienta trafia do logu jako błąd serwera; bez treści wiadomości i ciasteczka. Istniało przed T-033. | test roboczy QA (usunięty): 1 wpis `security` `limit_reached`/`messageBytes` + 1 wpis `error` z tym samym `requestId` | ewentualnie własny `errorHandler` w `app.register(websocket, …)`, który dla `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH` nie loguje na poziomie `error` |
| 2 | note | Logi / TH-25 | Seria 100 wiadomości `subscribe` z niepoprawnym `listId` daje jedno `rate_limited`, ale ~20 wpisów `list_access_denied` (po jednym na wiadomość w budżecie; część zapisana po `rate_limited`, bo `handle` jest asynchroniczny). Log `security` rośnie liniowo z budżetem wiadomości. Istniało przed T-033, poza zakresem. | test roboczy QA: 21 wpisów `list_access_denied` z jednym `requestId` | do decyzji: limit wpisów `list_access_denied` na połączenie |
| 3 | minor | Kod / duplikacja wiedzy | `limitLog` (`na-zywo/http/routes.ts`) powtarza kształt wpisu z `logSecurityEvent` (`event`, `route`, `limit`, identyfikatory). Dwa miejsca znają format zdarzenia `security`. | `apps/api/src/modules/na-zywo/http/routes.ts:100`, `apps/api/src/http/api-error.ts:41` | wspólna funkcja w `logging.ts`, np. `logSecurity(request, event, ids, limit?)` |
| 4 | note | Zakres | Limit treści HTTP 16 kB (`bodyLimit`, 413) nadal bez zdarzenia `security`; autor wskazał to w „Root cause”. | `http/api-error.ts` (`isClientError`) | decyzja użytkownika: osobne zadanie |

**Reproduce (od czystego stanu):** `pnpm install --frozen-lockfile` (bez zmian w plikach śledzonych), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 klonów, 0 naruszeń depcruise), `pnpm test` → 91 plików / 476 testów passed.

**Acceptance criteria:**

- AC1 pass: `logs limit_reached when a session exceeds the connection limit` — prawdziwy klient `ws`, 1008 i dokładnie jedno zdarzenie z `limit: "connectionsPerSession"`, `userId`.
- AC2 pass: `logs rate_limited when a connection exceeds the message rate` — 26 wiadomości, 1008, dokładnie jedno `rate_limited` (`toEqual([...])` łapie zalewanie). Test roboczy QA ze 100 wiadomościami: jedno `rate_limited`.
- AC3 pass: `logs limit_reached when a message exceeds the size limit` — 1009 i `limit_reached`/`messageBytes` z `userId`.
- AC4 pass: `invitations.limit.test.ts` sprawdza `userId: ania.id` (właściciel) obok `listId`.
- AC5 pass: pełny zestaw (`live.*`, `invitations.*`) zielony.

**Spot-checks (cofnięte, `git status` czysty):**

1. `limitLog` nie loguje nic + `createInvitation` bez `userId` → 4 testy czerwone (`expected [] to deeply equal …` ×3, `expected [ { level: 40, …(10) } ] …` dla AC4). Zgadza się z czerwonym dowodem autora.
2. Usunięta blokada „raz na połączenie” → `logs rate_limited…` czerwony (`expected [ …(6) ] to deeply equal [ ObjectContaining ]`). Test chroni przed zalewaniem logu.

**Fix-task:** „Root cause” wyjaśnia, czemu testy nie złapały błędu (`live.limits.test.ts` sprawdzał tylko kody zamknięcia; ścieżka WS poza handlerem błędów HTTP). Testy odtwarzające są czerwone bez poprawki (spot-check 1).

**Bezpieczeństwo (TH-21, TH-25), lokalnie (Testcontainers + prawdziwy serwer i klient `ws`):** w logach brak wartości ciasteczka sesji i treści wiadomości (znacznik `SECRETPAYLOAD` w wiadomości ponad limit i w serii nie pojawił się w żadnej linii logu); wpisy `security` niosą tylko `requestId`, `route`, `limit`, `userId`. Limity nadal egzekwowane (1008/1009). Drugie konto niepotrzebne: zmiana nie dotyczy autoryzacji.

**Code review:** zmiana w zakresie, warstwy zgodne (log w warstwie `http`, domena dostaje `ownerId` jawnie), bez martwego kodu. Testy na uzgodnionym szwie (WebSocket + log pino), wartości oczekiwane literalne.
