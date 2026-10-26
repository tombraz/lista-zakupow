---
id: T-001
title: "Walking skeleton: API, baza i web lokalnie"
epic: E-01
story: S-01-01
status: in-qa                 # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []         # inline list only, e.g. [T-001, T-004]; only real blockers
size: M                # S | M (L must be split)
layers: [db, backend, web, infra]
requirements: [N-01, N-04, N-05]
threats: [TH-08, TH-15, TH-21, TH-24]
screens: []
---

# T-001 Walking skeleton: API, baza i web lokalnie

## Goal

Najcieńsza ścieżka przez wszystkie warstwy poza mobile: PostgreSQL z pierwszą migracją, API Fastify z `/health` i `/health/ready`, strona web (React + Vite) pokazująca stan API i bazy, serwowana przez API pod jednym originem z nagłówkami bezpieczeństwa. Działają runnery testów każdego poziomu, lint, formatowanie i sprawdzenia jakości kodu; przewodniki warstw db, backend, web i infra mają prawdziwe ścieżki i komendy.

## Demo

1. Świeży klon: komendy z przewodnika infra uruchamiają Docker Compose (PostgreSQL + Mailpit), komenda z przewodnika backend uruchamia api i web w trybie dev.
2. Przeglądarka na adresie web: nagłówek „Wspólna lista zakupów” i tekst „API działa · baza działa”. Po zatrzymaniu kontenera bazy i odświeżeniu: „API działa · baza niedostępna”.
3. Build produkcyjny web + start API: ta sama strona pod adresem API, w odpowiedzi nagłówki CSP, HSTS, `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, `frame-ancestors 'none'`.
4. Komendy testów, lint, typów, jakości i `design-check` przechodzą; celowo dodany kolor na sztywno w komponencie web zatrzymuje `design-check`.

## Context

- Architektura: `docs/architecture/architecture.md` (kontenery, moduły), `tech-stack.md`, ADR 0001 (monorepo), ADR 0006 (jeden origin, API serwuje web).
- Standardy: `docs/architecture/CODING_STANDARDS.md` — progi ESLint, jscpd, dependency-cruiser, TypeScript.
- Testy: `docs/architecture/testing-strategy.md` — poziomy, seams, dane testowe (wybór: baza-szablon albo `TRUNCATE … CASCADE` — decyzja tutaj).
- Tokeny: `docs/design/tokens.json` → `packages/tokens` (Style Dictionary) → `tokens.css` (web) i `tokens.ts` (mobile).
- Przewodniki warstw: `docs/architecture/layers/{db,backend,web,infra}.md` — sekcje „Gdzie jest kod” i „Komendy” do uzupełnienia.
- Depends on: —

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given działający PostgreSQL, when klient wywoła `GET /health` i `GET /health/ready`, then oba zwracają 200; `GET /health` nie łączy się z bazą. — verified by: test integracyjny `health.test` (Testcontainers)
- [x] AC2: Given niedostępna baza, when klient wywoła `GET /health/ready`, then dostaje 503, a `GET /health` dalej 200. — verified by: test integracyjny `health.test`
- [x] AC3: Given czysta baza, when testy integracyjne startują, then wszystkie migracje z repo wykonują się na kontenerze PostgreSQL, a każdy test ma czystą bazę. — verified by: harness integracyjny + test pomocniczy izolacji
- [x] AC4: Given strona web z podstawionym API (MSW), when API zwraca stan „gotowe” / „baza niedostępna” / błąd sieci, then strona pokazuje odpowiedni polski tekst. — verified by: test komponentu (RTL, `getByRole`)
- [x] AC5: Given api uruchomione z buildem web, when przeglądarka otworzy stronę główną i dowolną ścieżkę spoza `/api` i `/health`, then dostaje SPA (fallback na `index.html`); skan axe nie znajduje naruszeń; `lang="pl"`. — verified by: E2E Playwright + `@axe-core/playwright` (viewport 390 × 844 i 1280 × 800)
- [x] AC6: Given repozytorium, when uruchomię format check, lint (`--max-warnings 0`), type check, jscpd, dependency-cruiser i `design-check --scan`, then wszystkie przechodzą, a progi są jak w `CODING_STANDARDS.md` (reguły zakazu `dangerouslySetInnerHTML`, `sql.raw`, `eval` włączone). — verified by: komendy z przewodników + celowe naruszenie każdej reguły daje błąd (ręcznie, opisane w Evidence)
- [ ] AC7: Given `docs/architecture/layers/{db,backend,web,infra}.md`, when nowa osoba wykona komendy z sekcji „Komendy”, then każda działa na Windows (PowerShell / Git Bash) i Linux; sekcje „Gdzie jest kod” wskazują istniejące ścieżki. — verified by: ręczne przejście przez QA
- [x] AC8: Given `tokens.json`, when uruchomię generowanie tokenów, then powstają `tokens.css` i `tokens.ts`, a strona web używa wyłącznie zmiennych z `tokens.css`. — verified by: test unit generatora (porównanie kilku wartości) + `design-check`
- [x] SEC1 (TH-08, TH-15, TH-24): Given dowolna odpowiedź API (także pliki web i `index.html`), when sprawdzę nagłówki, then są `Content-Security-Policy` bez `unsafe-inline` dla skryptów, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`; CORS wyłączony (brak `Access-Control-Allow-Origin` dla obcego `Origin`). — verified by: test integracyjny `security-headers.test`
- [x] SEC2 (TH-21): Given żądanie z nagłówkami `authorization` i `cookie` oraz polem `password` w treści, when API je zaloguje, then w logu nie ma ich wartości (redakcja pino), a każdy wpis ma `requestId`. — verified by: test integracyjny z przechwyconym strumieniem logów
- [x] SEC3: Given żądanie z treścią > 16 kB, when trafi do API, then dostaje 413. — verified by: test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API przez `fastify.inject` (`/health`, `/health/ready`, statyczne pliki web, nagłówki)
- ekran startowy web z klientem API podstawionym przez MSW
- przeglądarka (Playwright) na api serwującym build web

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `GET /health` zwraca 200 bez bazy | integration | Vitest + `fastify.inject` | AC1 |
| 2 | migracje wykonują się na kontenerze; dwa testy nie widzą swoich danych | integration | Vitest + Testcontainers | AC3 |
| 3 | `GET /health/ready` 200 z bazą, 503 bez bazy | integration | Vitest + Testcontainers | AC1, AC2 |
| 3b | API przeżywa zerwanie bezczynnych połączeń przez bazę i znów odpowiada 200 (dodany w trakcie: wykryty w demo) | integration | Vitest + Testcontainers | AC2, QA plan „baza zatrzymana w trakcie” |
| 4 | nagłówki bezpieczeństwa na `/health` i na `index.html`; brak CORS | integration | Vitest + `fastify.inject` | SEC1 |
| 5 | redakcja logów i `requestId` | integration | Vitest | SEC2 |
| 6 | 413 dla treści > 16 kB | integration | Vitest | SEC3 |
| 7 | generator tokenów tworzy oczekiwane zmienne | unit | Vitest | AC8 |
| 8 | ekran startowy: trzy stany tekstu | component | Vitest + RTL + MSW | AC4 |
| 9 | SPA fallback + skan axe na dwóch viewportach | E2E | Playwright + axe | AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web (ustalane w tym tasku; propozycja `pnpm test` w korzeniu i `pnpm test:e2e`)

