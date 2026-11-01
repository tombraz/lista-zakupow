---
id: T-053
title: "Prośba o link resetu: mail z linkiem (lokalnie, Mailpit)"
epic: E-02
story: S-02-01
status: in-qa          # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-03, N-02, N-04]
threats: [TH-10, TH-11, TH-21, TH-27]
screens: [SC-03, SC-01, SC-02]
---

# T-053 Prośba o link resetu: mail z linkiem (lokalnie, Mailpit)

## Goal

Domownik wchodzi z SC-01 na SC-03 (krok 1), podaje e-mail i dostaje mail z linkiem resetu ważnym 1 godzinę; komunikat jest taki sam dla istniejącego i nieistniejącego konta, a prośby są ograniczane. Lokalnie mail widać w Mailpit.

## Demo

1. SC-01: wpisz e-mail, kliknij „Nie pamiętasz hasła?” → SC-03 „Reset hasła” z tym e-mailem w polu.
2. „Wyślij link” → „Jeśli konto z adresem {e-mail} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę.”; fokus zostaje na przycisku.
3. Mailpit (`http://localhost:8025`): mail „Reset hasła — Wspólna lista zakupów” z treścią z SC-03 i linkiem do `/reset-hasla?token=…` (strona kroku 2 — T-054).
4. To samo dla nieistniejącego e-maila: ten sam komunikat, w Mailpit nic.
5. Kilka próśb pod rząd → „Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.”

## Context

