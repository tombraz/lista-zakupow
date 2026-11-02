---
id: T-086
title: "Błędy klienta z Fastify (zły JSON, za długi parametr) w formacie błędu API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa         # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given treść żądania `/api/*`, która nie jest poprawnym JSON, when API ją odrzuca, then odpowiedź to 400 `{ error: { code: "validation_failed" } }` bez `message` i bez fragmentu treści. — verified by: test integracyjny
- [x] AC2: Given parametr ścieżki dłuższy niż `maxParamLength`, then odpowiedź to 414 `{ error: { code: "validation_failed" } }` (odpowiedź na otwarte pytanie). — verified by: test integracyjny
- [x] AC3: Given 413 z limitu treści, then zdarzenie `limit_reached` w logu `security` zostaje (T-034), a odpowiedź to 413 `{ error: { code: "validation_failed" } }`; nieobsługiwany `content-type` — 415 z tym samym kodem. — verified by: `body-limit.test.ts`
- [x] AC4: Given `routes-nul.test.ts`, then przypadki surowego NUL w treści (niepoprawny JSON) i za długiego parametru z `%00` są w teście i oczekują kodu z kontraktu. — verified by: `routes-nul.test.ts`
- [x] AC5: No regression in: pełny zestaw API, ekrany web obsługujące `validation_failed` bez `fields`.

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

`apiErrors` (od T-005) celowo przepuszczał błędy klienta z Fastify do jego domyślnego handlera („obsługuje jego handler”), więc zły JSON, pusta treść, nieobsługiwany `content-type` i 413 wracały jako `{ statusCode, code: "FST_ERR_…", error, message }`. Błędy routera (`FST_ERR_BAD_URL`, `FST_ERR_MAX_PARAM_LENGTH`) w ogóle nie przechodzą przez `setErrorHandler`: Fastify wysyła je sam, chyba że podano opcję `frameworkErrors`. Testy tego nie złapały, bo sprawdzały tylko status (`body-limit.test.ts`: 413), nie kształt odpowiedzi, a `routes-nul.test.ts` (T-070) wysyłał zawsze poprawny JSON i parametry w limicie.

Skutek uboczny poprawki: z `frameworkErrors` Fastify loguje też żądanie ze złym kodowaniem `%` w ścieżce (wcześniej nie trafiało do logu). Redakcja tokenu działa dla tych wpisów (`invitations.logs.test.ts`: założenie „nie loguje” zastąpione „loguje, z redakcją”).

## Evidence

Testy reprodukujące, czerwone przed poprawką:

- `apps/api/test/client-errors.test.ts` (13 testów) — np. `POST /api/v1/lists: truncated JSON → 400 validation_failed`: `- "code": "validation_failed" / + "code": "FST_ERR_CTP_INVALID_JSON_BODY"`; analogicznie `FST_ERR_CTP_EMPTY_JSON_BODY` (pusta treść), `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415), `FST_ERR_MAX_PARAM_LENGTH` (414), `FST_ERR_BAD_URL` (400), `FST_ERR_CTP_BODY_TOO_LARGE` (413); te same przypadki dla `/api/auth/sign-in/email`.
- `apps/api/test/routes-nul.test.ts` (AC4) — każda trasa z parametrem: `:listId=a×101%00` poza kontraktem (414 `FST_ERR_MAX_PARAM_LENGTH`); każda trasa z polem tekstowym: `raw NUL in JSON` (400 `FST_ERR_CTP_INVALID_JSON_BODY`).

Po samym `isFastifyClientError` w `apiErrors` 414 i `FST_ERR_BAD_URL` nadal czerwone (router omija `setErrorHandler`) → dodana opcja `frameworkErrors` w `buildApp`.

Poprawka: `apps/api/src/http/api-error.ts` — `FST_ERR_*` 4xx → ten sam status, `{ error: { code: "validation_failed" } }`; `frameworkErrors` dla błędów routera (inne → 500 `internal` z `requestId`, log `errorSummary`); `apps/api/src/app.ts` — `frameworkErrors` w opcjach Fastify. Zdarzenie `limit_reached` dla 413 bez zmian (test AC3).

Po poprawce: `pnpm test` 145 plików / 1145 testów zielone; `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm quality`, `pnpm build` bez błędów; `pnpm vitest run --project api --sequence.shuffle` seedy 314 i 2718 zielone.

Klient (AC5): web pokazuje `validation_failed` przez `fields` (SC-02 `useSignUpForm`, SC-06 `useAddItem` / `useEditItem`); bez `fields` nie ma komunikatu pola. Ścieżka nieosiągalna z naszego klienta: wysyła JSON z obiektu (`JSON.stringify`), treści są walidowane tymi samymi schematami i dużo mniejsze niż 16 kB, adresy budowane z UUID. Wcześniej te odpowiedzi miały kod spoza kontraktu, więc i tak nie było dla nich komunikatu.

## Prevention

Co by zapobiegło: test kształtu odpowiedzi, nie samego statusu, dla błędów, które powstają poza trasami. Zastosowane w tym zadaniu: `client-errors.test.ts` i przypadki surowego NUL / za długiego parametru w inwentarzu `routes-nul.test.ts` (każda trasa, każdy kod spoza `ErrorCode` pada); „Pułapki” w `layers/backend.md` (`frameworkErrors`).
