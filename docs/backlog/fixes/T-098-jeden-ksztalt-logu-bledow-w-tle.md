---
id: T-098
title: "API: jeden kształt logu dla błędów po zapisie i w tle (event + err)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given błąd wysyłki maila resetu, błąd wysyłki alarmu do właściciela, błąd kontroli sesji WS i błąd obsługi wiadomości WS (`live_message_failed`, dodane za zgodą właściciela 2026-11-05), when zdarzenie wystąpi, then wpis logu ma `event` (nazwa stała) i `err` w kształcie `errorSummary` (typ, kod, stos bez danych osobowych). — verified by: testy integracyjne z przechwyconym logiem, czerwone przed zmianą
- [x] AC2: Most Better Auth używa tego samego pomocnika co `afterCommit` (albo wspólnego `bestEffort(log, event, fn)`); nie ma drugiej ręcznej wersji try/catch. — verified by: istniejący test T-087 + przegląd QA
- [x] AC3: `backend.md` opisuje kształt wpisu dla błędów w tle w jednym miejscu. — verified by: przegląd QA
- [x] AC4: No regression in: T-053 (odpowiedź prośby o reset bez zdradzania błędu), T-087, T-088 (okno alarmu), T-089; TH-21 — w logu bez adresu e-mail i tokenu.

## TDD plan

