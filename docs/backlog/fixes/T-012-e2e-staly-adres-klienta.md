---
id: T-012
title: "E2E: drugi klient z losowym adresem zamiast stałego x-forwarded-for"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: [T-005]
layers: [web]          # names from docs/architecture/layers/
requirements: []       # F-xx the expected behaviour comes from
threats: []            # TH-xx from docs/architecture/threat-model.md this task mitigates
screens: []
related_tasks: [T-005, T-011]
---

# T-012 E2E: drugi klient z losowym adresem zamiast stałego x-forwarded-for

## Report

- **Actual:** SEC3 w `apps/web/e2e/j02-listy.spec.ts:90` rejestruje drugie konto (Bartek) w kontekście ze stałym `x-forwarded-for: 10.200.0.2`. Rejestracja ma limit na IP (`signUpPerIp` = 5 / h), więc po pięciu rejestracjach z tego adresu w jednym przebiegu API SEC3 oblewa na „Moje listy” po rejestracji drugiego konta.
- **Expected:** każdy klient w E2E ma losowy adres jak w `fixtures.ts` (wspólny helper drugiego klienta) i sprawdzenie w CI odrzuca stały `x-forwarded-for` w specach — source: user (QA T-011 runda 1 #2).
- **Steps to reproduce:**
  1. `cd apps/web && playwright test e2e/j02-listy.spec.ts --project=komputer --repeat-each=6`
  2. Wynik 17/18: szósty SEC3 oblewa (`expect(locator).toBeVisible() failed`, j02-listy.spec.ts:94).
- **Environment:** lokalnie i CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `0865bd8`).
- **Evidence:** QA T-011 runda 1 #2 i #3. Pilność normalna, nie dotyczy bezpieczeństwa (tylko testy).

## Acceptance criteria

- [x] AC1: Given SEC3 uruchamiany wielokrotnie w jednym przebiegu API, when `--repeat-each=6`, then 18/18 — każdy drugi klient dostaje własny losowy adres ze wspólnego helpera w `fixtures.ts`. — verified by: `playwright test e2e/j02-listy.spec.ts --project=komputer --repeat-each=6`
- [x] AC2: Given spec E2E z literałem `x-forwarded-for` poza `fixtures.ts`, when `pnpm lint` (job CI `static`), then błąd ESLint. — verified by: `pnpm lint` na specu ze stałym nagłówkiem (red), po poprawce czysty
- [x] AC3: No regression in: `pnpm test:e2e` (J-01, J-02, J-03).

## TDD plan

**Seam:** przebieg Playwright z `--repeat-each` (jak w raporcie QA) oraz `pnpm lint` dla specu.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | SEC3 `--repeat-each=6` | E2E | Playwright | AC1 |
| 2 | reguła `no-restricted-syntax` na literał `x-forwarded-for` w `apps/web/e2e/**` poza `fixtures.ts` | lint | ESLint | AC2 |

**Run:** `pnpm --filter @lista/web exec playwright test e2e/j02-listy.spec.ts --project=komputer --repeat-each=6`; `pnpm lint`

## QA plan

- **Regression:** pełny `pnpm test:e2e`; reguły TH-15 / TH-20 nadal obowiązują w `apps/web/e2e/**` (nadpisanie `no-restricted-syntax` nie może ich zgubić).
- **Edge cases:** nagłówek wielkimi literami (`X-Forwarded-For`); drugi kontekst bez nagłówka (`browser.newContext()` → wszyscy jako 127.0.0.1).
- **Platforms:** Windows (1 worker), Linux CI (równolegle).

## Root cause

`fixtures.ts` nadawał losowy adres tylko domyślnemu `context` testu; nie było helpera dla dodatkowych kontekstów, więc T-005 (SEC3, `9fc8fd1`) wpisał stały `10.200.0.2`. Limiter API trzyma liczniki w pamięci przez cały przebieg, więc wszystkie powtórzenia SEC3 rejestrują z jednego adresu, a szósta rejestracja dostaje 429. Testy tego nie złapały, bo zwykły przebieg robi z tego adresu tylko 2 rejestracje (projekty `telefon` i `komputer`) przy limicie 5 — błąd wychodzi dopiero przy `--repeat-each` / ponownych próbach.

Inne wystąpienia (ta sama przyczyna, poprawione tutaj): `j01-konto.spec.ts:74` — `browser.newContext()` bez nagłówka, więc wszyscy tacy klienci występują jako 127.0.0.1 i dzielą jeden licznik.

## Evidence

Przebieg 2026-10-28, Windows 11 (1 worker), Docker (Testcontainers).

