---
id: T-098
title: "API: jeden kształt logu dla błędów po zapisie i w tle (event + err)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-053, T-056, T-087, T-088, T-089]
---

# T-098 API: jeden kształt logu dla błędów po zapisie i w tle (event + err)

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, C4 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** błąd po zapisie albo w tle ma cztery kształty logu. Filtr albo alarm po polu `event` nie złapie wszystkich.
  - `{ event, err: errorSummary }`: `afterCommit` (`apps/api/src/http/after-commit.ts:14`), sprzątanie, `reset_tokens_revoke_failed` (`konta/http/auth-routes.ts:178`).
  - `{ source: "mailer", error, status }` bez `event`: mail resetu (`apps/api/src/modules/konta/index.ts:134-137`).
  - `owner_alert_failed` z `error` i `status` zamiast `err` (`apps/api/src/owner-alerts.ts:59`).
  - `live_session_check_failed` bez żadnego błędu (`apps/api/src/modules/na-zywo/http/routes.ts:198`).
  - W moście Better Auth (`auth-routes.ts:165-183`) działa własny try/catch, a w trasach `/api/v1` `afterCommit`.
- **Expected:** każdy taki wpis ma `event` i `err: errorSummary(...)`; szczegóły dostawcy maili (`deliveryFailure`) jako pole dodatkowe. Źródło: `CODING_STANDARDS.md:35`; `backend.md` (`errorSummary`, „Pułapki” `:105`, `:107`).

## Acceptance criteria

- [ ] AC1: Given błąd wysyłki maila resetu, błąd wysyłki alarmu do właściciela i błąd kontroli sesji WS, when zdarzenie wystąpi, then wpis logu ma `event` (nazwa stała) i `err` w kształcie `errorSummary` (typ, kod, stos bez danych osobowych). — verified by: testy integracyjne z przechwyconym logiem, czerwone przed zmianą
- [ ] AC2: Most Better Auth używa tego samego pomocnika co `afterCommit` (albo wspólnego `bestEffort(log, event, fn)`); nie ma drugiej ręcznej wersji try/catch. — verified by: istniejący test T-087 + przegląd QA
- [ ] AC3: `backend.md` opisuje kształt wpisu dla błędów w tle w jednym miejscu. — verified by: przegląd QA
- [ ] AC4: No regression in: T-053 (odpowiedź prośby o reset bez zdradzania błędu), T-087, T-088 (okno alarmu), T-089; TH-21 — w logu bez adresu e-mail i tokenu.

## TDD plan

**Seam:** aplikacja Fastify w testach z przechwyconym loggerem (jak `failing-live.ts`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | mailer resetu rzuca → wpis z `event` i `err` | integration | Vitest | AC1 |
| 2 | wysyłka alarmu rzuca → `owner_alert_failed` z `err` | integration | Vitest | AC1 |
| 3 | kontrola sesji WS rzuca → `live_session_check_failed` z `err` | integration | Vitest | AC1 |

**Run:** `pnpm vitest run --project api`

## QA plan

- **Regression:** T-053, T-087, T-088, T-089.
- **Edge cases:** błąd bez stosu / nie-`Error` (string); `deliveryFailure` ze statusem HTTP Brevo.
- **Platforms:** API.

## Root cause

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