- BRD: F-03 — „ten sam komunikat niezależnie od tego, czy konto istnieje; link jednorazowy, ważny 1 godzinę; to jedyny mail wysyłany przez aplikację; prośby są ograniczane (MC-04)”.
- Architektura: `api.md` „Konta” (`POST /api/auth/request-password-reset` `{ email, redirectTo }` → 200 zawsze, 429), most Better Auth w `modules/konta/http/auth-routes.ts` (walidacja schematami z `packages/shared`, tłumaczenie błędów, obcy `Origin` 403), `RATE_LIMITS` w `packages/shared`, `testing-strategy.md` („dostawca maili: lokalnie Mailpit, w testach przechwytujący adapter”), `epic.md` E-02 „Technology” (interfejs `Mailer`, implementacje przez `fetch`: Mailpit lokalnie, Brevo — T-055).
- Design: SC-03 krok 1 — stany Empty (e-mail z SC-01), Loading, Success — krok 1, Error — limit, Error — sieć; Copy `mail.subject`, `mail.body`; SC-01 link do SC-03; SC-02 komunikat o zajętym e-mailu z linkiem „zresetuj hasło”.
- Depends on: — (E-01 zostawił Better Auth, most `auth-routes`, `EntryLink` z kontekstem zaproszenia i Mailpit w `docker-compose.yml`).

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given konto z e-mailem X, when `POST /api/auth/request-password-reset { email: X }`, then 200 i `Mailer` dostaje jeden mail do X z tematem i treścią z SC-03 Copy oraz linkiem `https://<APP_ORIGIN>/reset-hasla?token=<token>`; token ważny 1 h (Better Auth `verification`). — verified by: test integracyjny z przechwytującym adapterem
- [x] AC2: Given lokalny `pnpm dev` z Docker Compose, when proszę o reset, then mail jest w Mailpit (adapter HTTP send API Mailpita). — verified by: test adaptera na prawdziwym Mailpit (Testcontainers) + ręcznie w Demo
- [x] AC3: Given SC-01 z wpisanym e-mailem (i ewentualnie kontekstem zaproszenia), when wchodzę na SC-03 linkiem „Nie pamiętasz hasła?” albo z komunikatu o zajętym e-mailu na SC-02, then pole e-mail jest wypełnione, a „Wróć do logowania” wraca na SC-01 z tym samym e-mailem i kontekstem zaproszenia (WCAG 3.3.7, jak `EntryLink`, T-028). — verified by: testy komponentów SC-01, SC-02, SC-03
- [x] AC4: Given SC-03 krok 1, when „Wyślij link”, then przycisk w stanie Loading (fokus zostaje, T-015), po odpowiedzi komunikat sukcesu z `role="status"`, fokus na przycisku; pole i przycisk zostają do ponownego wysłania. Given błąd sieci, then „Brak połączenia. Sprawdź internet i spróbuj ponownie.”; given 429, then „Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.” (`role="alert"`). — verified by: test komponentu SC-03 (MSW)
- [x] AC5: Given SC-03 krok 1 w każdym stanie (pusty, sukces, limit, sieć), when E2E go odwiedza, then axe bez naruszeń; podwójne kliknięcie „Wyślij link” wysyła jedno żądanie (T-020). — verified by: E2E Playwright + axe, test komponentu
- [x] SEC1 (TH-11): Given istniejący i nieistniejący e-mail, when proszę o reset, then status, treść odpowiedzi i nagłówki (poza `date`, `x-request-id`) są identyczne, a odpowiedź nie czeka na wysyłkę maila (wysyłka po odpowiedzi albo w tle, więc czas nie zdradza istnienia konta); dla nieistniejącego nie powstaje wiersz `verification`. — verified by: test integracyjny porównujący odpowiedzi + test z adapterem opóźnionym o 2 s
- [x] SEC2 (TH-10): Given 3 prośby o reset dla jednego e-maila w 15 min (próg zatwierdzony przez właściciela 2026-11-01, zapisany w `RATE_LIMITS`) albo przekroczony limit per IP, when przychodzi kolejna, then 429 `rate_limited` i mail nie wychodzi; limit per e-mail nie zdradza istnienia konta (działa tak samo dla nieistniejącego). — verified by: test integracyjny 429 dla IP i dla e-maila
- [x] SEC3 (TH-27): Given przekroczony limit (IP lub e-mail), when przychodzą kolejne prośby z nowymi e-mailami, then liczba wierszy w tabelach pisanych przed uwierzytelnieniem (`verification`, licznik limitu per e-mail) się nie zmienia. — verified by: test integracyjny liczby wierszy
- [x] SEC4 (TH-21): Given prośba o reset, when API loguje żądanie, wysyłkę i zdarzenie limitu, then logi nie zawierają e-maila, tokenu ani treści maila; przekroczenie limitu zostawia zdarzenie `rate_limited` w logu `security` w schemacie z T-035 (`limit`, `route`). — verified by: test logów (`captureLogs`) + rozszerzenie `limits.security.test.ts`
- [x] SEC5 (TH-14): Given obcy `Origin`, when `POST /api/auth/request-password-reset`, then 403 `invalid_origin`; `redirectTo` spoza `APP_ORIGIN` jest odrzucany albo ignorowany (link w mailu zawsze na `APP_ORIGIN`). — verified by: test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `POST /api/auth/request-password-reset` przez `fastify.inject`, z przechwytującym `Mailer`
- adapter Mailpit przez jego HTTP send API (kontener Mailpit w Testcontainers)
- ekrany SC-03 (krok 1), SC-01, SC-02 z API podstawionym przez MSW
- przeglądarka (Playwright) dla stanów SC-03 krok 1

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | prośba dla istniejącego konta wysyła jeden mail z linkiem na `APP_ORIGIN` i tokenem ważnym 1 h (zegar) | integration | Vitest + Testcontainers | AC1 |
| 2 | identyczne odpowiedzi dla istniejącego i nieistniejącego e-maila; wolny `Mailer` nie wydłuża odpowiedzi | integration | Vitest + Testcontainers | SEC1 |
| 3 | 429 per IP i per e-mail, mail nie wychodzi; brak nowych wierszy po limicie | integration | Vitest + Testcontainers | SEC2, SEC3 |
| 4 | logi bez e-maila i tokenu; zdarzenie limitu w logu `security` | integration | Vitest | SEC4 |
| 5 | obcy `Origin` 403; obcy `redirectTo` nie trafia do maila | integration | Vitest + Testcontainers | SEC5 |
| 6 | adapter Mailpit dostarcza mail (API Mailpita zwraca go w skrzynce) | integration | Vitest + Testcontainers (Mailpit) | AC2 |
| 7 | SC-03 krok 1: wstępny e-mail, Loading, sukces (`status`, fokus), limit, sieć, jedno żądanie przy podwójnym kliknięciu | component | Vitest + RTL + MSW | AC4, AC5 |
| 8 | SC-01 / SC-02: link do SC-03 przenosi e-mail i kontekst zaproszenia; powrót zachowuje oba | component | Vitest + RTL + MSW | AC3 |
| 9 | E2E: SC-01 → SC-03 → sukces; stany limitu i sieci; axe | E2E | Playwright + axe | AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** `Mailer` (adapter przechwytujący) w testach API; zegar (1 h). Baza i Mailpit prawdziwe w swoich testach. API tylko w testach komponentów.

