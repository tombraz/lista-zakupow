---
id: T-001
title: "Walking skeleton: API, baza i web lokalnie"
epic: E-01
story: S-01-01
status: done            # todo | in-progress | in-qa | done | blocked
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
- [x] AC7: Given `docs/architecture/layers/{db,backend,web,infra}.md`, when nowa osoba wykona komendy z sekcji „Komendy”, then każda działa na Windows (PowerShell / Git Bash) i Linux; sekcje „Gdzie jest kod” wskazują istniejące ścieżki. — verified by: ręczne przejście przez QA
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

### Poprawki po QA round 1 (2026-10-27)

Zakres uzgodniony z właścicielem: #1 (blocker), #2 i #3 (minor). Ustalenia #4–#8 (note) bez zmian.

| # | Czerwony | Poprawka | Zielony |
| --- | --- | --- | --- |
| 1 | Sprawdzenie ręczne (skrypt: pierwsza linia `---`, sekcja „Komendy” bez pustych komórek i placeholdera, zawiera komendy `pnpm`) — 4 × FAIL, np. `FAIL infra: pierwsza linia: \| start usług lokalnych \| …`, `FAIL infra: pusta komórka komendy`, `FAIL infra: placeholder` | Wiersze przeniesione do tabel „Komendy” w `layers/{infra,backend,db,web}.md`, uwagi (`DATABASE_URL`, izolacja testów) pod tabelą, placeholder usunięty, pozycja w „Historii zmian” (db i web: nowa sekcja). Treść komend bez zmian. | `OK: 4 przewodniki` |
| 2 | `security-headers.test.ts` › `%s carries CSP, HSTS and the other headers` (×3): `expected 'SAMEORIGIN' to be 'DENY'` | `frameguard: { action: "deny" }` w `apps/api/src/http/security-headers.ts` | ✔ 6/6; na żywo `pnpm start` → `X-Frame-Options: DENY` obok `frame-ancestors 'none'` |
| 3 | — (dokumentacja) | Właściciel zatwierdził zakres; `CODING_STANDARDS.md` sekcja 1: zakres Prettiera „kod i konfiguracja” z listą wyłączeń z `.prettierignore` + wpis o zmianie | — |

Pełny przebieg: `pnpm check` exit 0 (Prettier, ESLint, tsc, jscpd 0 klonów, dependency-cruiser 0 naruszeń / 73 moduły, design-check, backlog-check, **Vitest 7 plików / 24 testy**), `pnpm build` exit 0, `pnpm test:e2e` 4 passed.

Uwaga dla QA: w tym klonie pliki `docs/` mają w drzewie roboczym CRLF (indeks LF przez `.gitattributes`), stąd `head -1` w Git Bash może pokazać `---\r` — commit zapisuje LF.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-27)

Verdict: fail

Środowisko: Windows 11, Node 24.14.1, pnpm 12.11.2, Docker 29.8.2; świeży klon `85bd618` w katalogu tymczasowym; Linux: kontener `node:24.14.1` (klon repo, `pnpm install --frozen-lockfile`, Testcontainers przez gniazdo Dockera).

### Odtworzenie

- Świeży klon: `pnpm install --frozen-lockfile` (tokeny generowane w `postinstall`), `pnpm check` exit 0 (Prettier, ESLint 0, tsc 4 pakiety, jscpd 0 klonów, dependency-cruiser 0 naruszeń / 73 moduły, design-check 0 kolorów na sztywno, backlog-check OK, Vitest **7 plików / 24 testy**), `pnpm build` exit 0, `pnpm test:e2e` **4 passed**.
- Linux (`node:24.14.1`): install, `format:check`, `lint`, `typecheck`, `quality`, `design-check`, `vitest run` (24/24, z Testcontainers), `build` — wszystko zielone.
- Spot-checki (mutacja → test czerwony → przywrócone, `git status` czysty): bez `securityHeaders` → 3 testy SEC1 czerwone; bez `redact` → 2 testy SEC2 czerwone; bez `bodyLimit` → test 413 czerwony; bez `truncateAllTables` → test izolacji czerwony; `/health/ready` bez zapytania do bazy → test 503 czerwony; web: `database-down` → `ready` → test AC4 czerwony; bez `watchPool` → testy zielone, ale Vitest „Unhandled Errors: terminating connection…”, exit 1 (3/3 przebiegi). Lint: `sql.raw`, `eval`, `dangerouslySetInnerHTML` → błędy; `#ff0000` w CSS → design-check `HARD-CODED`.

