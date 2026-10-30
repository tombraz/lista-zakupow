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
- `apps/api/src/logging.ts` — pino: redakcja, `requestId`, `securityLog()`; serializer `req` z `redactedUrl()` (`/api/v1/invitations/[redacted]…`, TH-08)
- `apps/api/src/http/` — `security-headers.ts` (helmet, CSP), `web-app.ts` (pliki web + fallback SPA, 404 `not_found`), `rate-limit.ts` (`perIpRateLimit(scope)` + `perIp(key)` (klucz z `RATE_LIMITS`) — jedyne miejsce `@fastify/rate-limit` (eslint); 429 `rate_limited` i zdarzenie `rate_limited` w logu `security` z trasą, bez IP; T-027)
- `apps/api/src/modules/<moduł>/{domain,http,infra}` + `index.ts`; teraz `modules/health` (z limitem `/health/ready`) i `modules/konta` (`index.ts` — publiczne API modułu: `accountRoutes()` zwraca `Accounts.requireUser` dla tras `/api/v1/*` innych modułów; `infra/auth.ts` — konfiguracja Better Auth, `infra/sign-in-failures.ts` — limit per konto, `http/auth-routes.ts` — most `/api/auth/*`, `http/require-user.ts` (przekazuje odnowione ciasteczko sesji), `http/cookies.ts`, `http/me-routes.ts`)
- `apps/api/src/http/api-error.ts` — `ApiError` (błędy HTTP: 400, 401, 403 `invalid_origin`) i jedyny handler błędów; mapuje też `DomainError` na status (`not_found` 404, `owner_only` 403, `limit_reached` 409) i zapisuje jego zdarzenie do logu `security`; każdy inny wyjątek (poza błędami klienta Fastify < 500, np. 413) → `500 {"error":{"code":"internal","requestId":…}}`, a do logu tylko typ, kod i ramki stosu
- `apps/api/src/domain-error.ts` — `DomainError` (kod z `packages/shared`, `limit`, zdarzenie bezpieczeństwa) rzucany przez domeny modułów
- `apps/api/src/http/validate.ts` — treść żądania przez schemat zod (400 `validation_failed` z `fields`); `http/trusted-origin.ts` — 403 `invalid_origin` dla `POST`/`PATCH`/`DELETE` pod `/api/v1/*` z obcego `Origin` (TH-14)
- `apps/api/src/modules/listy` — `index.ts` (`listsModule()` rejestruje trasy, zwraca `Lists.requireListAccess` dla kolejnych modułów; `createLists(pool)`), `domain/lists.ts` (`requireListAccess`, tworzenie z limitem, zmiana nazwy, usunięcie, interfejs `ListsRepository`), `infra/lists-repository.ts`, `http/routes.ts` (`/api/v1/lists*`)
- `apps/api/src/modules/pozycje` — `index.ts` (`itemsModule()` rejestruje trasy `/api/v1/lists/:listId/items*`; `createItems(pool)` daje `Items.itemsOf` — pozycje w kształcie API dla `GET /api/v1/lists/:listId`), `domain/items.ts` (`addItem` z limitem 500 i idempotentnym `id`, `updateItem`, `deleteItem`, interfejs `ItemsRepository`), `infra/items-repository.ts`, `http/routes.ts`, `http/item-response.ts` (`Item` z API: osoby tylko `{ id, name }`, TH-19)
- Zależność `listy` ↔ `pozycje`: `pozycje` zależy od `Lists.requireListAccess`, a szczegóły listy pokazują pozycje. Żeby nie było cyklu, domena `listy` definiuje interfejs `ListItems`, a `app.ts` podaje implementację z `createItems`. Odstępstwo od „moduł posiada swoje tabele”: `pozycje/infra` blokuje wiersz `shopping_list` (`FOR UPDATE` dla limitu 500, jak każe `data-model.md`; od T-008 przez `lockList` z `listy`) i ustawia jego `updated_at`, bo musi to zrobić w tej samej transakcji co zmiana pozycji (T-006)
- `apps/api/src/modules/pozycje` (T-007) — `domain/items.ts` także `changeItem` (`PATCH`: edycja i / lub `checked`), `checkItem`, `clearChecked`; `infra/items-repository.ts` — `check` (odhaczenie tylko nieodhaczonej + `statystyki.recordCheck` w tej samej transakcji), `deleteChecked`, `toBuyCounts`; `Items.toBuyCounts` daje `toBuyCount` dla `listy` (przez `ListItems`, konstruktor `DrizzleListsRepository`; `createLists(pool, items)`)
- `apps/api/src/modules/zaproszenia` (T-008) — `index.ts` (`invitationsModule()`: trasy i obsługa rejestracji z `invitationToken` przez `Accounts.acceptInvitationsOnSignUp`), `domain/token.ts` (`invitationToken(random)` — 32 bajty base64url), `domain/invitations.ts` (tworzenie z limitem 20 uczestników i limitem tworzenia, unieważnianie, podgląd, przyjęcie; interfejsy `InvitationsRepository`, `InvitedLists`), `infra/invitations-repository.ts`, `infra/random.ts` (`crypto.randomBytes`), `http/routes.ts` (trasy właściciela + trasy z tokenem w zakresie z `perIpRateLimit`), `http/sign-up.ts` (`acceptOnSignUp` — błąd zaproszenia w treści odpowiedzi rejestracji)
- `listy` dla `zaproszenia`: `Lists.invitationTarget`, `Lists.participantCount`, `Lists.join(tx, listId, userId)` (`own_list`, `already_member`, `limit_reached` → wycofanie transakcji wołającego), `lockList`
- `apps/api/src/modules/statystyki` — `index.ts` (`recordCheck(transakcja, { listId, userId, at })`), `domain/activity.ts` (`activityDay` — dzień w strefie `Europe/Warsaw`), `infra/activity-repository.ts`
- `apps/api/src/modules/na-zywo` (T-009) — `index.ts` (`createLiveHub()` — hub tworzony w `app.ts` przed modułami, które publikują; `liveModule()` — trasa WS; typ `Live`: `publish`, `notify`, `revoke`, `closeSession`), `domain/hub.ts` (`LiveHub`: kanały `list:<id>` / `user:<id>` w pamięci, limit połączeń na sesję), `domain/message-budget.ts` (wiadomości na sekundę), `infra/ws-connection.ts` (`WsConnection`, `heartbeat`: ping co 25 s, bez pong 10 s → `terminate`), `http/routes.ts` (`GET /api/v1/live`: `Origin` = `APP_ORIGIN` (403), sesja z ciasteczka (401), `maxPayload` 4 kB, `closeTimeout` 2 s, `SocketsPerSession`: gniazda sesji do zamknięcia TCP, także zamykane, ponad 10 → `terminate`, zdarzenie limitu z `subject` = sesja (okno `LimitLogWindow` w `logLimitEvent`), `subscribe` przez `requireListAccess`). Sesję (`Accounts.requireSession`) i dostęp do listy podaje `app.ts` (bez importu `konta` / `listy` w `na-zywo`: brak cyklu). Publikują po zatwierdzeniu: `listy/http/routes.ts` (zmiana nazwy, usunięcie + `revoke` wszystkich z dostępem), `pozycje/http/item-events.ts`, `zaproszenia/http/invitation-events.ts` (`acceptAndAnnounce` — trasa i rejestracja z linku), unieważnienie linku; wylogowanie: `konta/http/auth-routes.ts` → `closeSession`. `Lists.peopleWithAccess` + `everyone()` — adresaci `lists.changed`
- `apps/api/src/clock.ts` — `Clock`, `systemClock`; `AppOptions.clock` (testy: `test/clock.ts`, `testClock(start)` z `set(at)`)
- `apps/api/src/ids.ts` — `isUuid()` dla identyfikatorów z adresu (`listId`, `itemId`): inny tekst = 404 bez zapytania do bazy
- `apps/api/test/` — testy integracyjne (`*.test.ts`), harness bazy, `fixtures/`, `app.ts` (`buildTestApp`), `factories.ts` (`createUser`, `signIn`, `randomIp`, `createList(pool, owner, name?)`, `addMember(pool, list, user)` i `createItem(pool, list, by | null, name?)`, `createInvitation(pool, list, createdAt?)` — wprost w bazie), `invitations.ts` (`tokenOf(invitation)`), `requests.ts` (`requestsAs(app, user | null)` — żądania `/api/v1/*` z ciasteczkiem i zaufanym `Origin`), `live.ts` (`liveUrl(app)` — API na losowym porcie, `upgradeStatus`, `connectLive` — klient `ws` z kolejką wiadomości, `next(type)`, `expectSilence`, `closed`; `pause` — czas rzeczywisty przy `vi.useFakeTimers`), `logs.ts` (`captureLogs()`), `cookies.ts`
- `packages/shared/src/` — schematy zod i typy kontraktu (`health.ts`, `api/account.ts`, `api/errors.ts`, `api/lists.ts`, `api/items.ts` z `normalizeItemName`, `api/person.ts`, `api/invitations.ts` (`Invitation`, `InvitationPreview`, `SignUpResponse`), `api/text.ts` — `requiredName(max)` i `withoutNul` dla nazw list i pozycji), progi `limits.ts` (`RATE_LIMITS`, `BUSINESS_LIMITS`, `INVITATION_VALIDITY_DAYS`, `LIVE_LIMITS`), `api/live.ts` (wiadomości WS: `parseClientMessage`, `ListEvent`, `UserEvent`, `LiveServerMessage`); testy w `packages/shared/test/`

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
- Nieznany wyjątek nie może dojść do domyślnego handlera Fastify — wysyła on klientowi `message` (np. SQL z parametrami z `DrizzleQueryError`, wartość pola z błędu pg). Dlatego `apiErrors` sam odpowiada `500 internal` i loguje `summarize(error)` zamiast `err`; nie logować surowego wyjątku z bazy. Wejście, którego baza nie przyjmie (NUL w tekście), odrzuca schemat w `packages/shared` (QA T-005 runda 1).
- Każde pole tekstowe z żądania, które trafia do bazy, przechodzi przez `requiredName(max)` albo `.refine(withoutNul, { error: "invalid" })` z `packages/shared/src/api/text.ts`; nie przepisywać tej reguły ręcznie (`trim().min().max()` bez `withoutNul`). Imię przy rejestracji miało własną kopię bez `withoutNul` i NUL dawał 500 zamiast 400 (T-026).
- Każde przekroczenie limitu (`RATE_LIMITS`, `BUSINESS_LIMITS`, `LIVE_LIMITS`) zapisuje zdarzenie w logu `security` (`limit_reached` albo `rate_limited`) z `limit` i identyfikatorami osoby (`userId`) i listy, nie tylko odpowiada 429 / 409 / zamyka gniazdo. Kształt zdarzenia buduje wyłącznie `logLimitEvent` (`src/logging.ts`): `limit` to klucz stałej (`LimitKey`, np. `listsPerOwner`), nie nazwa z odpowiedzi API (`LimitName`, `lists`), a `route` jest zawsze (`UNKNOWN_ROUTE` dla nieznanej trasy). Wołają go: handler błędów dla `DomainError` z `security: { event, limit, ids }`, `perIp(key)` (`http/rate-limit.ts`, limit trasy per IP tylko przez niego), most Better Auth i `limitLog` (WS). Ręczne `warn({ event: "limit_reached" | "rate_limited" })` i `config.rateLimit` trasy blokuje eslint (T-035; kształt składany w pięciu miejscach rozjechał się: brak `limit`, nieodróżnialne limity logowania, brak `route`). Test limitu sprawdza też wpis w logu (`captureLogs()`), nie tylko status. `ApiError(429)` i zamknięcie gniazda z pominięciem tych ścieżek nie zostawiały śladu (T-027, T-033). Nowy limit nadużyć ma wartość w stałych w `packages/shared/src/limits.ts` (`RATE_LIMITS`, `BUSINESS_LIMITS`, `LIVE_LIMITS`, `HTTP_LIMITS`), nie w module, i scenariusz w tabeli `apps/api/test/limits.security.test.ts` — test pokrycia pada dla klucza bez scenariusza. Limit treści 16 kB był stałą w `app.ts` i nie logował 413 (T-034). Zdarzenie limitu zapisuje się raz na podmiot i limit w oknie `limitLogWindowSeconds` (`LimitLogWindow` w `logLimitEvent`), nie raz na żądanie / połączenie: podmiot to identyfikatory zdarzenia, bez nich adres IP (tylko w pamięci), a gdy limit liczy coś innego niż identyfikatory w zdarzeniu — jawne `subject` (`signInPerIp`: IP, nie konto; WS: sesja, nie osoba). Tabela `limits.security.test.ts` przekracza każdy limit `OVER` razy i oczekuje jednego wpisu. Każda odpowiedź 429 / 409 ponad limit zapisywała linię `security`, więc zalew z jednego IP rósł liniowo z liczbą żądań (T-038 dla WS, T-040 dla HTTP).
- Każde zdarzenie w logu `security` (nie tylko limity: także `sign_in_failed`, `list_access_denied`) składa jedna funkcja w `src/logging.ts`, na której opiera się `logLimitEvent`; `route` to wzorzec trasy (`routeOptions.url ?? UNKNOWN_ROUTE`), nigdy surowy `request.url`. Zdarzenia spoza limitów składano ręcznie w dwóch miejscach i każde inaczej liczyło `route` (przegląd E-01 runda 3, S19/C18; T-041).
- Każda trasa, która zmienia zawartość SC-05 (lista dochodzi lub znika, nazwa, licznik do kupienia, uczestnicy), po udanym zapisie wysyła `lists.changed` do wszystkich osób z dostępem — także do autora, bo SC-05 może być otwarte w jego innej karcie lub na innym urządzeniu. Test w `apps/api/test/live.lists.test.ts` z drugim połączeniem autora. Tworzenie listy nie wysyłało zdarzenia, bo zdarzenia traktowano jako powiadamianie innych osób (T-032).
- Biblioteka `ws` emituje `close` gniazda serwera dopiero po zamknięciu TCP (FIN klienta, najpóźniej po `closeTimeout`: domyślnie 30 s, u nas `LIVE_LIMITS.closeTimeoutSeconds`), a nie po wymianie ramek close. Klient może uznać połączenie za zamknięte i połączyć się ponownie wcześniej. Decyzje o stanie połączenia (limit `connectionsPerSession`, liczniki) opierać na `LiveConnection.open` (`readyState === OPEN`), nie na tym, czy padło już `detach`. Wyścigi zamykania testować deterministycznie przez `closeWithoutFin` (`test/live.ts`), nie przez powtarzanie testu. Limit liczył połączenia zamykane i odrzucał szybkie ponowne połączenie kodem 1008 (T-036). Limit zasobów na sesję liczy gniazda do `close` (`socketsPerSession`), nie tylko otwarte połączenia — zamykane i odrzucone 1008 też trzymają TCP; ponad limit `terminate`, nie `close` (T-037).