**Mocks:** tylko API w testach komponentów (MSW). Baza zawsze prawdziwa (Testcontainers).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** baza zatrzymana w trakcie działania API (ready → 503, potem z powrotem 200); port zajęty; świeży klon bez `node_modules`.
- **Design states:** ekran startowy: gotowe, baza niedostępna, błąd sieci.
- **Platforms / devices:** Chrome na komputerze, Safari na iPhonie (przez adres w sieci lokalnej, jeśli możliwe), szerokość 320 px i 200 % powiększenia.
- **Accessibility:** `lang="pl"`, nagłówek `h1`, kontrast tekstów (tokeny), nawigacja klawiaturą (brak pułapek).
- **Security / privacy:** nagłówki w przeglądarce (DevTools); brak zasobów z zewnętrznych domen; log API przy żądaniu z ciasteczkiem nie zawiera jego wartości; `.env` w `.gitignore`, `.env.example` bez wartości.
- **Regression:** —

## Implementation notes

- Wersja Node (aktywne LTS) i pnpm przypięte (`engines`, `packageManager`, `.nvmrc` lub odpowiednik); Docker Compose z obrazami o przypiętych tagach.
- Struktura z `architecture.md`: `apps/api`, `apps/web`, `packages/shared`, `packages/tokens`; moduły api w `apps/api/src/modules/<moduł>/{domain,http,infra}` — tu jeszcze puste lub tylko `health`.
- Better Auth, tabele domenowe i fabryki domenowe przychodzą w kolejnych taskach; tu tylko harness (`apps/api/test/` z pomocnikiem bazy i budową aplikacji testowej) i pierwsza migracja (może być pusta technicznie, ale musi przejść przez drizzle-kit).
- `@fastify/static` z `apps/web/dist` + fallback; `@fastify/helmet` dla wszystkich odpowiedzi; lokalnie Vite proxy `/api` do API (ten sam origin jak na serwerze).
- Pula połączeń z `idleTimeoutMillis` ≤ 60 s (koszt Neon, `deployment.md`).
- Logger pino: JSON, redakcja `authorization`, `cookie`, `password`, `token`; `requestId` w każdym wpisie; osobny logger potomny `security` gotowy do użycia.
- Teksty w pliku komunikatów obok ekranu (bez biblioteki i18n).
- Wybór strategii izolacji testów integracyjnych zapisać w `testing-strategy.md` („Dane testowe”) i w przewodniku db.
- Skille: `postgres-best-practices:supabase-postgres-best-practices` przed migracją.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below (AC7 — ręcznie przez QA)
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg z 2026-10-26, Windows 11, Node 24.14.1, pnpm 12.11.2, Docker 29.8.2.

