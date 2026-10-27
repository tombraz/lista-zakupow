---
layer: backend
status: approved          # draft | approved
approved: 2026-10-26
---

# Przewodnik warstwy: backend

## Cel

API: konta i sesje, reguły biznesowe, uprawnienia, zmiany na żywo, wysyłka maila resetu. Moduły `konta`, `listy`, `pozycje`, `zaproszenia`, `na-zywo`, `statystyki` (`../architecture.md`) oraz pakiet `packages/shared` (schematy zod, kontrakt API i zdarzeń, kody błędów, `normalizeItemName`).

## Technologia

Node.js LTS, TypeScript strict, Fastify, `@fastify/websocket`, `@fastify/helmet`, `@fastify/rate-limit`, Better Auth (ADR 0002), Drizzle, zod, pino (`../tech-stack.md`).

## Gdzie jest kod

- `apps/api/src/app.ts` — `buildApp()`: Fastify, limit treści 16 kB, obsługa błędów puli, nagłówki, trasy, web
- `apps/api/src/server.ts` — start procesu (konfiguracja, pula, `listen`); `src/config.ts` — zmienne środowiskowe (zod)
- `apps/api/src/logging.ts` — pino: redakcja, `requestId`, `securityLog()`
- `apps/api/src/http/` — `security-headers.ts` (helmet, CSP), `web-app.ts` (pliki web + fallback SPA, 404 `not_found`)
- `apps/api/src/modules/<moduł>/{domain,http,infra}` + `index.ts`; teraz `modules/health` (z limitem `/health/ready`) i `modules/konta` (`index.ts` — publiczne API modułu: `accountRoutes()` zwraca `Accounts.requireUser` dla tras `/api/v1/*` innych modułów; `infra/auth.ts` — konfiguracja Better Auth, `infra/sign-in-failures.ts` — limit per konto, `http/auth-routes.ts` — most `/api/auth/*`, `http/require-user.ts` (przekazuje odnowione ciasteczko sesji), `http/cookies.ts`, `http/me-routes.ts`)
- `apps/api/src/http/api-error.ts` — `ApiError` z kodem z `packages/shared` i jedyny handler błędów
- `apps/api/test/` — testy integracyjne (`*.test.ts`), harness bazy, `fixtures/`, `app.ts` (`buildTestApp`), `factories.ts` (`createUser`, `signIn`, `randomIp`), `cookies.ts`
- `packages/shared/src/` — schematy zod i typy kontraktu (`health.ts`, `api/account.ts`, `api/errors.ts`), progi limitów `limits.ts`; testy w `packages/shared/test/`

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| install | `pnpm install` (Node 24 LTS, pnpm 12; generuje też tokeny) | korzeń repo |
| uruchom lokalnie | `pnpm services:up`, potem `pnpm dev` (API `http://127.0.0.1:3000` + web `http://localhost:5173`) | korzeń repo |
| type check / lint | `pnpm typecheck` / `pnpm lint` | korzeń repo |
| testy jednego pliku | `pnpm vitest run apps/api/test/health.test.ts` | korzeń repo |
| wszystkie testy warstwy | `pnpm vitest run --project api --project shared` | korzeń repo |
| build | `pnpm --filter @lista/api build` (`apps/api/dist/server.js`); start `pnpm start` | korzeń repo |

Wymaga `DATABASE_URL` i `BETTER_AUTH_SECRET` (≥ 32 znaki) w `.env` (skopiuj `.env.example`; lokalnie `postgres://lista:lista@localhost:5442/lista`) albo w zmiennych środowiskowych; `APP_ORIGIN` wymagany (lokalnie `http://localhost:5173`, Vite).

## Testy w tej warstwie

- **Seam:** HTTP przez `fastify.inject` i WebSocket przez prawdziwego klienta `ws`; logika czysta przez funkcje modułu `domain`.
- **Narzędzia:** Vitest, Testcontainers (PostgreSQL), Mailpit lub przechwytujący adapter maili.
- **Dane testowe:** fabryki (`createUser`, `signIn`, `createList`, `addMember`, `createItem`, `createInvitation`).
- **Mocki dozwolone dla:** dostawcy maili, zegara, generatora tokenów. Nie dla własnych modułów ani bazy.
- Każda nowa trasa z danymi listy: testy 401 (anonim), 404 (inny domownik), 403 (uczestnik przy akcji właściciela).

## Zasady bezpieczeństwa

