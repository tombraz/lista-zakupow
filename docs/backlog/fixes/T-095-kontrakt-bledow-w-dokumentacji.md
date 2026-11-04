---
id: T-095
title: "architecture.md i api.md zgodne z kodem; test zgodności ErrorCode"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

## Evidence

## Prevention

Test z AC4 zastępuje ręczną regułę z `backend.md:108`.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