### Decyzje podjęte w tym tasku

- Izolacja testów integracyjnych: baza-szablon per plik + `TRUNCATE … CASCADE` przed testem (wybór właściciela) — zapisane w `testing-strategy.md` („Dane testowe”) i w przewodniku db.
- Narzędzia uruchomieniowe (zgoda właściciela): `pg`, `tsx`, `esbuild`, `pnpm --parallel` — tabela w `tech-stack.md`.
- Wersje: TypeScript 6.0.3 i ESLint 9.39.5 (TS 7 i ESLint 10 wychodzą poza peery `typescript-eslint` / `eslint-plugin-jsx-a11y`); PostgreSQL 17.11 (zgodnie z Neon), Mailpit v1.32.0.
- Baza z Compose na porcie hosta **5442**, nie 5432: na maszynie deweloperskiej działa usługa Windows `postgresql-x64-16` na 5432 i przejmowała połączenia.
- CSP bez `upgrade-insecure-requests` (lokalnie HTTP; na Fly HTTPS wymusza platforma + HSTS).
- Nieznane ścieżki `/api/*` dają 404 `{"error":{"code":"not_found"}}`; wspólny handler błędów domenowych (format z `architecture.md`, 500 z `requestId`) przyjdzie z pierwszym modułem domenowym — poza zakresem T-001.
- Prettier obejmuje kod i konfigurację; `docs/`, `.claude/` i `README.md` (UTF-16) wyłączone w `.prettierignore`. **Propozycja do `CODING_STANDARDS.md`:** zakres „całe repo” → „kod i konfiguracja (bez `docs/`)”.

### TDD — czerwone przed zielonym