**Seam:** aplikacja Fastify w testach z przechwyconym loggerem (jak `failing-live.ts`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | mailer resetu rzuca → wpis z `event` i `err` | integration | Vitest | AC1 |
| 2 | wysyłka alarmu rzuca → `owner_alert_failed` z `err` | integration | Vitest | AC1 |
| 3 | kontrola sesji WS rzuca → `live_session_check_failed` z `err` | integration | Vitest | AC1 |
| 4 | obsługa `subscribe` rzuca → `live_message_failed` z `err` (dodany w trakcie: ten sam defekt znaleziony grepem, zgoda właściciela) | integration | Vitest | AC1 |
| 5 | mailer odrzuca nie-`Error` (tekst z adresem) → `err: { type: "string" }`, bez adresu (edge case z planu QA) | integration | Vitest | AC1, AC4 |

**Run:** `pnpm vitest run --project api`

## QA plan

- **Regression:** T-053, T-087, T-088, T-089.
- **Edge cases:** błąd bez stosu / nie-`Error` (string); `deliveryFailure` ze statusem HTTP Brevo.
- **Platforms:** API.

## Root cause

Każde miejsce błędu w tle pisało własne `log.error(...)`: `errorSummary` było dostępne, ale nic nie wymuszało jego użycia ani nazwy `event`. Mail resetu powstał przed konwencją `event` (pole `source`), alarm do właściciela użył `deliveryFailure` (z polem `error`) zamiast `errorSummary`, a dwa `.catch(() => …)` w WS w ogóle nie brały błędu. `afterCommit` i most Better Auth miały dwie ręczne kopie tego samego `try/catch`.

## Evidence

Kod: `logFailure(log, event, error, fields?)` i `bestEffort(log, event, step, fields?)` w `apps/api/src/logging.ts` — jedyne miejsce kształtu `{ event, ...pola, err: errorSummary }`. `deliveryFailure` zwraca już tylko `{ status? }` (typ błędu niesie `err`). Mail resetu ma teraz `event: "password_reset_mail_failed"` (zamiast `source: "mailer"`). Przez `logFailure`/`bestEffort` idą: `afterCommit`, unieważnienie linków w moście Better Auth, mail resetu, alarm do właściciela, kontrola sesji WS, obsługa wiadomości WS, sprzątanie (`run.ts`, `schedule.ts`).

TDD (`pnpm vitest run --project api <plik>`):

| # | Test | Red (przed zmianą) | Teraz |
| --- | --- | --- | --- |
| 1 | `brevo-mailer.reset.test.ts` › still answers 200 and logs only the provider status | `expected [] to deeply equal [ObjectContaining{ err: { type: "MailDeliveryError", stack }, level: 50, status: 500 }]` — brak wpisu z `event: "password_reset_mail_failed"` | pass |
| 2 | `password-reset.owner-alert.test.ts` › answers 200 … despite a provider refusal / timeout (AC3) | oba przypadki: wpis `owner_alert_failed` miał `"error": "MailDeliveryError"` (`MailTimeoutError`), brak `err` | pass |
| 3 | `live.session.test.ts` › logs a failed session check at the ping with event and err, and keeps the connection | wpis `live_session_check_failed` bez `err` (Received: tylko `event`, `msg`, `requestId`) | pass |
| 4 | `live.session.test.ts` › logs a failed subscribe with event and err and no database message (T-098) | wpis `live_message_failed` bez `err` | pass |
| 5 | `password-reset.logs.test.ts` › logs a non-Error provider failure as its type only | nie był czerwony z powodu asercji `err` — zachowanie `errorSummary` dla nie-`Error` istniało; test przypina edge case z planu QA (stary kod miał `source`, nie `event`, więc i tak by go nie spełnił) | pass |

Uwaga do testu 3: pierwsze oczekiwanie (`type: "Error"`) było błędne — Drizzle opakowuje błąd pg w `DrizzleQueryError` z `cause` (`code: "57P01"`); test sprawdza ten kształt `errorSummary` i brak komunikatu z bazy (`connection terminated`, `Failed query`, `expires_at`). Błąd wstrzykuje `failingPool(db.pool, /"session"\."expires_at" >/)` — tylko zapytanie `sessionActive`, nie odczyt sesji przy upgrade.

Kryteria:

- AC1: testy 1–4 (wpis `level` 50, stała nazwa `event`, `err` z `errorSummary`); test 5 dla nie-`Error`.
- AC2: `revokeOtherLinks` (`konta/http/auth-routes.ts`) i `afterCommit` (`src/http/after-commit.ts`) wołają `bestEffort`; ręcznego `try/catch` z `log.error` w `apps/api/src` już nie ma (grep `log.error` poza `logging.ts`: tylko `api-error.ts` — 500 z żądania, nie błąd w tle). T-087: `password-reset.*.test.ts` zielone (alarm `reset_tokens_revoke_failed` dostaje kod z `failure`).
- AC3: `docs/architecture/layers/backend.md`, „Pułapki” — jeden punkt z kształtem wpisu, listą nazw `event`, regułą „tylko `logFailure` / `bestEffort`”; „Gdzie jest kod” i historia zaktualizowane.
- AC4: T-053 (`password-reset.*`, 200 bez zdradzania błędu), T-087, T-088 (`password-reset.owner-alert.test.ts`, w tym okno 15 min), T-089 (`*.announce-failure.test.ts`) zielone; TH-21: testy 1, 3, 4, 5 i `password-reset.logs.test.ts` sprawdzają brak e-maila, tokenu, klucza API i komunikatu bazy w logu.

Pełna weryfikacja (2026-11-05): `pnpm check` — exit 0 (format, lint, typecheck, jscpd 0 klonów, depcruise 0 naruszeń, design-check, backlog-check, workflow-check, vitest 154 pliki / 1242 testy, testy mobile); `pnpm build` — exit 0; `pnpm vitest run --project api --sequence.shuffle --sequence.seed=11` i `=98` — 108 plików / 477 testów zielone.

Dla QA: (1) zmiana nazwy w logu `source: "mailer"` → `event: "password_reset_mail_failed"` — jeśli na hostingu jest filtr/alarm po `source`, trzeba go przestawić (w repo i `docs/` brak innych odwołań); (2) wiadomość `msg` wpisów to teraz nazwa zdarzenia (wcześniej opis po angielsku); (3) poza zakresem zostały dwa wpisy `warn` z surowym `err` i bez `event`: `app.ts:97` (utrata bezczynnego połączenia puli) i `modules/health/http/routes.ts:19` (`/health/ready` przy niedostępnej bazie) — decyzja właściciela, kandydat na osobny fix, jeśli ma objąć także `warn`.

## Prevention

Jedno miejsce kształtu (`logFailure` / `bestEffort` w `src/logging.ts`) i punkt w „Pułapkach” `backend.md` z regułą „nie pisać własnego `try/catch` z `log.error`”. Propozycja (nie wdrożona, do decyzji): reguła eslint zakazująca `log.error({ event: … })` poza `src/logging.ts`, jak dla `limit_reached` (T-035).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
