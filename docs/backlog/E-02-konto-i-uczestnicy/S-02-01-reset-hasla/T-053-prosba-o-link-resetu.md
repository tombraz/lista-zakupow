---
id: T-053
title: "Prośba o link resetu: mail z linkiem (lokalnie, Mailpit)"
epic: E-02
story: S-02-01
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given konto z e-mailem X, when `POST /api/auth/request-password-reset { email: X }`, then 200 i `Mailer` dostaje jeden mail do X z tematem i treścią z SC-03 Copy oraz linkiem `https://<APP_ORIGIN>/reset-hasla?token=<token>`; token ważny 1 h (Better Auth `verification`). — verified by: test integracyjny z przechwytującym adapterem
- [ ] AC2: Given lokalny `pnpm dev` z Docker Compose, when proszę o reset, then mail jest w Mailpit (adapter HTTP send API Mailpita). — verified by: test adaptera na prawdziwym Mailpit (Testcontainers) + ręcznie w Demo
- [ ] AC3: Given SC-01 z wpisanym e-mailem (i ewentualnie kontekstem zaproszenia), when wchodzę na SC-03 linkiem „Nie pamiętasz hasła?” albo z komunikatu o zajętym e-mailu na SC-02, then pole e-mail jest wypełnione, a „Wróć do logowania” wraca na SC-01 z tym samym e-mailem i kontekstem zaproszenia (WCAG 3.3.7, jak `EntryLink`, T-028). — verified by: testy komponentów SC-01, SC-02, SC-03
- [ ] AC4: Given SC-03 krok 1, when „Wyślij link”, then przycisk w stanie Loading (fokus zostaje, T-015), po odpowiedzi komunikat sukcesu z `role="status"`, fokus na przycisku; pole i przycisk zostają do ponownego wysłania. Given błąd sieci, then „Brak połączenia. Sprawdź internet i spróbuj ponownie.”; given 429, then „Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.” (`role="alert"`). — verified by: test komponentu SC-03 (MSW)
- [ ] AC5: Given SC-03 krok 1 w każdym stanie (pusty, sukces, limit, sieć), when E2E go odwiedza, then axe bez naruszeń; podwójne kliknięcie „Wyślij link” wysyła jedno żądanie (T-020). — verified by: E2E Playwright + axe, test komponentu
- [ ] SEC1 (TH-11): Given istniejący i nieistniejący e-mail, when proszę o reset, then status, treść odpowiedzi i nagłówki (poza `date`, `x-request-id`) są identyczne, a odpowiedź nie czeka na wysyłkę maila (wysyłka po odpowiedzi albo w tle, więc czas nie zdradza istnienia konta); dla nieistniejącego nie powstaje wiersz `verification`. — verified by: test integracyjny porównujący odpowiedzi + test z adapterem opóźnionym o 2 s
- [ ] SEC2 (TH-10): Given 3 prośby o reset dla jednego e-maila w 15 min (próg zatwierdzony przez właściciela 2026-11-01, zapisany w `RATE_LIMITS`) albo przekroczony limit per IP, when przychodzi kolejna, then 429 `rate_limited` i mail nie wychodzi; limit per e-mail nie zdradza istnienia konta (działa tak samo dla nieistniejącego). — verified by: test integracyjny 429 dla IP i dla e-maila
- [ ] SEC3 (TH-27): Given przekroczony limit (IP lub e-mail), when przychodzą kolejne prośby z nowymi e-mailami, then liczba wierszy w tabelach pisanych przed uwierzytelnieniem (`verification`, licznik limitu per e-mail) się nie zmienia. — verified by: test integracyjny liczby wierszy
- [ ] SEC4 (TH-21): Given prośba o reset, when API loguje żądanie, wysyłkę i zdarzenie limitu, then logi nie zawierają e-maila, tokenu ani treści maila; przekroczenie limitu zostawia zdarzenie `rate_limited` w logu `security` w schemacie z T-035 (`limit`, `route`). — verified by: test logów (`captureLogs`) + rozszerzenie `limits.security.test.ts`
- [ ] SEC5 (TH-14): Given obcy `Origin`, when `POST /api/auth/request-password-reset`, then 403 `invalid_origin`; `redirectTo` spoza `APP_ORIGIN` jest odrzucany albo ignorowany (link w mailu zawsze na `APP_ORIGIN`). — verified by: test integracyjny

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
