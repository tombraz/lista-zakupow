---
id: T-004
title: Rejestracja, logowanie i wylogowanie (web)
epic: E-01
story: S-01-02
status: in-qa          # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-001]
size: M                # S | M (L must be split)
layers: [db, backend, web]
requirements: [F-01, F-02, N-02, N-04, N-05]
threats: [TH-09, TH-11, TH-13, TH-14, TH-16, TH-17, TH-21]
screens: [SC-01, SC-02, SC-04, SC-09]
---

# T-004 Rejestracja, logowanie i wylogowanie (web)

## Goal

Domownik zakłada konto (imię, e-mail, hasło, zgody, 16+), loguje się i wylogowuje w przeglądarce. Sesja żyje w ciasteczku `HttpOnly` w bazie (Better Auth), trasy aplikacji wymagają zalogowania, a próby logowania i rejestracji są ograniczane.

## Demo

1. Na SC-01 „Załóż konto” → SC-02: wysłanie pustego formularza pokazuje podsumowanie „Popraw N pól” i błędy przy polach; poprawne dane → konto założone, przejście do „Moje listy” (ekran-szkielet z AppBar; treść list w T-005).
2. Ikona „Konto” → SC-09 z e-mailem i imieniem; „Wyloguj się” → SC-01; wejście na adres „Moje listy” przekierowuje na SC-01, a po zalogowaniu wraca tam.
3. Złe hasło → „Nieprawidłowy e-mail lub hasło.” (ten sam komunikat dla nieistniejącego e-maila); kilka kolejnych prób → „Zbyt wiele prób logowania…”.
4. Link „Regulamin i polityka prywatności” na SC-01 i SC-02 otwiera SC-04 bez logowania.

## Context