### Kryteria akceptacji

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | `health.test` (`pool.totalCount === 0` dla `/health`); na żywo przez proxy Vite 200 / 200 |
| AC2 | pass | `health.test`; na żywo `docker compose stop postgres` → `/health/ready` 503 `{"status":"unavailable","database":"down"}`, `/health` 200, UI „API działa · baza niedostępna”; po starcie bazy 200, proces API żyje |
| AC3 | pass | `database.test` (liczba migracji = `_journal.json`; izolacja); spot-check bez `TRUNCATE` czerwony |
| AC4 | pass | `StartScreen.test` (role `heading` / `status`); w przeglądarce na buildzie: ładowanie „Sprawdzam połączenie…”, gotowe, błąd sieci (`route.abort`) i odpowiedź HTML 502 → „Brak połączenia z API” |
| AC5 | pass | E2E 4/4; dodatkowo axe (WCAG 2.2 AA) bez naruszeń w stanach ładowanie / gotowe / błąd sieci / 160 px (≈ 320 px przy 200 %), brak poziomego przewijania przy 320 px |
| AC6 | pass | `pnpm check` + celowe naruszenia (wyżej) |
| AC7 | **fail** | Komendy działają (PowerShell, Git Bash, Linux), ale sekcje „Komendy” we wszystkich czterech przewodnikach są puste — patrz #1 |
| AC8 | pass | `build.test` + `pnpm --filter @lista/tokens build` + design-check |
| SEC1 | pass | `security-headers.test`; `curl` na `pnpm start`: CSP / HSTS / `no-referrer` / `nosniff` / `frame-ancestors 'none'` na `/`, `/assets/*.js`, `/health/ready`; obcy `Origin` i preflight bez `Access-Control-Allow-Origin` |
| SEC2 | pass | `logging.test`; na żywo żądanie z `Authorization`, `Cookie`, `password`, `token` — żadna wartość w logu; każdy wpis żądania ma `requestId` |
| SEC3 | pass | `body-limit.test`; na żywo 17 kB JSON, `chunked` i `text/plain` → 413 |