| # | Test (plik) | Czerwony (komunikat) | Teraz |
| --- | --- | --- | --- |
| 1 | `apps/api/test/health.test.ts` › GET /health returns 200 without touching the database | `AssertionError: expected 404 to be 200` | ✔ |
| 2 | `apps/api/test/database.test.ts` › has every migration from the repository applied | `expected +0 to be 1` (pierwsza wersja padała na błędzie zapytania — poprawiony test, nie kod) | ✔ |
| 2 | … › starts the next test with empty tables | `expected [ { value: 'from the previous test' } ] to deeply equal []` | ✔ |
| 3 | `health.test.ts` › /health/ready 200 z bazą; 503 i /health 200 bez bazy | `expected 404 to be 200`, `expected 404 to be 503` | ✔ |
| 3b | `health.test.ts` › keeps running when the database drops idle connections and answers 200 again | Vitest „Unhandled Errors: terminating connection due to administrator command” (ten sam crash procesu API, który wyszedł w demo po `docker compose stop postgres`); pierwsza wersja testu przechodziła fałszywie (zrywała własne połączenie) — poprawiona | ✔ |
| 4 | `apps/api/test/security-headers.test.ts` (nagłówki na `/health`, `/`, `/listy/123`; SPA) | `expected 'undefined' to contain "default-src 'self'"`, `expected 404 to be 200`, `expected 'application/json; charset=utf-8' to contain 'text/html'` | ✔ |
| 4 | … › does not allow cross-origin requests; does not answer unknown /api paths with the SPA | zielone od początku — strażniki (CORS nie jest zainstalowany; 404 było domyślne) | ✔ |
| 5 | `apps/api/test/logging.test.ts` (redakcja, `requestId`, kanał `security`) | `expected '{"level":30,…' not to contain 'secret-password-value'`, `expected undefined to deeply equal Any<String>`, `expected undefined to be 'security'` | ✔ |
| 6 | `apps/api/test/body-limit.test.ts` › rejects a body larger than 16 kB with 413 | `expected 404 to be 413` (test „15 kB przechodzi” zielony od początku — strażnik) | ✔ |
| 7 | `packages/tokens/test/build.test.ts` | `expected '' to contain ':root {'`, `expected '' to contain 'export const ColorTextPrimary = "#0f1…'` | ✔ |
| 8 | `apps/web/src/screens/start/StartScreen.test.tsx` (nagłówek h1, trzy stany w `role="status"`) | `Unable to find an element with the text: API działa · baza działa`, `Unable to find an accessible element with the role "status"` | ✔ |
| 9 | `apps/web/e2e/start.spec.ts` (`/` i `/dowolna/sciezka`, axe WCAG 2.2 AA, viewport 390 × 844 i 1280 × 800) | pisany po działaniu na szybszych seamach (krok 6); dowód, że gryzie: `WEB_DIST_DIR=/nonexistent` → `toHaveAttribute: Expected "pl", Received ""`; kolor statusu podmieniony na `--color-action-disabled` → axe `color-contrast` (4 failed) | ✔ 4 passed |

Pełny przebieg: `pnpm check` — exit 0 (Prettier OK, ESLint 0 problemów, tsc 4 pakiety, jscpd 0 klonów / 0 %, dependency-cruiser 0 naruszeń, design-check 0 kolorów na sztywno i 35 kontrastów OK, backlog-check OK, **Vitest 7 plików / 24 testy**). `pnpm build` — exit 0. `pnpm test:e2e` — 4 passed.

### Kryteria akceptacji