- BRD: F-01 — „imię 1–30, hasło ≥ 8, akceptacja regulaminu i polityki prywatności, potwierdzenie 16+; e-mail użyty — czytelny komunikat”; F-02 — „komunikat nie zdradza, czy konto istnieje; próby ograniczane (MC-04)”; MC-05 — masowe zakładanie kont ograniczane.
- Architektura: „Uwierzytelnianie i autoryzacja”, ADR 0002 (Better Auth, sesje w Postgresie, 30 dni), `api.md` „Konta”, `data-model.md` (`user` z `terms_accepted_at`, `terms_version`, `age_confirmed_at`).
- Design: SC-01, SC-02, SC-04, SC-09 (tylko e-mail, imię jako tekst, „Wyloguj się”, link do SC-04 — zmiana imienia i usunięcie konta w E-02); komponenty TextField, PasswordField, ConsentCheckbox, Button, InlineAlert, AppBar.
- Depends on: T-001 — harness integracyjny, migracje, logger z redakcją i logiem `security`, web serwowany pod jednym originem.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given osoba bez konta, when wyśle poprawne imię, e-mail, hasło, `termsAccepted` i `ageConfirmed`, then powstaje konto ze znacznikami zgód i wersją dokumentów, odpowiedź ustawia ciasteczko sesji `HttpOnly`, `SameSite=Lax` (`Secure` poza lokalnym HTTP), a `GET /api/v1/me` zwraca `{ id, name, email }`. — verified by: test integracyjny `sign-up.test`
- [x] AC2: Given istniejące konto z e-mailem `a@x.pl`, when ktoś rejestruje `A@x.pl`, then 409 `email_taken`; SC-02 pokazuje komunikat pod polem e-mail z linkami do logowania i resetu. — verified by: test integracyjny + test komponentu SC-02
- [x] AC3: Given brak którejkolwiek zgody, hasło 7 znaków, imię puste lub 31 znaków, when ktoś się rejestruje, then 400 `validation_failed` z `fields`, konto nie powstaje; SC-02 pokazuje wszystkie błędy naraz, podsumowanie „Popraw N pól” z fokusem i powiązanie `aria-describedby`. — verified by: testy integracyjne (każdy przypadek) + test komponentu SC-02
- [x] AC4: Given istniejące konto, when domownik zaloguje się poprawnie, then dostaje sesję i trafia na „Moje listy” albo na adres, z którego przyszedł. — verified by: test integracyjny `sign-in.test` + E2E J-01
- [x] AC5: Given zalogowany domownik, when kliknie „Wyloguj się” na SC-09, then sesja jest usunięta z bazy, `GET /api/v1/me` ze starym ciasteczkiem zwraca 401, a web pokazuje SC-01. — verified by: test integracyjny `sign-out.test` + E2E J-01
- [x] AC6: Given niezalogowany, when otworzy adres chronionego ekranu, then trafia na SC-01; SC-01–SC-04 są dostępne bez logowania; zalogowany na SC-01 / SC-02 jest przekierowany na „Moje listy”. — verified by: test komponentu routera + E2E
- [x] AC7: Given ekrany SC-01, SC-02 (pusty, błędy walidacji, e-mail zajęty), SC-04 i SC-09, when E2E je odwiedza, then skan axe nie znajduje naruszeń; po błędzie logowania fokus jest na komunikacie (`role="alert"`), pole hasła wyczyszczone, e-mail zostaje; fokus startowy SC-01 na „E-mail”, SC-02 na „Imię”. — verified by: E2E Playwright + axe, test komponentu
- [x] AC8: Given SC-04, when ktoś go otworzy, then widzi spis treści i oba dokumenty z co najmniej: zakres danych (imię, e-mail, treść list), kto je widzi, brak zewnętrznej analityki, usunięcie konta, kopie 7 dni. — verified by: test komponentu (nagłówki `h2`) + akceptacja treści przez właściciela w QA
- [x] SEC1 (TH-09): Given limit prób logowania per IP, when z jednego IP przyjdzie o jedną próbę więcej niż próg, then 429 `rate_limited`; given limit per konto, when z różnych IP przyjdzie zbyt wiele nieudanych prób na ten sam e-mail, then 429 także dla poprawnego hasła do czasu wygaśnięcia okna; SC-01 pokazuje komunikat o limicie. — verified by: testy integracyjne `sign-in-rate-limit.test` (zegar wstrzyknięty)
- [x] SEC2 (TH-11): Given nieistniejący e-mail i istniejący e-mail ze złym hasłem, when ktoś się loguje, then status i treść odpowiedzi są identyczne (401 `invalid_credentials`). — verified by: test integracyjny porównujący odpowiedzi
- [x] SEC3 (TH-13): Given limit rejestracji per IP, when z jednego IP przyjdzie zbyt wiele rejestracji, then 429; treść > 16 kB → 413. — verified by: test integracyjny
- [x] SEC4 (TH-14): Given żądanie rejestracji, logowania lub wylogowania z nagłówkiem `Origin` spoza zaufanych, when trafi do API, then jest odrzucone (403) i nie powstaje ani nie znika sesja. — verified by: test integracyjny `origin.test`
- [x] SEC5 (TH-16): Given zalogowany domownik w przeglądarce, when sprawdzę `localStorage`, `sessionStorage` i dostęp `document.cookie`, then nie ma w nich tokenu sesji (ciasteczko niedostępne dla JS). — verified by: E2E Playwright (asercja na storage i `document.cookie`)
- [x] SEC6 (TH-17): Given nowa sesja, when sprawdzę jej `expires_at`, then to 30 dni od użycia, przedłużane przy użyciu; po wylogowaniu stara sesja nie działa (AC5). — verified by: test integracyjny ze wstrzykniętym zegarem
- [x] SEC8 (CodeQL `js/missing-rate-limiting`): Given `GET /health/ready` (odpytuje bazę), when z jednego IP przyjdzie o jedno żądanie więcej niż próg, then 429 `rate_limited`; `GET /health` (healthcheck Fly, bez bazy) nie jest limitowany; alert CodeQL dla `apps/api/src/modules/health/http/routes.ts` zamknięty po merge'u. — verified by: test integracyjny `health-rate-limit.test` + check „CodeQL” zielony na PR epiku
- [x] SEC7 (TH-21): Given nieudane logowanie i przekroczenie limitu, when sprawdzę logi, then w logu `security` jest zdarzenie z identyfikatorem (bez e-maila i hasła), a żaden wpis nie zawiera hasła ani ciasteczka. — verified by: test integracyjny z przechwyconym strumieniem logów

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API: `/api/auth/*` (Better Auth) i `GET /api/v1/me` przez `fastify.inject`
- ekrany SC-01, SC-02, SC-09 z API podstawionym przez MSW
- przeglądarka (Playwright) dla J-01

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | schemat rejestracji (zod, `packages/shared`): imię, e-mail, hasło, zgody | unit | Vitest | AC3 |
| 2 | rejestracja poprawna: konto, zgody, ciasteczko, `/me` | integration | Vitest + Testcontainers | AC1 |
| 3 | rejestracja: e-mail zajęty (inna wielkość liter) | integration | Vitest + Testcontainers | AC2 |
| 4 | rejestracja: każdy błąd walidacji = 400, brak konta | integration | Vitest + Testcontainers | AC3 |
| 5 | logowanie poprawne i identyczna odpowiedź dla złych danych | integration | Vitest + Testcontainers | AC4, SEC2 |
| 6 | wylogowanie: sesja usunięta, `/me` 401 | integration | Vitest + Testcontainers | AC5 |
| 7 | wygasanie sesji 30 dni (zegar) | integration | Vitest + Testcontainers | SEC6 |
| 8 | limity: logowanie per IP, per konto; rejestracja per IP; 413 | integration | Vitest + Testcontainers | SEC1, SEC3 |
| 9 | limit `GET /health/ready` per IP (429 po progu), `GET /health` bez limitu | integration | Vitest + Testcontainers | SEC8 |
| 10 | obcy `Origin` odrzucony | integration | Vitest | SEC4 |
| 11 | log `security` i brak danych osobowych w logach | integration | Vitest | SEC7 |
| 12 | SC-02: walidacja wszystkich pól, podsumowanie, e-mail zajęty | component | Vitest + RTL + MSW | AC2, AC3 |
| 13 | SC-01: błąd logowania (fokus, czyszczenie hasła), limit, przekierowanie po zalogowaniu | component | Vitest + RTL + MSW | AC4, AC7 |
| 14 | router: chronione trasy → SC-01, powrót po zalogowaniu | component | Vitest + RTL + MSW | AC6 |
| 15 | SC-04: spis treści i sekcje | component | Vitest + RTL | AC8 |
| 16 | E2E J-01: rejestracja → listy → konto → wyloguj → logowanie; storage bez tokenu; axe na każdym stanie | E2E | Playwright + axe | AC4–AC7, SEC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web (z T-001)

