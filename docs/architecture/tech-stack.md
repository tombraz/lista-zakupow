---
status: approved          # draft | approved
approved: 2026-10-26
---

# Stos technologiczny

Ustalony z właścicielem 2026-10-26 (`/tech-architecture`, krok 1). Każdy wybór ma powód i główną alternatywę; decyzje trudne do odwrócenia mają ADR w `docs/adr/`.

## Decyzje

| Obszar | Wybór | Powód | Główna alternatywa | Wymagania |
| --- | --- | --- | --- | --- |
| Platformy | web responsywny (przeglądarka) + natywna aplikacja mobilna Expo / React Native (Android + iOS) | wymóg N-01; pilotaż ma sprawdzić też warstwę mobile | sam web + PWA (prościej, design jest webowy) | N-01 |
| Dystrybucja mobile | bez sklepów: development build / EAS internal distribution | pilotaż dla domowników, bez kont deweloperskich i przeglądów sklepów | Google Play i App Store | N-01 |
| Repozytorium | monorepo, pnpm workspaces | jeden PR na epik, wspólne typy i walidacja dla api, web i mobile | npm workspaces | — |
| Język | TypeScript (strict) wszędzie, Node.js aktywne LTS (wersja przypięta w walking skeleton) | jeden język dla api, web i mobile; wspólny pakiet walidacji | — | — |
| Backend | Fastify | lekki, szybki, dobre wsparcie WebSocket (`@fastify/websocket`) i rate limitów | NestJS (więcej struktury i ceremonii) | F-01…F-16 |
| ORM i migracje | Drizzle ORM + drizzle-kit (migracje SQL w repo) | schemat w TS, czytelne migracje SQL, bezpieczne zapytania parametryzowane | Prisma | — |
| Baza danych | PostgreSQL | relacje, transakcje, unikalne indeksy (F-09) i blokady przy limitach | — | F-05, F-07, F-09, F-12 |
| Zmiany na żywo | WebSocket z API (kanał per lista), jedna instancja API (ADR 0003) | działa tak samo w przeglądarce i React Native; serwer zamyka subskrypcje po utracie dostępu | SSE (w RN wymaga polyfillu) | F-14, N-06, MC-03 |
| Uwierzytelnianie | Better Auth: e-mail + hasło, reset hasła, sesje w Postgresie, plugin Expo (ADR 0002) | sprawdzona biblioteka, sesje łatwe do unieważnienia, bez własnej kryptografii | Clerk / Auth0 | F-01…F-04, MC-04 |
| Web | React + Vite (SPA) | prosty build statyczny, pełna kontrola nad dostępnością | Next.js | N-01, N-04 |
| Stylowanie web | CSS Modules + zmienne CSS generowane z `docs/design/tokens.json` | tokeny jako jedyne źródło wartości; mało zależności | Tailwind | N-04 |
| Mobile | Expo (React Native), Android + iOS | ten sam język i pakiet `shared` co web i api | Flutter, natywne | N-01 |
| Lokalne środowisko | Docker Compose: PostgreSQL + Mailpit; api, web i Expo uruchamiane natywnie (`pnpm dev`) | szybki hot reload na Windows; podgląd maila resetu bez wysyłki | wszystko w kontenerach | F-03 |
| Testy: unit + integracja | Vitest; integracja na prawdziwym PostgreSQL przez Testcontainers | prawdziwa baza wyłapuje błędy ograniczeń i transakcji | Jest | — |
| Testy: komponenty | React Testing Library (web), React Native Testing Library (mobile) | zapytania po roli i nazwie dostępnej | — | N-04 |
| Testy: E2E web | Playwright + `@axe-core/playwright` | krytyczne ścieżki i skany dostępności | Cypress | N-04 |
| Testy: E2E mobile | Maestro | proste flowy YAML, Android i iOS | Detox (trudniejszy setup) | N-01 |
| Logi | pino (JSON, bez danych osobowych) | wbudowany w Fastify | — | N-02, N-03 |
| Śledzenie błędów, analityka | brak zewnętrznych narzędzi; miary sukcesu liczone zapytaniami SQL z danych aplikacji | BRD N-02: bez zewnętrznej analityki i śledzenia, zero dodatkowych podmiotów | Sentry | N-02 |
| Hosting, CI/CD | preferencja: najtaniej (darmowo lub kilka euro miesięcznie), dane w UE, CI na GitHub Actions; dostawcy i pipeline w `/ci-cd` | pilotaż niekomercyjny | — | N-03 |
| Wysyłka maila (reset hasła) | dostawca transakcyjnego maila wybierany w `/ci-cd`; lokalnie Mailpit | jedyny mail w aplikacji (F-03) | — | F-03 |
| Pozostałe wymagania z BRD | offline: brak (F-15); push: brak; pliki: brak; płatności: brak; wyszukiwanie: brak | poza zakresem MVP (BRD §11) | — | — |