- **AC1, AC2** — testy 1, 3, 3b. Demo (`pnpm dev`, proxy Vite): `/health/ready` 200 → po `docker compose stop postgres` 503 `{"status":"unavailable","database":"down"}` przy `/health` 200 → po starcie bazy znów 200; w logu `idle database connection lost`, proces żyje.
- **AC3** — test 2 (liczba wykonanych migracji = liczba wpisów w `drizzle/meta/_journal.json`; izolacja między testami).
- **AC4** — test 8. Zrzuty (390 px): `C:/Users/tombr/AppData/Local/Temp/claude/D--myProjects-lista-zakupow/8a0e7533-ee67-4d2f-b0d8-feb23f250bdb/scratchpad/t001-ready.png`, `C:/Users/tombr/AppData/Local/Temp/claude/D--myProjects-lista-zakupow/8a0e7533-ee67-4d2f-b0d8-feb23f250bdb/scratchpad/t001-db-down.png`.
- **AC5** — test 9 (SPA na `/` i dowolnej ścieżce, `lang="pl"`, axe bez naruszeń, dwa viewporty).
- **AC6** — `pnpm check` zielony; celowe naruszenia (pliki tymczasowe, usunięte) dały błąd każdej reguły: `sql.raw` → no-restricted-syntax; `eval` → no-eval; `localStorage` → no-restricted-globals; `dangerouslySetInnerHTML` → react/no-danger + no-restricted-syntax; 5 parametrów / złożoność 11 → max-params, complexity; kopia pliku → jscpd „6.4 % over threshold 3 %”; `packages/shared` → `apps/` → shared-without-apps; import `infra` innego modułu → modules-only-through-index; `domain` → `fastify`, `drizzle-orm`, `infra` → domain-without-frameworks (wymagało poprawki konfiguracji: `exclude` pomijał `node_modules`, przez co zależności zewnętrzne nie były sprawdzane); `#ff0000` w CSS → design-check HARD-CODED; zły format → prettier --check; nieużywana zmienna → TS6133.
- **AC7** — do ręcznego przejścia przez QA; komendy sprawdzone tu na Windows (Git Bash i PowerShell przez `pnpm`); Linux nie był dostępny w tym przebiegu.
- **AC8** — test 7 + design-check (0 kolorów na sztywno; style web używają wyłącznie `var(--…)` z `@lista/tokens/tokens.css`).
- **SEC1** — test 4; ręcznie `curl -I` na `pnpm start`: CSP `default-src 'self';script-src 'self';…;frame-ancestors 'none'`, HSTS `max-age=31536000; includeSubDomains`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- **SEC2** — test 5 (wartości `authorization`, `cookie`, `password`, `token` nie trafiają do logu; `requestId` we wpisach żądań; `securityLog()` → `channel: "security"`).
- **SEC3** — test 6.

### Na co QA powinno zwrócić uwagę

- **E2E na Windows: 1 worker.** Przy równoległych workerach API na Windows zamierało na ok. 10 s. Profil CPU wskazał natywne zamknięcie gniazda TCP (`closeSocketHandle node:net:341`) w chwili, gdy inny proces Chromium kończył pracę. Winsock bez LSP; przy 1 workerze 5/5 przebiegów czystych (maks. opóźnienie pętli < 0,5 s). Na Linuksie (CI) zostaje równoległość — do potwierdzenia w T-002. **Propozycja do przewodnika infra, „Pułapki”:** wpis o tym zjawisku.
- **Pula `pg`:** `idleTimeoutMillis` 30 s, `idle_in_transaction_session_timeout` 30 s, `connectionTimeoutMillis` 3 s; błąd bezczynnego połączenia jest logowany, a nie zabija procesu (test 3b).
- Build API (`apps/api/build.mjs`) wbudowuje pakiety `@lista/*`, a zależności npm zostawia zewnętrzne; migracje uruchamia `db:migrate` (`tsx`). Obraz Dockera (T-010) musi uwzględnić `apps/api/drizzle/`.
- `tokens.ts` dla mobile ma wymiary jako napisy (`"16px"`); T-003 może potrzebować liczb.
- Obraz `postgres:17.11-alpine` występuje w trzech miejscach (`docker-compose.yml`, `apps/api/test/database-constants.ts`, `apps/web/e2e/server.ts`).
- `.env` nie powstał w repo (zapis zablokowany przez uprawnienia); demo szło ze zmienną `DATABASE_URL`.

<!-- QA rounds are appended below by /qa-task -->