- Każda trasa listy zaczyna od `requireListAccess(userId, listId, rola)`; żadnych własnych warunków `owner_id === …` w trasach (TH-01, TH-02).
- Brak dostępu = 404 `not_found`, identyczny jak dla nieistniejącej listy (TH-01).
- Każda zmiana członkostwa (usunięcie, opuszczenie, usunięcie listy lub konta) wywołuje `live.revoke` w tej samej operacji (TH-04); wylogowanie wywołuje `live.closeSession` (TH-17).
- Zdarzenia na żywo publikowane dopiero po zatwierdzeniu transakcji (inaczej klient zobaczy zmianę, która się wycofała).
- Każda trasa i wiadomość WS ma schemat zod; `bodyLimit` 16 kB (TH-13, TH-20).
- Sprawdzenie `Origin` dla żądań zmieniających stan i upgrade WS (TH-14); token sesji nigdy z query stringu (TH-16).
- API serwuje też zbudowany web (`@fastify/static` z `apps/web/dist`, fallback na `index.html` dla ścieżek spoza `/api`, `/health`) pod jednym originem; `@fastify/helmet` (CSP, HSTS, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`) dla wszystkich odpowiedzi; CORS wyłączony (ADR 0006).
- Logger z redakcją `authorization`, `cookie`, `password`, `token`, ścieżek `/invitations/:token`; zdarzenia bezpieczeństwa w logu `security` z samymi identyfikatorami (TH-08, TH-21).
- Kryptografia i hasła wyłącznie przez Better Auth; tokeny zaproszeń z `crypto.randomBytes(32)` (TH-06, TH-09).

## Konwencje

- Moduł `domain` nie importuje Fastify, Drizzle ani `ws`; zależy od interfejsów repozytoriów i `LiveHub`, które sam definiuje (sprawdza dependency-cruiser).
- Trasa: walidacja → `requireListAccess` → funkcja domenowa → mapowanie na odpowiedź. Bez logiki biznesowej w trasie.
- Błędy domenowe jako typowane wyjątki z `code` z `packages/shared`; jeden handler Fastify mapuje je na HTTP wg tabeli w `architecture.md`.
- Limity i długości tylko ze stałych w `packages/shared` (jedno miejsce wiedzy).
- Nazwy funkcji i typów z słownika BRD (po angielsku w kodzie: `ShoppingList`, `Item`, `Invitation`, `Participant`).

## Pułapki

- Nazwy tras i opcji Better Auth zmieniają się między wersjami (np. `forgetPassword` → `requestPasswordReset`); sprawdzić w dokumentacji przypiętej wersji.
- Konta zakłada się wyłącznie przez most HTTP `POST /api/auth/sign-up/email` (`http/auth-routes.ts`), który waliduje zgody i 16+ schematem z `packages/shared`. Hook `databaseHooks.user.create.before` w `infra/auth.ts` stempluje znaczniki zgód bezwarunkowo, bo nie widzi pól `termsAccepted` / `ageConfirmed` (nie są polami Better Auth). Dlatego nie wołać `auth.api.signUpEmail` z kodu serwera (seed, skrypty, testy) — konto dostałoby zgody, których nikt nie udzielił; w testach używać fabryki `createUser`. (Odstępstwo od notatki T-004 „zgody weryfikowane w hooku”, QA T-004 runda 1.)
- Better Auth zwraca przy kolizji unikalności e-maila (równoczesne rejestracje) ogólne `422 FAILED_TO_CREATE_USER`; most zamienia je na `409 email_taken`, gdy konto z tym e-mailem już istnieje. Inne nieznane statusy Better Auth → `500 internal`.

## Skille i źródła

- Dokumentacja Fastify, `@fastify/websocket`, Better Auth (email-password, Expo plugin, rate limit, hooks), Drizzle.
- `postgres-best-practices:supabase-postgres-best-practices` przy zapytaniach z blokadami i transakcjami.

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-10-27 | T-004: moduł `konta`, `ApiError`, fabryki testowe, nowe zmienne środowiskowe. |
| 2026-10-26 | `/ci-cd`: API serwuje web pod jednym originem, nagłówki i CORS (ADR 0006). |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
| 2026-10-27 | T-004 (QA round 1): `Accounts.requireUser` w publicznym API modułu `konta`, `APP_ORIGIN` wymagany, „Pułapki”: konta tylko przez most, kolizja e-maila w Better Auth. |
