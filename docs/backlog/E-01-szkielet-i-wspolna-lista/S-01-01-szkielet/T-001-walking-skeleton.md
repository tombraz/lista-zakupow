---
id: T-001
title: "Walking skeleton: API, baza i web lokalnie"
epic: E-01
story: S-01-01
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given działający PostgreSQL, when klient wywoła `GET /health` i `GET /health/ready`, then oba zwracają 200; `GET /health` nie łączy się z bazą. — verified by: test integracyjny `health.test` (Testcontainers)
- [ ] AC2: Given niedostępna baza, when klient wywoła `GET /health/ready`, then dostaje 503, a `GET /health` dalej 200. — verified by: test integracyjny `health.test`
- [ ] AC3: Given czysta baza, when testy integracyjne startują, then wszystkie migracje z repo wykonują się na kontenerze PostgreSQL, a każdy test ma czystą bazę. — verified by: harness integracyjny + test pomocniczy izolacji
- [ ] AC4: Given strona web z podstawionym API (MSW), when API zwraca stan „gotowe” / „baza niedostępna” / błąd sieci, then strona pokazuje odpowiedni polski tekst. — verified by: test komponentu (RTL, `getByRole`)
- [ ] AC5: Given api uruchomione z buildem web, when przeglądarka otworzy stronę główną i dowolną ścieżkę spoza `/api` i `/health`, then dostaje SPA (fallback na `index.html`); skan axe nie znajduje naruszeń; `lang="pl"`. — verified by: E2E Playwright + `@axe-core/playwright` (viewport 390 × 844 i 1280 × 800)
- [ ] AC6: Given repozytorium, when uruchomię format check, lint (`--max-warnings 0`), type check, jscpd, dependency-cruiser i `design-check --scan`, then wszystkie przechodzą, a progi są jak w `CODING_STANDARDS.md` (reguły zakazu `dangerouslySetInnerHTML`, `sql.raw`, `eval` włączone). — verified by: komendy z przewodników + celowe naruszenie każdej reguły daje błąd (ręcznie, opisane w Evidence)
- [ ] AC7: Given `docs/architecture/layers/{db,backend,web,infra}.md`, when nowa osoba wykona komendy z sekcji „Komendy”, then każda działa na Windows (PowerShell / Git Bash) i Linux; sekcje „Gdzie jest kod” wskazują istniejące ścieżki. — verified by: ręczne przejście przez QA
- [ ] AC8: Given `tokens.json`, when uruchomię generowanie tokenów, then powstają `tokens.css` i `tokens.ts`, a strona web używa wyłącznie zmiennych z `tokens.css`. — verified by: test unit generatora (porównanie kilku wartości) + `design-check`
- [ ] SEC1 (TH-08, TH-15, TH-24): Given dowolna odpowiedź API (także pliki web i `index.html`), when sprawdzę nagłówki, then są `Content-Security-Policy` bez `unsafe-inline` dla skryptów, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`; CORS wyłączony (brak `Access-Control-Allow-Origin` dla obcego `Origin`). — verified by: test integracyjny `security-headers.test`
- [ ] SEC2 (TH-21): Given żądanie z nagłówkami `authorization` i `cookie` oraz polem `password` w treści, when API je zaloguje, then w logu nie ma ich wartości (redakcja pino), a każdy wpis ma `requestId`. — verified by: test integracyjny z przechwyconym strumieniem logów
- [ ] SEC3: Given żądanie z treścią > 16 kB, when trafi do API, then dostaje 413. — verified by: test integracyjny

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
