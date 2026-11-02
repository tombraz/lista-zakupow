---
id: T-086
title: "Błędy klienta z Fastify (zły JSON, za długi parametr) w formacie błędu API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done          # todo | in-progress | in-qa | done | blocked
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

## QA round 1 (2026-11-02)

Verdict: pass

Reprodukcja (czysty stan, `pnpm install --frozen-lockfile`): `pnpm test` 145 plików / 1145 testów zielone; `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm quality` (0 klonów, 0 naruszeń zależności) bez błędów.

Kryteria:

- AC1 pass — `client-errors.test.ts`: ucięty JSON, surowy NUL, tekst nie-JSON, pusta treść na `/api/v1/lists` i `/api/auth/sign-in/email` → 400 `{ error: { code: "validation_failed" } }` (asercja `toEqual` na całej treści, więc bez `message`), plus `not.toContain("Zakupy")`. Sprawdzone też ręcznie (`inject`): `{"name":"tajne` → 400 bez fragmentu treści, w logu brak „tajne”.
- AC2 pass — 414 `validation_failed` (test + ręcznie, także HEAD).
- AC3 pass — 413 `validation_failed` i dokładnie jeden wpis `limit_reached`/`bodyBytes`; 415 dla `application/xml` i dla braku `content-type`.
- AC4 pass — `routes-nul.test.ts`: na każdej trasie `:param=a×101%00` i „raw NUL in JSON”; inwentarz wymaga kodu z `ErrorCode`.
- AC5 pass — pełny zestaw zielony; web: `validation_failed` obsługiwany przez `fields` (SC-02, SC-06); ścieżka nieosiągalna z klienta (JSON ze `JSON.stringify`, walidacja tymi samymi schematami).

Fix (Step 9): „Root cause” wyjaśnia, czemu testy nie złapały (tylko status, zawsze poprawny JSON). Spot-check: przywrócenie `app.ts` i `api-error.ts` sprzed poprawki → `client-errors` + `routes-nul`: 34 z 37 testów czerwone (odpowiedzi `FST_ERR_*` z `message` zawierającym ścieżkę); po `git checkout` zielone. Czerwone dowody w Evidence obecne.

Eksploracja (`inject`, test tymczasowy, usunięty): `Origin` obcy + zły JSON → 403 `invalid_origin` (hook `onRequest` przed parsowaniem); `PATCH` ze złym JSON → 400; `/api/auth/sign-up/email`, `/api/auth/request-password-reset` → 400 `validation_failed`; `__proto__` w treści → 400; nieznana trasa → 404 `not_found` bez zmian; `application/json; charset=utf-16` → 401 dla niezalogowanego (auth przed parsowaniem). TH-20: wejście niepoprawne nigdy nie daje 500 ani treści bazy; negatywne testy w inwentarzu. `invitations.logs.test.ts`: asercja wzmocniona (teraz także wpisy z `%zz` muszą mieć zredagowany token), nie osłabiona.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security / nagłówki | Odpowiedzi z `frameworkErrors` (400 `FST_ERR_BAD_URL`, 414) nie mają nagłówków helmet (CSP, `X-Frame-Options` itd.) — hooki nie działają przed routerem. Stan sprzed poprawki taki sam (nie regresja). | `inject` `GET /api/v1/lists/%E0%A4%A`: brak `content-security-policy`; `POST` ze złym JSON: jest | Nagłówki bezpieczeństwa także na odpowiedziach błędów routera (TH-24 / test nagłówków) albo jawne uzasadnienie |
| 2 | minor | zakres | `frameworkErrors` obejmuje cały serwer, nie tylko `/api/*`: `/%zz`, `/zaproszenie/%zz` (ścieżki web) też dostają JSON `validation_failed`. Wcześniej też JSON (Fastify), więc bez zmiany dla użytkownika. | `inject` `GET /%zz` → 400 JSON | Do decyzji: ścieżki web mogą zostać JSON-em; odnotować w `backend.md` |
| 3 | minor | testy | Gałąź 500 `internal` w `frameworkErrors` (błąd routera ≥ 500, np. `FST_ERR_ASYNC_CONSTRAINT`) bez testu. | `api-error.ts` `frameworkErrors` | Test albo usunięcie nieosiągalnej gałęzi |
| 4 | note | duplikacja | Treść `{ error: { code: "validation_failed" } }` budowana w dwóch miejscach `api-error.ts` (`frameworkErrors` i `apiErrors`). | `api-error.ts` | Jedna stała / funkcja |
| 5 | note | web | SC-02: `validation_failed` bez `fields` pokazałby puste podsumowanie z fokusem zamiast ogólnego komunikatu; obecnie nieosiągalne z klienta. | `useSignUpForm.ts` `handleFailure` | Przy pustych `fields` ogólny komunikat |