Eksploracja bez uwag: path traversal (`/..%2f..%2fpackage.json`, `%2e%2e`, `..\`) → SPA albo 403, bez wycieku plików; nieznane `/api/*` i `POST` na ścieżkę SPA → 404 `not_found`; port zajęty → czytelny `EADDRINUSE`, exit 1; brak / zły `DATABASE_URL` → błąd zod bez wartości zmiennej; brak żądań do obcych domen; `.env` w `.gitignore`, `.env.example` bez wartości.

### Ustalenia

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | docs / AC7 | Wiersze tabel „Komendy” zostały wstawione na **początek** plików `docs/architecture/layers/{infra,backend,db,web}.md`, przed frontmatter YAML. Sekcje „Komendy” zostały puste (pusta tabela + `<Uzupełnia task walking skeleton.>`), a pliki nie zaczynają się już od `---` (zepsuty frontmatter `layer` / `status`). Nowa osoba w sekcji „Komendy” nie znajdzie żadnej komendy. | `head -3 docs/architecture/layers/infra.md` → `\| start usług lokalnych \| …`; `git show bfaf0a7 -- docs/architecture/layers/infra.md` → hunk `@@ -1,3 +1,6 @@` z wierszami przed `---`; to samo w backend, db, web (dopiski z db i web zawierają też uwagi o `DATABASE_URL` i izolacji testów) | Wiersze w tabelach sekcji „Komendy” (z uwagami pod tabelą), placeholder usunięty, każdy plik zaczyna się od `---`. Dodać pozycję historii zmian. |
| 2 | minor | security | `X-Frame-Options: SAMEORIGIN` (domyślne helmet) przeczy `frame-ancestors 'none'` z CSP. Nowoczesne przeglądarki biorą CSP, starsze — XFO. | `curl -D - http://127.0.0.1:3000/` | `frameguard: { action: "deny" }` w `security-headers.ts` (+ asercja w teście) |
| 3 | minor | standardy | Prettier nie obejmuje `docs/`, `.claude/`, `README.md`, a `CODING_STANDARDS.md` mówi „całe repo”; standard wymaga wpisu przy zmianie zakresu, w Evidence jest tylko propozycja. | `.prettierignore`; `CODING_STANDARDS.md` sekcja 1 | Właściciel zatwierdza zmianę i wpis trafia do `CODING_STANDARDS.md` (albo zakres wraca do całego repo). |
| 4 | note | testy | Test 3b przechodzi także bez poprawki (`watchPool`); suite jest czerwona tylko dzięki wykrywaniu „Unhandled Errors” przez Vitest (exit 1). Gryzie, ale pośrednio. | spot-check wyżej | Opcjonalnie asercja wprost (np. wpis `idle database connection lost` w przechwyconym logu). |
| 5 | note | api | 413 ma domyślny format Fastify (`{"statusCode":413,"code":"FST_ERR_CTP_BODY_TOO_LARGE",…}`), nie `{"error":{"code":…}}` z `architecture.md`. Odłożone świadomie do wspólnego handlera. | `curl` 17 kB | Pierwszy task ze wspólnym handlerem błędów mapuje też błędy Fastify (413, 400 parsowania). |
| 6 | note | logi / TH-08 | Pełny `req.url` z query stringiem trafia do logu (`/health?token=…` widoczny). Redakcja ścieżki `/invitations/:token` jest zaplanowana w T-008 (SEC5). | `start.log` | T-008: redakcja obejmuje `req.url` we wpisach `incoming request`. |
| 7 | note | infra | Dwa kontenery Testcontainers (`postgres:17.11-alpine`) z 2026-10-26 nadal działały (12–13 h) — prawdopodobnie przerwane przebiegi; bieżące przebiegi QA sprzątały po sobie. | `docker ps --filter label=org.testcontainers=true` | Do obserwacji w T-002; ewentualnie wpis w „Pułapkach” infra. |
| 8 | note | DRY | Tag obrazu `postgres:17.11-alpine` w trzech miejscach (autor zgłosił); `apps/web/e2e/server.ts` nie używa `POSTGRES_IMAGE`. | grep | Przy T-002/T-010 jedno źródło wersji. |

### Co musi się zmienić

1. Naprawić #1 we wszystkich czterech przewodnikach warstw (tylko dokumentacja; kod bez zmian).
2. #2 i #3 — poprawić przy okazji (minor, nie blokują same w sobie).

## QA round 2 (2026-10-27)

Verdict: pass

Środowisko: Windows 11, Node 24.14.1, pnpm 12.11.2, Docker 29.8.2; świeży klon `05f6434` w katalogu tymczasowym. Zakres rundy: poprawki z `05f6434` (diff przejrzany: 4 przewodniki warstw, `security-headers.ts` + asercja, `CODING_STANDARDS.md`) oraz pełne odtworzenie.

### Odtworzenie

- Świeży klon: `pnpm install --frozen-lockfile`, `pnpm check` exit 0 (Prettier OK, ESLint 0, tsc, jscpd 0 klonów, dependency-cruiser 0 naruszeń / 73 moduły, design-check 0 kolorów na sztywno / 35 kontrastów OK, backlog-check OK, Vitest **7 plików / 24 testy**), `pnpm build` exit 0, `pnpm test:e2e` **4 passed** (1 worker). `git status` w klonie czysty po install / build / testach.
- Spot-check: usunięty `frameguard` → `security-headers.test` 3 czerwone (`expected 'SAMEORIGIN' to be 'DENY'`) → przywrócone, `git status` czysty.
- Testy nieosłabione: jedyna zmiana w plikach testów od `bfaf0a7` to dodana asercja `x-frame-options`.

### Kryteria akceptacji

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1–AC6, AC8 | pass | jak w rundzie 1; ponownie zielone `pnpm check`, `pnpm build`, `pnpm test:e2e`; kod poza `security-headers.ts` bez zmian |
| AC7 | pass | wszystkie 4 przewodniki zaczynają się od `---`, brak placeholdera, tabele „Komendy” pełne; wszystkie ścieżki z „Gdzie jest kod” istnieją (38 sprawdzonych); komendy z tabel uruchomione w PowerShell: `db:migrate`, `vitest run` pojedynczego pliku api i web, `--project api` (18), `--project web --project tokens` (6), `typecheck`, `design-check`, build tokenów / api / web, `start`; `services:up` w głównym repo OK. Linux: treść komend identyczna z rundą 1 (wiersze tylko przeniesione), gdzie przeszły w `node:24.14.1` |
| SEC1 | pass | test + na żywo `pnpm start`: CSP z `frame-ancestors 'none'`, **`X-Frame-Options: DENY`**, HSTS, `no-referrer`, `nosniff`; obcy `Origin` bez `Access-Control-*` |
| SEC2, SEC3 | pass | testy zielone; kod bez zmian od rundy 1 |

### Ustalenia

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | infra / AC7 | `pnpm services:up` w drugim klonie na tej samej maszynie pada (`Bind for 0.0.0.0:1025 failed: port is already allocated`), gdy działa stos Compose z innego katalogu — porty hosta są stałe. Nie dotyczy nowej osoby z jednym klonem. | `docker ps`: `lista-zakupow-mailpit-1` na 1025 | Ewentualnie wpis w „Pułapkach” infra. |
| 2 | note | infra | Dwa kontenery Testcontainers z 2026-10-26 (`boring_einstein`, `laughing_rubin`) nadal działają (13 h) — to samo co ustalenie #7 rundy 1; przebiegi tej rundy nie zostawiły nowych. | `docker ps --filter label=org.testcontainers=true` | Do obserwacji w T-002. |
| 3 | note | — | Ustalenia #4–#6 i #8 z rundy 1 (pośrednie gryzienie testu 3b, format 413, `req.url` w logu → T-008, tag obrazu w trzech miejscach) pozostają aktualne; zostały świadomie odłożone. | runda 1 | Nowe taski tylko za zgodą właściciela. |