- **Red (E2E)** — `playwright test e2e/j02-listy.spec.ts --project=komputer --repeat-each=6` → 17/18: `SEC3 … repeat5`, `expect(locator).toBeVisible() failed`, `getByRole('heading', { name: 'Moje listy', level: 1 })`, j02-listy.spec.ts:94 (szósta rejestracja z `10.200.0.2`).
- **Red (lint)** — nowa reguła na niezmienionych specach: `j02-listy.spec.ts` 89:23 (`newContext`) i 90:25 (literał `x-forwarded-for`), `j01-konto.spec.ts` 74:23 (`newContext`).
- **Poprawka** — `fixtures.ts`: `clientHeaders()` (losowy adres) używany przez fixture `context` i nowy `newClient(browser)`; SEC3 i SC-02 (J-01) tworzą drugi kontekst przez `newClient`. `eslint.config.js`: dla `apps/web/e2e/**` poza `fixtures.ts` `no-restricted-syntax` odrzuca literał `x-forwarded-for` (bez względu na wielkość liter) i wywołanie `newContext`; lista powtarza reguły TH-15 / TH-20 (nadpisanie zastępuje listę). Sonda: `"X-Forwarded-For"` i `sql.raw` w specu → 2 błędy; literał w `fixtures.ts` → brak błędu.
- **Green** — ten sam przebieg `--repeat-each=6` → **18/18**; `pnpm test:e2e` **22/22**; `pnpm check` (Prettier, ESLint, `tsc`, jscpd 0 klonów, dependency-cruiser 0 naruszeń, design-check, backlog-check OK, Vitest **49 plików / 247 testów**).

## Prevention

Część poprawki na życzenie użytkownika (raport): reguła ESLint w jobie CI `static` (`pnpm lint`) odrzuca stały `x-forwarded-for` i własne `newContext` w specach E2E; jedyne źródło adresu klienta to `fixtures.ts`.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-28)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | lint (AC2) | Reguła `E2E_CLIENT_SYNTAX` łapie tylko `Literal` i `.newContext(` przez kropkę; obejście świadome: szablon `` `x-forwarded-for` `` (TemplateLiteral) i `browser["newContext"]()` przechodzą bez błędu. | Sonda `apps/web/e2e/zz-probe.spec.ts` (usunięta): błędy dla `newContext({...})`, `"X-Forwarded-For"`, `"X-FORWARDED-FOR"`; brak błędu dla linii z szablonem i z `browser["newContext"]()`. | Opcjonalnie dodać selektory `TemplateElement[value.raw=/^x-forwarded-for$/i]` i `CallExpression[callee.property.value='newContext']`. Nie blokuje — przypadkowy powrót do starego wzorca jest łapany. |

**Reprodukcja (Windows 11, 1 worker, Docker):**

- `pnpm install --frozen-lockfile` — bez zmian w plikach śledzonych.
- `pnpm check` — Prettier, ESLint, `tsc`, jscpd, dependency-cruiser, design-check, backlog-check OK; Vitest 49 plików / 247 testów zielone.
- AC1: `playwright test e2e/j02-listy.spec.ts --project=komputer --repeat-each=6` → **18/18** — pass.
- Spot-check AC1 (red): przywrócony `j02-listy.spec.ts` sprzed poprawki (`a778832~1`, stały `10.200.0.2`), `--repeat-each=6 -g SEC3` → 5 passed, 1 failed (SEC3). Plik przywrócony `git checkout`, `git status` czysty.
- AC2: sonda w `apps/web/e2e/` — `browser.newContext(...)` i literał `X-Forwarded-For` / `X-FORWARDED-FOR` dają błąd `no-restricted-syntax`; `fixtures.ts` wyłączony z reguły (ignores), obecne specy czyste — pass. Regresja TH-20: `sql.raw` w pliku `apps/web/e2e/` nadal błąd (SAFE_SYNTAX powtórzone w nadpisaniu) — OK. Kolejność bloków w `eslint.config.js`: późniejsze bloki (`sizeRules`) nie nadpisują `no-restricted-syntax`.
- AC3: `pnpm test:e2e` → **22/22** — pass.
- Root cause: wyjaśnia, czemu zwykły przebieg nie łapał błędu (2 rejestracje z adresu przy limicie 5) — OK. Grep `newContext|forwarded` w `apps/web/e2e/` — wystąpienia tylko w `fixtures.ts`.
- Kod: `clientHeaders()` usuwa duplikację wiedzy o adresie; `newClient` ma 2 użycia; aktualizacja `docs/architecture/layers/web.md` w zakresie. Brak zmian produkcyjnych.