**Client state during writes:** prośba o reset — odpowiedź opóźniona (użytkownik zmienia e-mail w trakcie: komunikat sukcesu pokazuje e-mail, dla którego wysłano prośbę), odpowiedź utracona po zapisie (ponowne „Wyślij link” to nowa prośba, liczona do limitu — zachowanie świadome), limit wygasa po czasie (komunikat 429 znika przy kolejnej udanej prośbie).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** e-mail z wielkimi literami i spacjami (ta sama skrzynka); e-mail usuniętego konta; dwa linki pod rząd (oba ważne do użycia pierwszego? — zachowanie Better Auth zapisać w Evidence); prośba z otwartym kontekstem zaproszenia.
- **Design states:** SC-03 krok 1: pusty, wypełniony z SC-01, Loading, sukces, limit, sieć.
- **Platforms / devices:** komputer (Chrome, Firefox), telefon (Safari iOS, Chrome Android), 320 px, 200 %.
- **Accessibility:** klawiatura (Enter wysyła), czytnik ekranu ogłasza sukces i błąd, fokus nie ucieka po wysłaniu; menedżer haseł nie myli pola e-mail.
- **Security / privacy:** TH-11 — porównaj odpowiedzi i czasy dla istniejącego i nieistniejącego konta; TH-10 — zalej skrzynkę z jednego IP i z wielu e-maili; logi bez e-maila i tokenu; nagłówki maila (link na `APP_ORIGIN` mimo podmienionego `redirectTo` / `Host`).
- **Regression:** J-01 (logowanie, rejestracja, zajęty e-mail z zaproszeniem — T-028), limity logowania (T-048).

## Implementation notes

- Better Auth: `emailAndPassword.sendResetPassword` + `resetPasswordTokenExpiresIn: 3600`. Most w `auth-routes` udostępnia tylko trasy z `api.md`; dochodzi `request-password-reset` (reszta `/api/auth/*` dalej 404). Link w mailu budujemy sami z `APP_ORIGIN` i tokenu (nie z `Host` żądania).
- `Mailer` to granica systemu: interfejs w module `konta` (lub osobnym module), implementacje Mailpit (lokalnie) i przechwytująca (testy); Brevo — T-055. Wybór implementacji z konfiguracji (`config.test.ts`: brak konfiguracji maila na produkcji = błąd startu).
- Limit per e-mail bez zdradzania istnienia konta: klucz jak `sign_in_failure` (HMAC znormalizowanego e-maila), limit per IP przed pierwszym zapisem (TH-27, wzorem T-048).
- Copy SC-03 w `messages.ts` ekranu; treść maila w API (jedyny tekst po polsku generowany przez API — zapisz to w przewodniku backend).
- Krok 2 (`/reset-hasla?token=`) — T-054; do tego czasu trasa z tokenem może pokazywać krok 1.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg 2026-11-01 (`/implement-task T-053`, tryb autonomiczny).

### Testy z planu (czerwony → zielony)

