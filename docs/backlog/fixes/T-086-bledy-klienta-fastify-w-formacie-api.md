---
id: T-086
title: "Błędy klienta z Fastify (zły JSON, za długi parametr) w formacie błędu API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-070]
layers: [backend]
requirements: []
threats: [TH-20]
screens: []
related_tasks: [T-005, T-034, T-070]
---

# T-086 Błędy klienta z Fastify (zły JSON, za długi parametr) w formacie błędu API

## Report

Źródło: QA T-070 runda 1, uwaga minor #1; założone na prośbę właściciela 2026-11-02.

- **Actual:** treść, która nie jest poprawnym JSON (np. surowy, nieescapowany NUL), daje 400 w domyślnym kształcie Fastify `{ statusCode, code: "FST_ERR_CTP_INVALID_JSON_BODY", error, message }`; parametr ścieżki dłuższy niż `maxParamLength` — 414 `FST_ERR_MAX_PARAM_LENGTH` w tym samym kształcie. `apiErrors` (`apps/api/src/http/api-error.ts`) przepuszcza błędy klienta z Fastify do jego handlera („obsługuje jego handler”). Bez 500 i bez treści bazy.
- **Expected:** każdy błąd `/api/*` w formacie `{ "error": { "code": … } }` z kodem z kontraktu — źródło: `architecture.md`, „Konwencje API i błędów” („Format błędu”); zły JSON = 400 `validation_failed`. Klient mapuje `code` na komunikaty i nie dostaje tekstu `message` od serwera.
- **Steps to reproduce:**
  1. `POST /api/v1/lists` z zalogowanym ciasteczkiem, `content-type: application/json`, treść `{"name":"a<bajt 0x00>"}` (albo `{"name":`).
  2. Odpowiedź: 400 `FST_ERR_CTP_INVALID_JSON_BODY` z polem `message`.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy`.
- **Evidence:** tabela QA T-070 runda 1, #1.

## Acceptance criteria

- [ ] AC1: Given treść żądania `/api/*`, która nie jest poprawnym JSON, when API ją odrzuca, then odpowiedź to 400 `{ error: { code: "validation_failed" } }` bez `message` i bez fragmentu treści. — verified by: test integracyjny
- [ ] AC2: Given parametr ścieżki dłuższy niż `maxParamLength`, then odpowiedź to 414 `{ error: { code: "validation_failed" } }` (odpowiedź na otwarte pytanie). — verified by: test integracyjny
- [ ] AC3: Given 413 z limitu treści, then zdarzenie `limit_reached` w logu `security` zostaje (T-034), a odpowiedź to 413 `{ error: { code: "validation_failed" } }`; nieobsługiwany `content-type` — 415 z tym samym kodem. — verified by: `body-limit.test.ts`
- [ ] AC4: Given `routes-nul.test.ts`, then przypadki surowego NUL w treści (niepoprawny JSON) i za długiego parametru z `%00` są w teście i oczekują kodu z kontraktu. — verified by: `routes-nul.test.ts`
- [ ] AC5: No regression in: pełny zestaw API, ekrany web obsługujące `validation_failed` bez `fields`.

## TDD plan

**Seam:** HTTP API przez `buildTestApp` (`inject`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Zły JSON (ucięty, surowy NUL) → 400 `validation_failed` w formacie API | integration | Vitest + Testcontainers | AC1, AC4 |
| 2 | Za długi parametr → format błędu API | integration | Vitest | AC2, AC4 |
| 3 | 413 nadal z wpisem `security`, format wg decyzji | integration | Vitest | AC3 |

**Run:** `pnpm vitest run --project api routes-nul body-limit`

## QA plan

- **Regression:** `body-limit.test.ts`, `unexpected-error.test.ts`, `security-log.test.ts`; web: obsługa `validation_failed` bez `fields` (ogólny komunikat).
- **Edge cases:** brak `content-type`, nieobsługiwany `content-type` (415), pusta treść z `content-type: application/json`, trasy `/api/auth/*` (most Better Auth).
- **Platforms:** API.

## Open question

Kontrakt (`ErrorCode`) nie ma kodów dla 413, 414 i 415. Czy dla nich: (a) status bez zmian i `code: "validation_failed"`, (b) nowe kody w `packages/shared` (zmiana kontraktu — wtedy `/plan-backlog`), czy (c) tylko zły JSON (400) w tym zadaniu, reszta bez zmian? Rekomendacja przy zakładaniu: (a) — bez nowych kodów, klient pokazuje ogólny błąd.

Answer (właściciel, 2026-11-02): (a) — 413, 414 i 415 zachowują status, treść `{ error: { code: "validation_failed" } }`; bez nowych kodów w `packages/shared`. Zdarzenie `limit_reached` dla 413 w logu `security` bez zmian (T-034).

## Root cause

<Do uzupełnienia.>

## Evidence

<Do uzupełnienia.>

## Prevention

<Do uzupełnienia.>
