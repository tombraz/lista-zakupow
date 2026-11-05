---
id: T-095
title: "architecture.md i api.md zgodne z kodem; test zgodności ErrorCode"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: done                 # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-03, F-04]
threats: []
screens: []
related_tasks: [T-053, T-054, T-062, T-076, T-081, T-086, T-088]
---

# T-095 architecture.md i api.md zgodne z kodem; test zgodności ErrorCode

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, C1 (major) i P4 (minor); propozycja „test zgodności dokumentacji” zaakceptowana przez właściciela 2026-11-04. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - Tabela błędów `docs/architecture/architecture.md:104-118` nie ma `400 invalid_token` (T-054; jest tylko w `api.md:20`).
  - Tabela przypisuje `validation_failed` tylko do 400. Po T-086 ten kod wraca też z 413, 414 i 415 (`apps/api/src/http/api-error.ts:55-56`, `:96-98`); nie opisuje tego ani `architecture.md`, ani `api.md`.
  - `architecture.md:22`: dostawca maili „wysyła wyłącznie mail resetu hasła”, a `:271` (T-088) opisuje alarmy z API tym samym dostawcą. Diagram kontekstu (`:13-19`) nie ma alarmu API → właściciel.
  - `api.md:32`: `DELETE /api/v1/me` bez 401, choć `apps/api/src/modules/konta/http/me-routes.ts:58` je zwraca.
  - `api.md:19`: body prośby o reset `{ email, redirectTo }`, a `redirectTo` jest ignorowany (`auth-routes.ts:125`, T-053 SEC5).
  - Reguła z `backend.md:108` jest ręczna; rozjazd wrócił zaraz po T-081.
- **Expected:** dokumenty kontraktu zgadzają się z kodem, a test pada, gdy kod błędu nie ma opisu.

## Acceptance criteria

- [ ] AC1: Tabela błędów w `architecture.md` zawiera `invalid_token` oraz `validation_failed` z 413/414/415; `api.md` opisuje te statusy (tam, gdzie mogą wystąpić). — verified by: AC4 + przegląd QA
- [ ] AC2: `architecture.md:22` i diagram kontekstu opisują oba rodzaje maili (reset hasła, alarm do właściciela). — verified by: przegląd QA
- [ ] AC3: `api.md`: `DELETE /api/v1/me` z 401 (konto usunięte w międzyczasie); body prośby o reset bez `redirectTo` albo z adnotacją „ignorowany (T-053 SEC5)”. — verified by: przegląd QA
- [ ] AC4: Given kod w `ErrorCode` (`packages/shared/src/api/errors.ts`) bez wiersza w tabeli błędów `architecture.md` albo bez wystąpienia w `api.md`, when `pnpm test`, then test pada z nazwą kodu. Czerwony przed AC1 (`invalid_token`). — verified by: test jednostkowy czytający oba dokumenty
- [ ] AC5: `backend.md:108`: reguła odsyła do testu z AC4. No regression in: `pnpm check`.

## TDD plan

**Seam:** eksport `ErrorCode` z `packages/shared` i pliki Markdown w `docs/architecture/`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | każdy `ErrorCode` ma wiersz w tabeli błędów i wystąpienie w `api.md` | unit | Vitest | AC4 (czerwony przed AC1) |

**Run:** `pnpm vitest run --project shared`

## QA plan

- **Regression:** `pnpm check`.
- **Edge cases:** kody z parametrami (`limit_reached` z `limit`), kody używane tylko w WS (`error not_found`); test nie może przejść tylko dlatego, że kod występuje w innym miejscu dokumentu niż tabela.
- **Platforms:** CI.

## Root cause

Kontrakt błędów w `architecture.md` i `api.md` był utrzymywany ręcznie (reguła w `layers/backend.md`), a `ErrorCode` był samym typem TypeScript, więc nic w czasie wykonania nie mogło porównać kodów z dokumentami. T-054 dodał `invalid_token` tylko do `api.md`, T-086 przypisał `validation_failed` do 413/414/415 bez zmiany dokumentów, T-088 dodał alarm mailowy bez poprawienia opisu dostawcy maili. Istniejące testy sprawdzają odpowiedzi API, nie dokumenty.

Inne wystąpienia tego samego wzorca: `api.md` nie miał w żadnej tabeli `not_found`, `rate_limited`, `unauthenticated`, `invalid_origin` ani `internal` (tylko same statusy) — poprawione w tym tasku tabelą „Błędy wspólne”.

Zmiany: `DOMAIN_ERROR_CODES` / `ERROR_CODES` (`as const`) w `packages/shared/src/api/errors.ts`, z których wynikają typy `DomainErrorCode` / `ErrorCode` (zgodne wstecz); test `packages/shared/test/error-codes-docs.test.ts`; `architecture.md` (kontekst i diagram, tabela błędów, historia zmian); `api.md` („Błędy wspólne”, prośba o reset `{ email }` z adnotacją o `redirectTo`, 401 przy `DELETE /api/v1/me`); `layers/backend.md` (reguła odsyła do testu, historia zmian).

