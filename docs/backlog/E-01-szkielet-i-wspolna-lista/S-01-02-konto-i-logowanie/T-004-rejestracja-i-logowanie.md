---
id: T-004
title: Rejestracja, logowanie i wylogowanie (web)
epic: E-01
story: S-01-02
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given osoba bez konta, when wyśle poprawne imię, e-mail, hasło, `termsAccepted` i `ageConfirmed`, then powstaje konto ze znacznikami zgód i wersją dokumentów, odpowiedź ustawia ciasteczko sesji `HttpOnly`, `SameSite=Lax` (`Secure` poza lokalnym HTTP), a `GET /api/v1/me` zwraca `{ id, name, email }`. — verified by: test integracyjny `sign-up.test`
- [ ] AC2: Given istniejące konto z e-mailem `a@x.pl`, when ktoś rejestruje `A@x.pl`, then 409 `email_taken`; SC-02 pokazuje komunikat pod polem e-mail z linkami do logowania i resetu. — verified by: test integracyjny + test komponentu SC-02
- [ ] AC3: Given brak którejkolwiek zgody, hasło 7 znaków, imię puste lub 31 znaków, when ktoś się rejestruje, then 400 `validation_failed` z `fields`, konto nie powstaje; SC-02 pokazuje wszystkie błędy naraz, podsumowanie „Popraw N pól” z fokusem i powiązanie `aria-describedby`. — verified by: testy integracyjne (każdy przypadek) + test komponentu SC-02
- [ ] AC4: Given istniejące konto, when domownik zaloguje się poprawnie, then dostaje sesję i trafia na „Moje listy” albo na adres, z którego przyszedł. — verified by: test integracyjny `sign-in.test` + E2E J-01
- [ ] AC5: Given zalogowany domownik, when kliknie „Wyloguj się” na SC-09, then sesja jest usunięta z bazy, `GET /api/v1/me` ze starym ciasteczkiem zwraca 401, a web pokazuje SC-01. — verified by: test integracyjny `sign-out.test` + E2E J-01
- [ ] AC6: Given niezalogowany, when otworzy adres chronionego ekranu, then trafia na SC-01; SC-01–SC-04 są dostępne bez logowania; zalogowany na SC-01 / SC-02 jest przekierowany na „Moje listy”. — verified by: test komponentu routera + E2E
- [ ] AC7: Given ekrany SC-01, SC-02 (pusty, błędy walidacji, e-mail zajęty), SC-04 i SC-09, when E2E je odwiedza, then skan axe nie znajduje naruszeń; po błędzie logowania fokus jest na komunikacie (`role="alert"`), pole hasła wyczyszczone, e-mail zostaje; fokus startowy SC-01 na „E-mail”, SC-02 na „Imię”. — verified by: E2E Playwright + axe, test komponentu
- [ ] AC8: Given SC-04, when ktoś go otworzy, then widzi spis treści i oba dokumenty z co najmniej: zakres danych (imię, e-mail, treść list), kto je widzi, brak zewnętrznej analityki, usunięcie konta, kopie 7 dni. — verified by: test komponentu (nagłówki `h2`) + akceptacja treści przez właściciela w QA
- [ ] SEC1 (TH-09): Given limit prób logowania per IP, when z jednego IP przyjdzie o jedną próbę więcej niż próg, then 429 `rate_limited`; given limit per konto, when z różnych IP przyjdzie zbyt wiele nieudanych prób na ten sam e-mail, then 429 także dla poprawnego hasła do czasu wygaśnięcia okna; SC-01 pokazuje komunikat o limicie. — verified by: testy integracyjne `sign-in-rate-limit.test` (zegar wstrzyknięty)
- [ ] SEC2 (TH-11): Given nieistniejący e-mail i istniejący e-mail ze złym hasłem, when ktoś się loguje, then status i treść odpowiedzi są identyczne (401 `invalid_credentials`). — verified by: test integracyjny porównujący odpowiedzi
- [ ] SEC3 (TH-13): Given limit rejestracji per IP, when z jednego IP przyjdzie zbyt wiele rejestracji, then 429; treść > 16 kB → 413. — verified by: test integracyjny
- [ ] SEC4 (TH-14): Given żądanie rejestracji, logowania lub wylogowania z nagłówkiem `Origin` spoza zaufanych, when trafi do API, then jest odrzucone (403) i nie powstaje ani nie znika sesja. — verified by: test integracyjny `origin.test`
- [ ] SEC5 (TH-16): Given zalogowany domownik w przeglądarce, when sprawdzę `localStorage`, `sessionStorage` i dostęp `document.cookie`, then nie ma w nich tokenu sesji (ciasteczko niedostępne dla JS). — verified by: E2E Playwright (asercja na storage i `document.cookie`)
- [ ] SEC6 (TH-17): Given nowa sesja, when sprawdzę jej `expires_at`, then to 30 dni od użycia, przedłużane przy użyciu; po wylogowaniu stara sesja nie działa (AC5). — verified by: test integracyjny ze wstrzykniętym zegarem
- [ ] SEC8 (CodeQL `js/missing-rate-limiting`): Given `GET /health/ready` (odpytuje bazę), when z jednego IP przyjdzie o jedno żądanie więcej niż próg, then 429 `rate_limited`; `GET /health` (healthcheck Fly, bez bazy) nie jest limitowany; alert CodeQL dla `apps/api/src/modules/health/http/routes.ts` zamknięty po merge'u. — verified by: test integracyjny `health-rate-limit.test` + check „CodeQL” zielony na PR epiku
- [ ] SEC7 (TH-21): Given nieudane logowanie i przekroczenie limitu, when sprawdzę logi, then w logu `security` jest zdarzenie z identyfikatorem (bez e-maila i hasła), a żaden wpis nie zawiera hasła ani ciasteczka. — verified by: test integracyjny z przechwyconym strumieniem logów

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