| # | Plik / test | Czerwony (przed kodem) | Teraz |
| --- | --- | --- | --- |
| 1 | `apps/api/test/password-reset.test.ts` › „sends one mail with a link to APP_ORIGIN and a token valid for one hour” | `expected 404 to be 200` (trasy nie było) | zielony |
| 2 | ten sam plik › „answers identically for an existing and an unknown e-mail, without waiting for the mail (SEC1)” | przeszedł od razu (wysyłka w tle była już w kodzie z testu 1); sprawdzenie, że gryzie: `sendResetPassword` czekający 2 s → `expected 2029.33 to be less than 1000`; przywrócone | zielony |
| 3 | `apps/api/test/password-reset-rate-limit.test.ts` (6 testów) | `expected undefined to deeply equal { windowSeconds: 900, max: 3 }`, `expected 200 to be 429`, `expected [200,200,200,200] to deeply equal [200,200,200,429]`, `… to have a length of 3 but got 10`; test limitu IP przechodził na domyślnym limicie Better Auth — po dodaniu licznika e-maila sprawdzone, że gryzie: bez `perIp("passwordResetPerIp")` → `expected { verification: 0, rate_limit: 11 } to deeply equal { …, rate_limit: 5 }` (TH-27); przywrócone | zielony |
| 4 | `apps/api/test/password-reset.logs.test.ts` + scenariusze `passwordResetPerIp`, `passwordResetPerEmail` w `limits.security.test.ts` | `expected '{"level":30,…' not to contain 'resetc4f2212a'` (błąd dostawcy z adresem trafiał do logu); `no security-log scenario for limit passwordResetPerIp` / `…PerEmail` | zielony |
| 5 | `password-reset.test.ts` › „refuses a foreign or missing Origin with 403 before writing anything”, „ignores a foreign redirectTo and a forged Host…” | pierwszy: `expected { …status: 200 } to deeply equal { …status: 403 }`; drugi przeszedł od razu (link budowany z `APP_ORIGIN`) — sprawdzone, że gryzie: link z innym originem → `expected 'Ktoś poprosił…' to contain 'http://localhost:5173/reset-hasla?tok…'`; przywrócone | zielony |
| 6 | `apps/api/test/mailpit-mailer.test.ts` (Mailpit w Testcontainers) | `Error: not implemented` (zaślepka), `expected Error… to be an instance of MailDeliveryError` | zielony |
| 6a | `apps/api/test/config.test.ts` › „refuses to start without a mail provider”, „takes the Mailpit address from MAILPIT_URL” (dopisane do planu: wybór implementacji z konfiguracji) | `expected [Function] to throw an error`, `expected undefined to be 'http://localhost:8025'` | zielony |
| 7 | `apps/web/src/screens/SC-03-reset-hasla/PasswordResetScreen.test.tsx` (5 testów: Empty z e-mailem z SC-01, Loading + sukces `role="status"` + fokus, limit i sieć, podwójne kliknięcie, puste pole) | `Unable to find role="heading" and name "Reset hasła"` / `Unable to find a label with the text of: E-mail` (zaślepka ekranu) | zielony |
| 8 | `apps/web/src/screens/SC-03-reset-hasla/PasswordResetScreen.entry.test.tsx` (SC-01 → SC-03 → SC-01; SC-02 „zresetuj hasło” → SC-03 → SC-01) | `Unable to find … role "link" and name "Nie pamiętasz hasła?"`; SC-02: `expect(element).toHaveValue(tomek@example.com)` (zwykły `Link` gubił e-mail) | zielony |
| 8a | `apps/web/src/routeFocus.test.tsx` › „lists every route of routes.tsx” | `expected [ '*', '/konto', … (6) ] to deeply equal [ … (7) ]` po dodaniu trasy; wpis `/reset-hasla` w `ROUTES` | zielony |
| 9 | `apps/web/e2e/j01-reset-hasla.spec.ts` (telefon, komputer): SC-01 → SC-03 z e-mailem, podwójne kliknięcie = 1 żądanie, sukces, limit, brak sieci; axe w każdym stanie | pierwsze uruchomienie: `toHaveText` nie uwzględniał ikony „✓” w alercie (test poprawiony na `toContainText`) | zielony |

### Kryteria akceptacji