**Mocks:** zegar (wygasanie sesji, okna limitów); API tylko w testach komponentów. Better Auth i baza prawdziwe.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** e-mail z wielkimi literami i spacjami na brzegach; imię z polskimi znakami i emoji, dokładnie 30 znaków; hasło dokładnie 8 znaków i bardzo długie; wklejanie hasła i menedżer haseł; podwójne kliknięcie „Załóż konto”; logowanie na dwóch urządzeniach jednocześnie (oba działają).
- **Design states:** SC-01: pusty, ładowanie, błąd, limit, walidacja, sieć; SC-02: pusty, ładowanie, walidacja, e-mail zajęty, limit, sieć; SC-09 (część z tego taska).
- **Platforms / devices:** Chrome i Firefox na komputerze, Safari i Chrome na telefonie; 320 px i 200 %.
- **Accessibility:** cała ścieżka samą klawiaturą; czytnik ekranu (NVDA lub VoiceOver) ogłasza błędy i podsumowanie; etykiety widoczne; checkboxy zgód klikalne całą etykietą, ≥ 48 px.
- **Security / privacy:** TH-09 / TH-11 — porównać odpowiedzi i czasy dla istniejącego i nieistniejącego e-maila; TH-14 — żądanie z innego originu (np. `curl -H "Origin: https://evil.example"`); ciasteczko w DevTools ma `HttpOnly`, `SameSite=Lax`; logi bez e-maili i haseł.
- **Regression:** strona startowa i nagłówki z T-001.