## Skille i źródła

- Dokumentacja Fastify, `@fastify/websocket`, Better Auth (email-password, Expo plugin, rate limit, hooks), Drizzle.
- `postgres-best-practices:supabase-postgres-best-practices` przy zapytaniach z blokadami i transakcjami.

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-10-30 | Przegląd E-01 runda 3: „Pułapki”: każde zdarzenie `security` przez jedną funkcję w `logging.ts`; opis `perIp(key)`. |
| 2026-10-30 | T-040: `LimitLogWindow` przeniesione z `na-zywo` do `src/logging.ts` (dekoracja `limitLogWindow` w `app.ts`), deduplikacja w `logLimitEvent` dla wszystkich limitów, opcja `subject`; „Pułapki”: zdarzenie raz na podmiot i limit w oknie. |
| 2026-10-30 | T-038: `LimitLogWindow` w `na-zywo/http/routes.ts` (zalew logu `security` próbami WS ponad limit), `LIVE_LIMITS.limitLogWindowSeconds`. |
| 2026-10-30 | T-037: `socketsPerSession` (`SocketsPerSession` w `http/routes.ts`), `closeTimeout` 2 s; „Pułapki”: limit liczy gniazda do zamknięcia TCP. |
| 2026-10-30 | T-036: `LiveConnection.open`, `closeWithoutFin` w `test/live.ts`; „Pułapki”: `close` w `ws` dopiero po TCP. |
| 2026-10-30 | T-035: `logLimitEvent`, `LimitKey`, `perIp(key)`; „Pułapki”: jeden kształt zdarzenia limitu, reguła eslint. |
| 2026-10-30 | T-034: „Pułapki”: nowy limit w stałych `packages/shared` i w tabeli `limits.security.test.ts`; `HTTP_LIMITS.bodyBytes`. |
| 2026-10-30 | T-033: „Pułapki”: każde przekroczenie limitu w logu `security`, test sprawdza wpis; `limitLog` dla WS. |
| 2026-10-30 | T-027: helper `http/rate-limit.ts` (limit per IP z logiem `security`), reguła eslint na `@fastify/rate-limit`. |
| 2026-10-30 | T-032: „Pułapki”: `lists.changed` także do autora zmiany SC-05, test z jego drugim połączeniem. |
| 2026-10-30 | T-026: imię przez `requiredName`; „Pułapki”: tekst do bazy tylko przez `requiredName` / `withoutNul`. |
| 2026-10-28 | T-008: moduł `zaproszenia`, `Lists.join` / `lockList`, redakcja tokenu w logu żądań, fabryka `createInvitation`. |
| 2026-10-28 | T-007: moduł `statystyki`, `Clock`, odhaczanie i usuwanie kupionych w `pozycje`, `toBuyCounts`. |
| 2026-10-28 | T-006: moduł `pozycje`, `ListItems` w `listy`, `ids.ts`, kod `duplicate_item` (409), fabryka `createItem`. |
| 2026-10-28 | T-005 (QA round 1): handler nieoczekiwanych błędów (`500 internal` z `requestId`), „Pułapki”: domyślny handler Fastify. |
| 2026-10-28 | T-005: moduł `listy`, `DomainError`, `validate`, `trustedOrigin`, helpery testów `requestsAs`, `captureLogs`, fabryki `createList`, `addMember`. |
| 2026-10-27 | T-004: moduł `konta`, `ApiError`, fabryki testowe, nowe zmienne środowiskowe. |
| 2026-10-26 | `/ci-cd`: API serwuje web pod jednym originem, nagłówki i CORS (ADR 0006). |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
| 2026-10-27 | T-004 (QA round 1): `Accounts.requireUser` w publicznym API modułu `konta`, `APP_ORIGIN` wymagany, „Pułapki”: konta tylko przez most, kolizja e-maila w Better Auth. |