- **AC1:** test 1 — 200, jeden mail do X, temat i treść dosłownie z SC-03 Copy, link `http://localhost:5173/reset-hasla?token=<token>` (origin testowy), wiersz `verification` `reset-password:<token>` z `expires_at` = teraz + 1 h (`vi.useFakeTimers({ toFake: ["Date"] })`). `resetPasswordTokenExpiresIn: PASSWORD_RESET_VALIDITY_SECONDS` (3600).
- **AC2:** test 6 (adapter na prawdziwym Mailpit v1.32.0 — ten sam obraz co w `docker-compose.yml`; mail w skrzynce, odmowa → `MailDeliveryError` ze statusem 400). Ręcznie: zbudowane API z `MAILPIT_URL=http://localhost:8025` na bazie i Mailpicie z Docker Compose — rejestracja 200, prośba 200, w Mailpit (`/api/v1/search`) 1 wiadomość „Reset hasła — Wspólna lista zakupów”, treść „Ktoś poprosił o reset hasła… http://localhost:5173/reset-hasla?token=…”; prośba dla nieistniejącego e-maila 200, bez maila. Log API tego przebiegu bez e-maila i tokenu (`grep` = 0).
- **AC3:** test 8 (klik w link i stan ekranu docelowego: pole e-mail, „Info — zaproszenie” na SC-01 po powrocie). SC-01 i SC-02 linkują przez `EntryLink` (`to` rozszerzone o `/reset-hasla`).
- **AC4:** test 7 — Loading (`aria-disabled`, fokus na przycisku), sukces w `role="status"` z adresem wysłanym (nie zmienionym w trakcie), fokus na przycisku, pole i przycisk zostają; 429 i błąd sieci w `role="alert"` z tekstami z SC-03; po udanej prośbie błąd znika.
- **AC5:** test 9 (axe bez naruszeń: pusty z e-mailem z SC-01, sukces, limit, sieć; `dblclick` → 1 żądanie) + test 7 (dwa `fireEvent.click` w jednym `act` → 1 żądanie; zapis przez `useGuardedMutation`).
- **SEC1 (TH-11):** test 2 — status, treść (`{}`) i nagłówki (poza `date`, `x-request-id`) identyczne; adapter opóźniony o 2 s, odpowiedź < 1 s (mail w tle: `sendResetPassword` od razu zwraca); dla nieistniejącego brak wiersza `verification`.
- **SEC2 (TH-10):** test 3 — 4. prośba z jednego IP → 429 `rate_limited`, mail nie wychodzi; 4. prośba dla jednego e-maila z różnych IP (także wielkie litery i spacje) → 429, brak 4. maila; nieistniejący e-mail limitowany tak samo; 10 równoległych → dokładnie 3 przechodzą; po 15 min znów 200.
- **SEC3 (TH-27):** test 3 — po limicie IP nowe e-maile i po limicie e-maila kolejne prośby nie zmieniają liczby wierszy `verification` ani `rate_limit`; tabela `limits.security.test.ts` (`atLimit()`, wszystkie tabele) dla obu nowych limitów.
- **SEC4 (TH-21):** test 4 — w logu brak części lokalnej e-maila (istniejącego i nieistniejącego), tokenu, tematu i treści maila, także gdy dostawca odrzuca wysyłkę błędem z adresem i treścią (do logu tylko typ błędu i status: `{ source: "mailer", error, status }`); przekroczenie limitu e-maila → jedno zdarzenie `rate_limited` w `security` z `limit: "passwordResetPerEmail"`, `route`, `accountKey`; `limits.security.test.ts` (schemat T-035, jedno zdarzenie przy `OVER` przekroczeniach) dla `passwordResetPerIp` i `passwordResetPerEmail`.
- **SEC5 (TH-14):** test 5 — obcy i brakujący `Origin` → 403 `invalid_origin`, także dla zapisu `/api/%61uth/request-password-reset` (TH-26), przed limitem i zapisem (bez nowych wierszy, bez maila); `redirectTo` z obcą domeną i podmieniony `Host` / `X-Forwarded-Host` nie trafiają do maila (link zawsze z `APP_ORIGIN`; `passwordResetRequestSchema` nie przepuszcza `redirectTo` dalej).

### Przebieg całości (ten przebieg)