## Implementation notes

- Nazwy tras i opcji Better Auth sprawdzić w dokumentacji przypiętej wersji (przewodnik backend, „Pułapki”).
- Zgody i 16+ weryfikowane w hooku rejestracji Better Auth; `terms_version` jako stała w `packages/shared`.
- Progi limitów (proponowane: logowanie 10/min per IP, 5 nieudanych w 15 min per konto, rejestracja 5/h per IP) ustalić w tasku i zapisać w jednym miejscu (`packages/shared` lub konfiguracja API); Better Auth `rateLimit` przechowywany w bazie.
- Z T-002 (decyzja właściciela 2026-10-27): CodeQL zgłosił alert high `js/missing-rate-limiting` dla `/health/ready` (kod T-001). Limit dla tej trasy dodać razem z limitami MC-04. Better Auth `rateLimit` obejmuje tylko trasy `/api/auth/*`, więc limit dla tras Fastify wymaga osobnego mechanizmu (np. `@fastify/rate-limit` — nowa zależność, zapytać właściciela, Step 4). Próg ustalić tak, by smoke test (`scripts/smoke.sh`, jedno wywołanie) i ręczne sprawdzenia mieściły się z zapasem (propozycja: 30/min per IP).
- Fabryki `createUser()` i `signIn(user)` w `apps/api/test/factories.ts` — używane przez wszystkie kolejne taski.
- Funkcja `requireUser()` modułu `konta` dla tras `/api/v1/*`.
- Treść SC-04: szkic agenta z wymaganymi punktami; ostateczną treść akceptuje właściciel (pytanie do użytkownika, jeśli treść nie jest dostarczona).
- Mapowanie kodów błędów API na polskie komunikaty w jednym miejscu klienta web.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg z 2026-10-27 (Windows, Docker): `pnpm check` (Prettier, ESLint `--max-warnings 0`, typecheck, jscpd 0 klonów, dependency-cruiser 0 naruszeń, design-check 0 błędów, backlog-check, Vitest **87/87**), `pnpm build` OK, `pnpm test:e2e` **8/8** (telefon + komputer).

Decyzje właściciela (2026-10-27, Step 4): zależności `better-auth` 1.7.13, `@fastify/rate-limit`, `react-router` 8; progi limitów jak w propozycji (`packages/shared/src/limits.ts`); treść SC-04 — szkic agenta do akceptacji w QA.

### TDD — red → green