## Propozycje do potwierdzenia przy zatwierdzeniu

Domyślne wybory techniczne niższego rzędu, wynikające z decyzji powyżej. Obowiązują dopiero po akceptacji w kroku 8.

| Obszar | Propozycja | Powód |
| --- | --- | --- |
| Walidacja | zod w `packages/shared`, te same schematy w api, web i mobile | jedna definicja reguł (długości, limity) |
| Kontrakt API | typy żądań i odpowiedzi + schematy zod w `packages/shared` (bez OpenAPI) | jeden autor, klienci w tym samym monorepo |
| Pobieranie danych | TanStack Query w web i mobile | cache, odświeżenie po powrocie połączenia (F-15) |
| Routing | React Router (web), expo-router (mobile) | standard w danym ekosystemie |
| Tokeny | Style Dictionary generuje `tokens.css` (web) i `tokens.ts` (mobile) z `docs/design/tokens.json` | obsługuje format W3C design tokens |
| Przechowywanie sesji mobile | `expo-secure-store` (przez plugin Expo Better Auth) | Keychain / Keystore |

## Narzędzia uruchomieniowe (T-001, 2026-10-26)

| Obszar | Wybór | Powód | Alternatywa |
| --- | --- | --- | --- |
| Sterownik PostgreSQL | `pg` (node-postgres) przez `drizzle-orm/node-postgres` | pula z `idleTimeoutMillis` ≤ 60 s (koszt Neon, `deployment.md`) | postgres.js |
| Uruchamianie API w dev | `tsx watch` | TypeScript bez kroku kompilacji, hot reload | natywne type stripping Node |
| Build API | `esbuild` (bundle do `apps/api/dist/server.js`, pakiety workspace wbudowane, zależności npm zewnętrzne) | obraz bez TypeScriptu w runtime; esbuild już jest w Vite | tsc + project references |
| Dev api + web razem | `pnpm --parallel` (bez dodatkowych paczek) | jedna komenda `pnpm dev` | concurrently |
| Raport pokrycia (T-002) | `@vitest/coverage-v8` (`pnpm test:coverage`, artefakt CI bez progu) | oficjalny provider Vitesta | `@vitest/coverage-istanbul` |
| Uwierzytelnianie (T-004) | `better-auth` 1.7.13 (adapter Drizzle, rate limit w bazie, telemetria wyłączona) | ADR 0002 | — |
| Limit tras Fastify (T-004) | `@fastify/rate-limit` (licznik w pamięci, tylko `GET /health/ready`; jedna instancja, ADR 0003) | rate limit Better Auth obejmuje tylko `/api/auth/*` | własny licznik w hooku |
| Routing web (T-004) | `react-router` 8 (`createBrowserRouter`, w testach `createMemoryRouter`) | zatwierdzona propozycja „Routing” | — |

## Git workflow

- Variant: epic branch with draft PR
- Main branch: main (protected, PR only, required check ci-ok, no force push)
- Branch names: epic/E-xx-<slug>; fix/T-NNN-<slug>; hotfix/T-NNN-<slug>
- Temporary CI verification branches: ci-test/T-NNN-<case> (e.g. ci-test/T-002-broken-test), branched from the epic branch; their test PRs target the epic branch, not main, and are closed without merge, branch deleted after the run (owner decision 2026-10-27)
- Merge method: merge commit
- Preview environment per PR: brak (`deployment.md`) → security review i UAT na staging przed akceptacją produkcji
- Who merges and approves production: Tomasz Brążkiewicz (właściciel projektu)

Powód: jeden epik MVP, jeden autor, produkt jeszcze niedostępny dla użytkowników; żaden warunek wariantu z flagami nie zachodzi.

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-10-27 | `/implement-task T-004`: `better-auth`, `@fastify/rate-limit`, `react-router` (zatwierdził właściciel). |
| 2026-10-27 | `/implement-task T-002`: gałęzie tymczasowe `ci-test/T-NNN-<przypadek>` do weryfikacji CI (decyzja właściciela); `@vitest/coverage-v8` (raport pokrycia jako artefakt CI, zatwierdził właściciel). |
| 2026-10-26 | `/implement-task T-001`: narzędzia uruchomieniowe (pg, tsx, esbuild, `pnpm --parallel`). |
| 2026-10-26 | `/ci-cd`: hosting (ADR 0006), brak podglądów per PR, dystrybucja iOS w pilotażu tylko przez web (ADR 0008 — zawęża „Dystrybucja mobile”). |