- `pnpm test` (wszystkie projekty Vitest): 103 pliki, 551 testów, zielone. `pnpm vitest run --project api --sequence.shuffle` z seedami 11 i 202: 70 plików, 273 testy, zielone. `pnpm test:mobile`: 10/10.
- `pnpm test:e2e`: 52 passed (4,0 min, Windows, 1 worker).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd 0 klonów po wydzieleniu `AuthForm`; depcruise bez naruszeń), `pnpm design-check`, `pnpm backlog-check`, `pnpm workflow-check`, `bash scripts/test/mobile.test.sh` (dry-run bez zmian): zielone.

### Decyzje i uwagi dla QA

- **Próg per IP:** `RATE_LIMITS.passwordResetPerIp` = 3 / 60 s — wartość, którą Better Auth stosuje domyślnie dla `/request-password-reset` (threat-model.md: limit resetu przez `rateLimit` Better Auth, „konkretne progi w tasku”, jak w T-008). Teraz jest w stałych i działa jako `perIp` Fastify (w pamięci, przed licznikiem e-maila — TH-27) oraz jako reguła Better Auth (druga linia, w bazie). Próg per e-mail 3 / 15 min z zatwierdzenia właściciela.
- **Licznik per e-mail bez nowej tabeli:** wiersz w `rate_limit` Better Auth z kluczem `password-reset-email:<HMAC e-maila>` (`last_request` = początek okna). Bez migracji (task bez warstwy `db`). Better Auth usuwa wiersze starsze niż jego najdłuższe okno (1 h), więc nie skraca okna 15 min. Pseudonim to ten sam HMAC co przy limicie logowania (wydzielony do `infra/account-key.ts`).
- **Origin:** Better Auth sprawdza `Origin` tylko przy żądaniu z ciasteczkiem, więc `trustedOrigin` obejmuje teraz także `POST /api/auth/request-password-reset` (`PUBLIC_AUTH_ROUTES`), przed limitem i zapisem. Brak `Origin` = 403, jak na `/api/v1/*` (SC-03 jest tylko w web).
- **`MAILPIT_URL` wymagany:** bez niego API nie startuje (`config.test.ts`). Dopisany do `.env.example`, `apps/web/e2e/server.ts` (Mailpit w Testcontainers), `scripts/mobile-e2e.sh` i `scripts/test/image-run.test.sh` (CI). Staging (`fly.staging.toml`) dostanie dostawcę w T-055 — epik i tak trafia na `main` (i staging) dopiero po T-055. Lokalny `.env` właściciela: dopisane `MAILPIT_URL=http://localhost:8025` (plik poza gitem).
- **Dwa linki pod rząd:** każda prośba tworzy nowy wiersz `verification`; Better Auth nie usuwa wcześniejszych przy nowej prośbie, więc do użycia (T-054) albo wygaśnięcia (1 h) ważne są oba.
- **Copy:** SC-03 krok 1 nie ma stanu walidacji pustego / złego e-maila ani tekstu dla innych błędów — użyte „Wpisz poprawny adres e-mail” (jak SC-02) i „Nie udało się wysłać linku. Spróbuj ponownie.” (propozycja do `docs/design/screens/SC-03-reset-hasla.md`). Fokus po błędzie zostaje na przycisku (AC4); komunikat ogłasza `role="alert"`.
- **Trasa `/reset-hasla`** jest publiczna także dla zalogowanych (nie pod `PublicOnly`), bo link z maila (T-054) może otworzyć się w przeglądarce z sesją.
- **Przewodniki warstw (8b, fakty):** backend — „Gdzie jest kod” (nowe pliki `konta`, helpery testów `mailer.ts`, `mailpit.ts`, `PASSWORD_RESET_VALIDITY_SECONDS`), „Komendy” (`MAILPIT_URL`); web — trasa `/reset-hasla`, SC-03, `AuthForm`, `EntryLink`, Mailpit w serwerze E2E.
- **Do aktualizacji przez właściciela (nie edytuję `docs/architecture/` poza przewodnikami):** `api.md` „Stan po T-004” — most udostępnia też `request-password-reset`, limity resetu 3/min per IP i 3/15 min per e-mail, `redirectTo` pomijany; `tech-stack.md` / `deployment.md` — zmienna `MAILPIT_URL` (lokalnie, CI).