| # | Test (plik) | Red: komunikat przed implementacją | Teraz |
| --- | --- | --- | --- |
| 1 | `packages/shared/test/account.test.ts` (8) | `expected {} to deeply equal { name: 'required', …(4) }` (stub schematu) | pass |
| 1a | „counts emoji as one character each” — dopisany w pętli (QA: imię z emoji) | przeszedł od razu: zod 4 liczy punkty kodowe jak `char_length`; zostaje jako zabezpieczenie | pass |
| 2 | `apps/api/test/sign-up.test.ts` AC1 (4) | `expected 501 to be 200` (stub trasy) | pass |
| 2a | TH-16 „never exposes the session token” | sprawdzony odwrotnie: przy przepuszczeniu całej odpowiedzi Better Auth `expected '{"token":"eeve…' not to contain 'eeve…'` | pass |
| 3 | sign-up AC2 `409 email_taken` (inna wielkość liter) | mapowanie powstało w kroku 2; bez niego `expected 422 to be 409` | pass |
| 4 | sign-up AC3 — 5 przypadków `400 validation_failed`, brak konta | bez walidacji: `expected 200 to be 400` (×5) | pass |
| 5 | `sign-in.test.ts` AC4, SEC2, pusty formularz (3) | `expected 404 to be 200/401/400` | pass |
| 6 | `sign-out.test.ts` AC5 (2) | `expected 404 to be 200` | pass |
| 7 | `session-expiry.test.ts` SEC6 (3) | konfiguracja powstała w kroku 2; bez niej `expected 1794218400000 to be 1796205600000` (7 zamiast 30 dni) | pass |
| 8 | `sign-in-rate-limit.test.ts` SEC1 (6), `sign-up-rate-limit.test.ts` SEC3 (2) | `expected 401 to be 429`, `expected 200 to be 429` (×3); 413 przechodził już (limit treści z T-001) | pass |
| 8a | dopisane: klient nie obchodzi limitu własnym `X-Forwarded-For`; za zaufanym proxy liczy się adres klienta | drugi: `[…401, 429]` zamiast 11× 401 | pass |
| 9 | `health-rate-limit.test.ts` SEC8 (2) | `expected 200 to be 429` | pass |
| 10 | `origin.test.ts` SEC4 (3) | przechodził od razu (Better Auth sprawdza `Origin` przy każdym żądaniu z tym nagłówkiem); bez `disableOriginCheck: false` (Better Auth pomija sprawdzanie w testach) `expected 200 to be 403` ×3 | pass |
| 11 | `security-log.test.ts` SEC7 | `expected [] to have a length of 5 but got +0`; przy logerze Better Auth na `info`: `…not to contain 'tajny.adres@example.com'` | pass |
| 12 | `SC-02-rejestracja/SignUpScreen.test.tsx` (7) | `Unable to find role="heading" and name "Załóż konto"` | pass |
| 13 | `SC-01-logowanie/SignInScreen.test.tsx` (6) | `Unable to find role="heading" and name "Zaloguj się"` | pass |
| 14 | `src/routes.test.tsx` (10) | `Unable to find role="heading" and name "Zaloguj się" / "Moje listy"` (8 z 10) | pass |
| 15 | `SC-04-regulamin/TermsScreen.test.tsx` (4) | `Unable to find role="heading" and name "Regulamin i polityka prywatności"` | pass |
| 16 | `e2e/j01-konto.spec.ts` (2×2), `e2e/start.spec.ts` (2×2) | E2E po zachowaniu na szybszych seamach; SEC5 sprawdzony odwrotnie: ciasteczko bez `HttpOnly` → `Expected: true, Received: false` | pass |

### Kryteria akceptacji