## Evidence

- Czerwony: `pnpm vitest run --project shared test/error-codes-docs.test.ts` — 6 z 32 porażek na asercji: `architecture.md: tabela błędów ma wiersz dla invalid_token` → `AssertionError: brak invalid_token w kolumnie code tabeli błędów: expected false to be true`; w `api.md`: `not_found`, `rate_limited`, `unauthenticated`, `invalid_origin`, `internal`.
- Zielony po poprawkach dokumentów: 32/32.
- Przypadki brzegowe z QA planu: test liczy tylko komórki tabel (w `architecture.md` tylko kolumnę `code` tabeli z „Konwencje API i błędów”, nagłówek sprawdzany), więc `limit_reached` z przykładu formatu w prozie nie wystarcza; `code: "not_found"` z tabeli WS nie jest samodzielnym kodem w backtickach.
- `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, test, test:mobile): exit 0, 153 pliki / 1223 testy.

## Prevention

Test z AC4 (`packages/shared/test/error-codes-docs.test.ts`) zastępuje ręczną regułę z `backend.md` dla kodów błędów; reguła w „Pułapkach” odsyła do testu. Pozostała część reguły (zdarzenia, tabele, moduły, ADR) dalej ręczna.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-05)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | test | `architectureErrorTableCodes()` wywołuje `expect` w ciele `describe` (przy zbieraniu testów): brak sekcji lub zmieniony nagłówek tabeli daje błąd zbierania pliku zamiast nazwanego testu. Nadal czerwone, ale komunikat mniej czytelny. | `packages/shared/test/error-codes-docs.test.ts:37-46`, `:53-55` | sprawdzenie sekcji/nagłówka w osobnym `it` albo `beforeAll` |
| 2 | note | test | Dla `api.md` wystarcza kod w backtickach w dowolnej komórce dowolnej tabeli (także w kolumnie „Kiedy”); zgodne z AC4 („wystąpienie w api.md”), słabsze niż dla `architecture.md`. | `apiTableCodes()` | ewentualnie zawęzić do kolumn „Błędy”/„Kod” |

**Reprodukcja:** `pnpm check` exit 0 (cały zestaw, w tym format, lint, typecheck, testy web/api/shared/mobile). `pnpm vitest run --project shared test/error-codes-docs.test.ts`: 32/32.

**Kryteria:**
- AC1 pass: `architecture.md:108-110` ma `validation_failed` (400 oraz 413/414/415) i `invalid_token` (400); `api.md` „Błędy wspólne” opisuje 413/414/415. Zgodne z kodem: `apps/api/src/http/api-error.ts` (`isFastifyClientError` → `validation_failed` ze statusem Fastify, `frameworkErrors` dla 414), `auth-routes.ts:52-53` (`invalid_token` 400).
- AC2 pass: `architecture.md:22` i diagram (`app -->|alarm z API| mail`, `mail -->|alarm z API| owner`) opisują oba maile.
- AC3 pass: `DELETE /api/v1/me` z 401 (zgodne z `me-routes.ts:56`); body resetu `{ email }` z adnotacją o ignorowanym `redirectTo` (zgodne z `auth-routes.ts:125`, `forward(..., { email })`).
- AC4 pass: spot-check (zmiany cofnięte, drzewo czyste): przeniesienie `invalid_token` z kolumny `code` do kolumny „Kiedy” w `architecture.md` → `FAIL ... wiersz dla invalid_token: brak invalid_token w kolumnie code tabeli błędów`; usunięcie backticków z `unauthenticated` w `api.md` → `FAIL ... api.md: tabela opisuje unauthenticated`. Test pada z nazwą kodu i nie przechodzi tylko dlatego, że kod jest w innej kolumnie. Kod z WS (`code: "not_found"` w `live.ts`) należy do `ErrorCode`, więc jest objęty.
- AC5 pass: `backend.md:108` odsyła do testu; `pnpm check` zielony.

**Fix task:** „Root cause” wyjaśnia, czemu testy nie złapały rozjazdu (sprawdzały odpowiedzi API, nie dokumenty). Red evidence z 6 porażkami w „Evidence”. Zmiana `ErrorCode` na `as const` zachowuje typy (typecheck zielony). Bez zakresu ponad zadanie. Bezpieczeństwo: brak zmian w kodzie wykonawczym API; `threats: []`.

**Po QA round 1 (uwaga 1, decyzja właściciela 2026-11-05):** sekcję i nagłówek tabeli błędów sprawdza osobny test „architecture.md: sekcja „Konwencje API i błędów” ma tabelę z kolumną `code`”, a dokumenty są czytane dopiero w testach (bez `expect` w ciele `describe`). Reprodukcja przed zmianą: nagłówek `| HTTP | Kod | Kiedy |` → `FAIL test/error-codes-docs.test.ts`, `Tests no tests`; po zmianie → `× architecture.md: sekcja … ma tabelę z kolumną code`, 17 nazwanych porażek. `pnpm check` exit 0 (1224 testy). Uwaga 2 bez zmian (zgodna z AC4).
