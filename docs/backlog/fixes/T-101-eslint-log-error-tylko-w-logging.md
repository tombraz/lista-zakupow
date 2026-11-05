---
id: T-101
title: "API: reguła eslint — `log.error` tylko w `logging.ts` i handlerze błędów; poprawki dokumentów po T-098"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-098]
layers: [backend, infra]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-098, T-035, T-089]
---

# T-101 API: reguła eslint — `log.error` tylko w `logging.ts` i handlerze błędów; poprawki dokumentów po T-098

## Report

Źródło: QA T-098 runda 1 (2026-11-05), uwagi 1, 2 i 6, zaakceptowane przez właściciela 2026-11-05. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - Kształt wpisu błędu po zapisie i w tle (`event` + `err: errorSummary`) jest zapisany tylko w dokumencie (`docs/architecture/layers/backend.md`, „Pułapki”). Nic nie blokuje nowego `log.error({ … })` z innym kształtem. Ta sama uwaga pojawiła się w dwóch przeglądach: `docs/reviews/E-02-2026-11-02-1.md` C7 i `docs/reviews/E-02-2026-11-04-1.md` C4.
  - Sekcja „Root cause” w T-098 nie mówi, dlaczego istniejące testy nie złapały defektu.
  - `docs/architecture/architecture.md:24` (dostawca maili) wymienia w logu tylko `owner_alert_failed`. Błąd maila resetu ma od T-098 zdarzenie `password_reset_mail_failed`.
- **Expected:**
  - `pnpm lint` odrzuca wywołanie `.error(…)` na loggerze (`log`, `app.log`, `request.log`, `this.log`) w `apps/api/src/**` poza `src/logging.ts` i `src/http/api-error.ts`. Komunikat wskazuje `logFailure` / `bestEffort` i `backend.md`, „Pułapki”. Tak jak reguła `limit_reached` (T-035) i `API_AFTER_COMMIT_SYNTAX` (T-089).
  - Oba dokumenty są poprawione.

## Acceptance criteria

- [ ] AC1: Given plik w `apps/api/src/**` poza wyjątkami, który woła `log.error(…)`, `app.log.error(…)` albo `request.log.error(…)`, when `pnpm lint`, then błąd `no-restricted-syntax` z komunikatem o `logFailure` / `bestEffort`. — verified by: fikstura w `scripts/test/lint-security.test.mjs`, czerwona przed zmianą
- [ ] AC2: Given `src/logging.ts`, `src/http/api-error.ts` i wywołania `logFailure` / `bestEffort` w innych plikach, then brak błędu lintu. Obecne repo przechodzi `pnpm lint` bez zmian w kodzie produkcyjnym. — verified by: fikstura (przypadek dozwolony) + `pnpm check`
- [ ] AC3: Reguła działa we wszystkich blokach `files` dla `apps/api/src/**`, także w nadpisaniach, które powtarzają listę `no-restricted-syntax` (`modules/*/http/**`, `http/web-app.ts`). — verified by: fikstura z plikiem w `modules/x/http/` + przegląd QA
- [ ] AC4: T-098 „Root cause” ma zdanie o tym, dlaczego testy nie złapały defektu: przypinały ówczesne kształty (`source: "mailer"`, `error`), bo żadna reguła nie definiowała wspólnego kształtu. `architecture.md:24` wymienia też `password_reset_mail_failed`. `backend.md` „Pułapki” (punkt T-098) wskazuje regułę lintu. — verified by: przegląd QA
- [ ] AC5: No regression in: T-098, T-089 (`API_AFTER_COMMIT_SYNTAX`), T-035 (`API_LIMIT_LOG_SYNTAX`); pozostałe przypadki `lint-security.test.mjs` zielone.

## TDD plan

**Seam:** ESLint na fiksturach, jak istniejące przypadki w `scripts/test/lint-security.test.mjs`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `request.log.error({ event: "x" }, "x")` w `apps/api/src/modules/x/http/routes.ts` → błąd z komunikatem o `logFailure` | unit | node:test (jak `lint-security.test.mjs`) | AC1, AC3 |
| 2 | `app.log.error(...)` / `log.error(...)` w `apps/api/src/x.ts` → błąd | unit | jak wyżej | AC1 |
| 3 | `logFailure(log, "x", error)` w `apps/api/src/x.ts` i `log.error(...)` w `src/logging.ts` → brak błędu | unit | jak wyżej | AC2 |

**Run:** `node --test scripts/test/lint-security.test.mjs` oraz `pnpm check`

## QA plan

- **Regression:** `pnpm check`; przypadki T-035 i T-089 w `lint-security.test.mjs`.
- **Edge cases:** `log["error"](…)`; logger w zmiennej o innej nazwie (`logger.error`): opisać decyzję, czy reguła łapie dowolny obiekt kończący się na `log`, czy listę nazw; `console.error` (obejmuje go już inna reguła, czy nie: sprawdzić); `warn` poza zakresem (QA T-098, uwaga 5).
- **Platforms:** API, CI (Node na Windows i Linux).

## Root cause

## Evidence

## Prevention

To zadanie jest prewencją dla klasy T-098 (przegląd E-02, C7 / C4).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