- **AC1** — `sign-up.test.ts`: konto ze znacznikami `terms_accepted_at`, `age_confirmed_at`, `terms_version = TERMS_VERSION`; `Set-Cookie` z `HttpOnly`, `SameSite=Lax`, bez `Secure` na `http://`, z `Secure` przy originie `https://`; `/api/v1/me` → `{ id, name, email }`. Komponent: `SignUpScreen.test` „sends trimmed data… opens Moje listy”.
- **AC2** — `sign-up.test.ts` „409 email_taken… different letter case”; `SignUpScreen.test` „explains under the e-mail field…” (linki „Zaloguj się” → `/logowanie`, „zresetuj hasło” → `/reset-hasla`); E2E drugi test.
- **AC3** — integracja: 5 przypadków (brak zgody regulaminu, brak 16+, hasło 7 znaków, puste imię, 31 znaków) = 400 z `fields`, 0 kont; komponent: wszystkie błędy naraz, „Popraw 5 pól” z fokusem, `aria-describedby` (sprawdzane przez `toHaveAccessibleDescription`), linki z podsumowania do pól, poprawna odmiana („2 pola”, „1 pole”).
- **AC4** — `sign-in.test.ts` (sesja; e-mail wielkimi literami działa); `SignInScreen.test` „opens Moje listy”, „returns to the address the person came from”; `routes.test` „brings the person back…”; E2E J-01.
- **AC5** — `sign-out.test.ts`: wiersz `session` usunięty, stare ciasteczko → 401 `unauthenticated`; E2E: „Wyloguj się” → SC-01, `/listy` → SC-01.
- **AC6** — `routes.test.tsx`: `/listy`, `/konto`, `/`, nieznany adres → SC-01; `/logowanie`, `/rejestracja`, `/regulamin` publiczne; zalogowany na SC-01 / SC-02 → `/listy`; E2E `/listy` → `/logowanie`.
- **AC7** — E2E axe (WCAG 2.2 AA, 0 naruszeń) na: SC-01 pusty, SC-02 pusty, SC-02 błędy walidacji, SC-09, SC-01 po błędzie logowania, SC-02 e-mail zajęty, SC-04 — w obu widokach (390 × 844, 1280 × 800); fokus startowy SC-01 „E-mail”, SC-02 „Imię”; po błędzie logowania fokus na `role="alert"`, hasło puste, e-mail zostaje (komponent + E2E).
- **AC8** — `TermsScreen.test`: spis treści (`nav` „Spis treści”) z linkami do `#regulamin` i `#polityka-prywatnosci`, dwa `h2`, `h3` „Jakie dane zbieramy”, „Kto widzi Twoje dane”, „Bez zewnętrznej analityki”, „Usunięcie konta”, „Kopie zapasowe”; fokus przenoszony do sekcji; „Wróć”. **Treść (`apps/web/src/screens/SC-04-regulamin/documents.tsx`) to szkic — do akceptacji właściciela w QA** (bez danych kontaktowych administratora; do uzupełnienia przez właściciela).
- **SEC1** — `sign-in-rate-limit.test.ts`: 11. próba z IP → 429 `rate_limited`, inne IP dalej 401; 5 nieudanych z różnych IP → 429 także dla poprawnego hasła, bez ciasteczka; licznik niezależny od wielkości liter i spacji; po 15 min znów 200. SC-01 pokazuje komunikat limitu (`SignInScreen.test`).
- **SEC2** — `sign-in.test.ts`: identyczny status i treść (`401 {"error":{"code":"invalid_credentials"}}`) dla nieznanego e-maila i złego hasła, w obu brak `Set-Cookie`. Better Auth liczy hash także dla nieznanego konta.
- **SEC3** — `sign-up-rate-limit.test.ts`: 6. rejestracja z IP → 429, powstało 5 kont; treść > 16 kB → 413.
- **SEC4** — `origin.test.ts`: `Origin: https://evil.example` → 403 `invalid_origin` dla rejestracji (0 kont), logowania (0 nowych sesji), wylogowania (sesja zostaje).
- **SEC5** — E2E J-01: ciasteczko `httpOnly: true`, `sameSite: Lax`; `document.cookie` bez `session_token`; `localStorage` i `sessionStorage` puste; treść odpowiedzi rejestracji/logowania bez tokenu (`sign-up.test`, TH-16).
- **SEC6** — `session-expiry.test.ts` (zegar `vi.useFakeTimers({ toFake: ["Date"] })`): `expires_at` = start + 30 dni; użycie po 2 dniach → start + 32 dni; po 30 dniach bez użycia → 401; po wylogowaniu stara sesja nie działa (AC5).
- **SEC7** — `security-log.test.ts`: 5 × `sign_in_failed` i 1 × `rate_limited` w kanale `security` z `accountKey` (HMAC e-maila) i `requestId`; w całym strumieniu logów brak e-maila, hasła i wartości ciasteczka. Better Auth loguje tylko błędy (na `info` wypisuje e-mail przy zajętym adresie).
- **SEC8** — `health-rate-limit.test.ts`: 31. `GET /health/ready` z IP → 429 `rate_limited`, inne IP 200; 40 × `GET /health` → 200. **Do sprawdzenia w QA:** check „CodeQL” na PR epiku (alert `js/missing-rate-limiting` dla `modules/health/http/routes.ts`) — rozstrzygnie się po pushu.

### Decyzje i odstępstwa (do przejrzenia w QA)

- Most `/api/auth/*` udostępnia tylko trzy trasy (rejestracja, logowanie, wylogowanie); reszta Better Auth (np. `update-user` bez naszej walidacji imienia) zwraca 404. Reset hasła doda E-02.
- Adres klienta dla limitów per IP: most nadpisuje `X-Forwarded-For` adresem z Fastify (`request.ip`), więc klient nie obejdzie limitu własnym nagłówkiem. Za proxy: `TRUSTED_PROXIES` (adresy/CIDR; Fastify 5.12 nie ufa samej liczbie hopów). **Wartość dla Fly trzeba ustawić przy wdrożeniu**, inaczej wszyscy dzielą limit adresu proxy (`deployment.md`).
- Nowe zmienne: `BETTER_AUTH_SECRET` (wymagany), `APP_ORIGIN`, `TRUSTED_PROXIES` (`.env.example`, `deployment.md`). `db:migrate` czyta tylko `DATABASE_URL` (job CI „migrations” nie ma sekretu) — sprawdzone uruchomieniem bez sekretu: błąd połączenia, nie konfiguracji.
- Przekierowanie po zalogowaniu/rejestracji robi strażnik `PublicOnly` (jedno miejsce; formularz tylko ustawia sesję); powrót tylko na ścieżki aplikacji (odrzuca `//host`).
- SC-01 bez linku „Nie pamiętasz hasła?” (SC-03 to E-02). SC-02 ma link „zresetuj hasło” → `/reset-hasla`, bo wymaga go AC2; do E-02 ta ścieżka prowadzi anonima na SC-01.
- Ekran startowy szkieletu (T-001, stan API) usunięty — `/` prowadzi na „Moje listy” / SC-01. Test E2E T-001 (`start.spec.ts`) zmieniony: SPA pod `/` i dowolną ścieżką pokazuje SC-01 (`lang="pl"`, axe).
- Zmiany istniejących testów: `database.test.ts` przypinał „dokładnie 1 migracja” → „co najmniej 1” (zastosowane = w dzienniku zostaje); testy T-001 budują aplikację przez `buildTestApp` (wymagana opcja `auth`), asercje bez zmian.
- `eslint.config.js`: progi rozmiaru funkcji i plików nie obejmują już `*.test.{ts,tsx}` — zgodnie z `CODING_STANDARDS.md` („kod źródłowy (bez testów)”); wcześniej konfiguracja obejmowała testy w `src/`.
- Komunikat „Hasło może mieć najwyżej 128 znaków” (limit Better Auth) i błąd wylogowania (tekst braku sieci) nie są w tabelach „Copy” — teksty agenta.
- Licznik znaków imienia (od 24/30) jest `aria-hidden`; błąd długości ogłasza się przez `aria-describedby`.
- Wygasłe wiersze `sign_in_failure` nie są jeszcze sprzątane (sprzątanie dzienne z `data-model.md` nie ma taska w E-01).

### Zrzuty

Telefon 390 px (lokalnie, poza repo): SC-01, SC-02 z błędami walidacji, SC-05 szkielet, SC-09, SC-04 — jedna kolumna, nic nie obcięte; obejrzane przy implementacji.

### Przewodniki warstw (Step 8b)

Uzupełnione „Gdzie jest kod” i „Komendy” w `layers/backend.md`, `layers/db.md`, `layers/web.md` (fakty). Propozycji zmian „Konwencji” brak.

<!-- QA rounds are appended below by /qa-task -->
