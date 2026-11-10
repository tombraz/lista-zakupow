---
id: T-054
title: "Nowe hasło z linku; reset kończy wszystkie sesje"
epic: E-02
story: S-02-01
status: done           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-053]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-03, N-04]
threats: [TH-10, TH-21, TH-28]
screens: [SC-03, SC-01]
---

# T-054 Nowe hasło z linku; reset kończy wszystkie sesje

## Goal

Link z maila otwiera SC-03 krok 2; domownik ustawia nowe hasło i loguje się nim na SC-01. Link działa raz i przez 1 godzinę, a reset kończy wszystkie sesje konta razem z ich połączeniami na żywo.

## Demo

1. Poproś o reset (T-053), otwórz link z Mailpit → „Ustaw nowe hasło”, fokus w polu hasła.
2. Wpisz „krótkie” → „Hasło musi mieć co najmniej 8 znaków”. Wpisz poprawne → „Zapisz hasło” → SC-01 z „Hasło zmienione. Zaloguj się nowym hasłem.”
3. Stare hasło nie działa, nowe działa.
4. Ten sam link drugi raz → „Ten link wygasł albo został już użyty.” + „Wyślij nowy link” → krok 1.
5. Druga przeglądarka zalogowana na to konto z otwartą listą: po resecie przestaje dostawać zmiany i przy następnej akcji trafia na SC-01 (T-018).

## Context

- BRD: F-03 — „link resetu jednorazowy i ważny 1 godzinę; nowe hasło ma co najmniej 8 znaków; użyty lub wygasły link nie pozwala ustawić hasła”.
- Architektura: `api.md` „Konta” (`POST /api/auth/reset-password { token, newPassword }` → 200; 400 `invalid_token`, 400 `validation_failed`), `threat-model.md` TH-10 („reset unieważnia wszystkie sesje”), TH-28 („`closeSession` na każdej ścieżce końca sesji”), moduł `na-zywo` (`Live.closeSession`), log `security` („zmiana hasła”, `architecture.md` „Obserwowalność”).
- Design: SC-03 krok 2 — stany Error — link nieważny, Error — walidacja, Error — sieć, Loading, Success — krok 2; Accessibility (fokus startowy na polu, menedżer haseł); SC-01 komunikat sukcesu.
- Depends on: T-053 — trasa `/reset-hasla`, `Mailer`, prośba o reset i token Better Auth.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given ważny token, when `POST /api/auth/reset-password { token, newPassword }` z hasłem ≥ 8 znaków, then 200; logowanie starym hasłem daje 401 `invalid_credentials`, nowym — 200. — verified by: test integracyjny
- [x] AC2: Given hasło krótsze niż 8 znaków, then 400 `validation_failed`, hasło bez zmian, token dalej ważny; SC-03 pokazuje błąd pod polem (powiązany z polem, fokus na polu). — verified by: test integracyjny + test komponentu
- [x] AC3: Given SC-03 z `?token=`, when strona się otwiera, then krok 2 z fokusem w polu „Nowe hasło” (`autocomplete="new-password"`, „Pokaż”); po zapisie przejście na SC-01 (`replace`, token nie zostaje w historii) z komunikatem sukcesu `role="status"`. — verified by: test komponentu (MSW)
- [x] AC4: Given token użyty albo starszy niż 1 h (zegar), when wysyłam nowe hasło, then 400 `invalid_token`; SC-03 zamiast formularza pokazuje „Ten link wygasł albo został już użyty.” + „Wyślij nowy link” (→ krok 1, fokus na nagłówku). — verified by: test integracyjny + test komponentu
- [x] AC5: Given SC-03 krok 2 w każdym stanie (formularz, walidacja, link nieważny, sieć) i SC-01 z komunikatem sukcesu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E Playwright + axe (pełna ścieżka z mailem z Mailpit)
- [x] SEC1 (TH-10): Given konto z dwiema sesjami, when reset się udaje, then obie sesje są usunięte (żądanie z każdą daje 401), a dwa równoległe resety tym samym tokenem kończą się jednym sukcesem. — verified by: test integracyjny
- [x] SEC2 (TH-28): Given otwarte połączenie WS sesji tego konta (subskrypcja listy), when reset się udaje, then gniazdo jest zamknięte (1008), kolejne zdarzenie listy do niego nie dociera, a nowe połączenie z tą sesją jest odrzucone. — verified by: test integracyjny WS (`live.*`)
- [x] SEC3 (TH-21): Given reset, when API loguje żądanie, then ścieżka i treść nie zawierają tokenu ani hasła (token zredagowany także w `?token=` adresu strony serwowanej przez API); udany reset zostawia zdarzenie `password_reset` w logu `security` z `userId`, bez e-maila. — verified by: test logów

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `POST /api/auth/reset-password` przez `fastify.inject`, token z przechwytującego `Mailer`
- WebSocket `/api/v1/live` (klient `ws`)
- ekrany SC-03 (krok 2) i SC-01 z MSW
- przeglądarka (Playwright) z Mailpit dla pełnej ścieżki

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | reset ważnym tokenem: stare hasło 401, nowe 200 | integration | Vitest + Testcontainers | AC1 |
| 2 | za krótkie hasło: 400, token dalej ważny | integration | Vitest + Testcontainers | AC2 |
| 3 | token użyty, wygasły (zegar 1 h + 1 s), równoległe użycie | integration | Vitest + Testcontainers | AC4, SEC1 |
| 4 | reset usuwa wszystkie sesje konta | integration | Vitest + Testcontainers | SEC1 |
| 5 | reset zamyka gniazda WS sesji konta; ponowne połączenie odrzucone | integration | Vitest + Testcontainers + `ws` | SEC2 |
| 6 | logi bez tokenu i hasła; zdarzenie `password_reset` w `security` | integration | Vitest | SEC3 |
| 7 | SC-03 krok 2: fokus startowy, walidacja, link nieważny → krok 1, sieć, sukces → SC-01 (`replace`) | component | Vitest + RTL + MSW | AC2–AC4 |
| 8 | E2E: prośba → mail w Mailpit → nowe hasło → logowanie; ponowne użycie linku; axe | E2E | Playwright + axe | AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** `Mailer` (przechwytujący) w testach API, zegar. W E2E prawdziwy Mailpit (API Mailpita do odczytu maila).

**Client state during writes:** zapis hasła — odpowiedź opóźniona (podwójne kliknięcie = jedno żądanie, T-020), utracona po zapisie (ponowna próba dostaje `invalid_token`; ekran mówi, że link nie działa — zapisać w QA, czy to akceptowalne, propozycja: komunikat kroku 2 z „Wyślij nowy link” wystarcza).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** link otwarty w aplikacji pocztowej na telefonie (przeglądarka wbudowana); link ucięty o znak; hasło z polskimi znakami i spacjami; dwa linki z dwóch próśb — który działa po użyciu jednego; reset na koncie, które w międzyczasie usunięto.
- **Design states:** SC-03 krok 2: formularz, Loading, walidacja, link nieważny, sieć; SC-01 sukces.
- **Platforms / devices:** iPhone (Safari) i Android (Chrome) z prawdziwego maila (lokalnie Mailpit w sieci LAN albo na staging po T-055); komputer; 200 %.
- **Accessibility:** fokus w polu hasła po wejściu z linku; menedżer haseł proponuje silne hasło; błąd ogłaszany; „Pokaż” działa z klawiatury.
- **Security / privacy:** TH-10 / TH-28 — zalogowany drugi telefon z otwartą listą traci dostęp po resecie; token nie trafia do logów ani do `Referer` (`Referrer-Policy: no-referrer`); użycie tokenu po 1 h.
- **Regression:** J-01, wylogowanie zamyka WS (T-009, TH-17), wygasła sesja przenosi na SC-01 (T-018).

## Implementation notes

- Better Auth: `revokeSessionsOnPasswordReset: true` usuwa sesje w bazie; zamknięcie gniazd to osobny krok (`Live` nie zna bazy) — potrzebne „zamknij wszystkie połączenia użytkownika” albo `closeSession` dla każdej usuniętej sesji; to samo przyda się w T-062.
- Token w adresie strony (`/reset-hasla?token=`): web czyta go przy wejściu i usuwa z paska adresu (`replace`) przed wysłaniem formularza; API serwuje web, więc redakcja logów obejmuje ten adres (wzorem T-051, na dopasowanej trasie, TH-26).
- Zdarzenie `security` nazwać spójnie z istniejącymi (T-041).

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg 2026-11-01 (`/implement-task T-054`, tryb autonomiczny).

### Testy z planu (czerwony → zielony)

| # | Plik / test | Czerwony (przed kodem) | Teraz |
| --- | --- | --- | --- |
| 1 | `apps/api/test/password-reset.new-password.test.ts` › „sets the new password: the old one is refused, the new one signs in (AC1)” | `expected 404 to be 200` (trasy nie było) | zielony |
| 2 | ten sam plik › „refuses a password shorter than 8 characters and keeps the token valid (AC2)” | przeszedł od razu (walidacja schematem weszła z testem 1); sprawdzone, że gryzie: bez `validate(passwordResetSchema, …)` → `expected { status: 400, …(1) } to deeply equal { status: 400, …(1) }` (Better Auth daje 400 bez `fields`); przywrócone | zielony |
| 3 | ten sam plik › „a used or expired link (AC4)”: użyty, starszy niż 1 h (zegar `10:00` → `11:00:01`), nieznany, dwa równoległe resety | wszystkie 4: `expected { status: 400, …(1) } to deeply equal { status: 400, …(1) }` (kod `validation_failed` zamiast `invalid_token`). Równoległe użycie: po mapowaniu `INVALID_TOKEN` jeden sukces — Better Auth zużywa token atomowo (`consumeVerificationValue` w transakcji zmiany hasła) | zielony |
| 3a | ten sam plik › „refuses the token of an account deleted in the meantime” (dopisany: przypadek z planu QA) | `expected { status: 400, …(1) } to deeply equal …` (Better Auth `USER_NOT_FOUND` → `validation_failed`) | zielony |
| 4 | ten sam plik › „deletes every session of the account” | `expected 200 to be 401` | zielony |
| 5 | `apps/api/test/live.password-reset.test.ts` › „closes every socket of the account's sessions, stops list events and refuses reconnecting” | `Error: connection still open` | zielony |
| 6 | `apps/api/test/password-reset.logs.test.ts` › „keeps the token and the password out of logs and records password_reset with userId” | `expected [] to deeply equal [ ObjectContaining{…} ]` (brak zdarzenia). Część „bez tokenu” przeszła od razu (redakcja `?…token…=` z T-051); sprawdzone, że gryzie: bez `TOKEN_QUERY_PARAMETER` → `expected '{"level":30,…' not to contain 'pudfM2EP…'`; przywrócone | zielony |
| 6a | `password-reset.new-password.test.ts` › „refuses a foreign or missing Origin with 403 and keeps the token valid” (dopisany: TH-14, trasa bez sesji, Better Auth nie sprawdza `Origin`) | `expected { …(4) } to deeply equal { …(4) }` (nie 403) | zielony |
| 6b | ten sam plik › „answers hostile input with 400 validation_failed, never 500” (`{}`, `""`, NUL, tablica, liczba) | przeszedł od razu; sprawdzone, że gryzie: bez `.refine(withoutNul)` na tokenie → porażka asercji (NUL nie daje 400); przywrócone | zielony |
| 7 | `apps/web/src/screens/SC-03-reset-hasla/NewPasswordStep.test.tsx` (13 testów) | wejście z linku: `Unable to find role="heading" and name "Ustaw nowe hasło"`; za krótkie: puste `toHaveAccessibleDescription()`; sukces: brak `aria-disabled` (brak zapisu); link nieważny i sieć: `Unable to find role="alert"`; błąd pola z API i > 128 znaków: puste `toHaveAccessibleDescription()`; kropka po tokenie: wysłany token z kropką; pusty token: `Unable to find role="alert"`. Przeszły od razu: podwójne kliknięcie (`useGuardedMutation`), przeładowanie (token w stanie nawigacji), zalogowana przeglądarka — ten sprawdzony: bez `setSession(null)` → brak komunikatu na SC-01 (`PublicOnly` przekierowuje); przywrócone | zielony |
| 8 | `apps/web/e2e/j01-nowe-haslo.spec.ts` (telefon, komputer): prośba w UI → mail z Mailpit (API Mailpita) → krok 2 (fokus, adres bez tokenu) → walidacja → brak sieci → zapis → SC-01 z komunikatem → stare hasło odrzucone, nowe loguje → ten sam link: „link nieważny” → „Wyślij nowy link” → krok 1 z fokusem na nagłówku; axe w każdym stanie | napisany po zachowaniu na szybszych seamach (E2E na końcu); przeszedł za pierwszym razem | zielony |

### Kryteria akceptacji

- **AC1:** test 1 — 200; logowanie starym hasłem 401 `{ error: { code: "invalid_credentials" } }`, nowym (polskie znaki i spacje) 200. E2E 8 to samo w przeglądarce.
- **AC2:** test 2 — 400 `{ code: "validation_failed", fields: { newPassword: "too_short" } }`, stare hasło dalej działa, ten sam token potem ustawia hasło (200). Test 7: błąd pod polem (`aria-describedby` = opis + błąd, `aria-invalid`), fokus na polu, bez żądania; błąd pola z API też pod polem. E2E 8.
- **AC3:** test 7 — wejście `/reset-hasla?token=…` → krok 2, fokus w „Nowe hasło” (`type="password"`, `autocomplete="new-password"`, opis „Co najmniej 8 znaków.”, „Pokaż”), adres bez tokenu (`search === ""`); zapis → Loading (`aria-disabled`, fokus na przycisku) → SC-01 z `role="status"` „Hasło zmienione. Zaloguj się nowym hasłem.”; `replace` — wstecz nie wraca do strony z tokenem. E2E 8 (`toHaveURL(/\/reset-hasla$/)`).
- **AC4:** test 3 (użyty, wygasły 1 h + 1 s, nieznany, konta usuniętego → 400 `invalid_token`) + test 7: zamiast formularza `role="alert"` „Ten link wygasł albo został już użyty.” z fokusem (formularz z fokusem znika) + „Wyślij nowy link” → krok 1, fokus na `h1` „Reset hasła”, pole e-mail puste. E2E 8.
- **AC5:** E2E 8 — axe bez naruszeń: krok 2 formularz, walidacja, sieć, link nieważny, SC-01 z komunikatem (oba viewporty).
- **SEC1 (TH-10):** test 4 — obie sesje konta (rejestracja + drugie logowanie) → 401 na `GET /api/v1/me`, sesja innego konta 200 (`revokeSessionsOnPasswordReset: true`; korekta T-118: adapter działał bez transakcji, więc kroki resetu zatwierdzały się osobno — od T-118 `transaction: true`, a wyścig z równoległym logowaniem starym hasłem domyka most). Test 3 — dwa równoległe resety tym samym tokenem: dokładnie jeden 200, drugi 400 `invalid_token`, działa hasło zwycięzcy.
- **SEC2 (TH-28):** test 5 — dwa gniazda dwóch sesji konta z subskrypcją listy → oba zamknięte 1008; zdarzenie listy (właściciel dodaje pozycję, 201) do nich nie dociera; nowe połączenie z każdą z tych sesji → 401; gniazdo właściciela zostaje otwarte. `Live.closeUser(userId)` (hub: wspólne `closeWhere` z `closeSession`).
- **SEC3 (TH-21):** test 6 — `GET /reset-hasla?token=…` i `POST /api/auth/reset-password?token=…` z tokenem i hasłem w treści: w logu brak tokenu, hasła i e-maila; jedno zdarzenie `security` `{ event: "password_reset", userId, route: "/api/auth/reset-password" }`, bez e-maila. Log API z pełnego przebiegu E2E: `reset-hasla?token=[redacted]` (4×), 0 adresów `@example.com`, 2 zdarzenia `password_reset`.

### Przebieg całości (ten przebieg)

- `pnpm test`: 106 plików, 575 testów, zielone. `pnpm vitest run --project api --sequence.shuffle` z seedami 11 i 202: 72 pliki, 285 testów, zielone. `pnpm test:mobile`: 10/10.
- `pnpm test:e2e`: 54 passed (4,3 min, Windows, 1 worker).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd 0 klonów, depcruise bez naruszeń), `pnpm design-check`, `pnpm workflow-check`: zielone.

### Decyzje i uwagi dla QA

- **Właściciel tokenu:** most czyta `verification` (`reset-password:<token>`) przed przekazaniem do Better Auth; po 200 wie, czyje sesje usunięto (log `security`, `live.closeUser`). Token zużywa atomowo Better Auth, więc wynik należy do tego konta.
- **`closeUser` zamiast `closeSession` dla każdej usuniętej sesji:** reset usuwa wszystkie sesje konta, więc zamykamy wszystkie połączenia domownika; nie trzeba listy sesji sprzed usunięcia (wyścig). Przyda się w T-062 (usunięcie konta).
- **`Origin` na `/api/auth/reset-password`:** dopisany do `PUBLIC_AUTH_ROUTES` (`trusted-origin.ts`) jak prośba o reset (TH-14; trasa bez sesji zmienia hasło). Brak `Origin` = 403 — web zawsze go wysyła.
- **Konto usunięte w międzyczasie:** Better Auth `USER_NOT_FOUND` → 400 `invalid_token` (ekran „link nieważny”).
- **Token w stanie nawigacji:** web zdejmuje `?token=` z adresu (`replace`) do `history.state`, więc przeładowanie zostaje na kroku 2; po zapisie `replace` na SC-01 nadpisuje ten wpis. Token nie trafia do `Referer` (zdjęty z adresu; `Referrer-Policy: no-referrer` z helmeta).
- **Kropka po linku (QA T-053 #2):** web ucina końcowe `.,;:!?)` z tokenu (token Better Auth to litery i cyfry). Pusty token w adresie → „link nieważny” po wysłaniu.
- **Sesja w tej przeglądarce:** po udanym resecie `useSetSession(null)` — reset usunął sesje konta (także tej przeglądarki, jeśli to to konto); inaczej `PublicOnly` przeniósłby z SC-01 na SC-05. Jeśli link otwarto w przeglądarce zalogowanej na **inne** konto, klient też kończy u siebie sesję (ciasteczko zostaje ważne; po odświeżeniu `GET /me` ją przywraca). Akceptowalne: celem ekranu jest SC-01 z komunikatem.
- **Utracona odpowiedź po zapisie** (plan, „Client state during writes”): ponowienie dostaje `invalid_token` i ekran pokazuje „link nieważny” z „Wyślij nowy link” — zgodnie z propozycją planu; QA ocenia, czy wystarcza.
- **Copy spoza tabeli SC-03:** „Hasło może mieć najwyżej 128 znaków” (jak SC-02), „Nie udało się zapisać hasła. Spróbuj ponownie.” (inne błędy zapisu) — propozycja do `docs/design/screens/SC-03-reset-hasla.md`.
- **E2E i Mailpit:** Mailpit serwera E2E na stałym porcie (`E2E_MAILPIT_PORT`, domyślnie 3125, `startMailpit(hostPort)`), bo maile czyta proces testów (`e2e/mailpit.ts`). Zajęty port 3125 = błąd startu serwera E2E.
- **Zagrożenie spoza threat-model (do oceny):** Better Auth z `rateLimit.storage: "database"` zapisuje wiersz `rate_limit` na każdą parę IP + ścieżka także dla `/reset-password` (bez `perIp` przed nim) — to samo co TH-27 dla innych publicznych tras; ten task nie dodaje limitu (brak zatwierdzonego progu).
- **Przewodniki warstw (8b, fakty):** backend — `reset-password` w moście, `Live.closeUser`, helper `test/reset-token.ts`, `startMailpit(hostPort?)`; web — pliki SC-03 kroku 2, `e2e/mailpit.ts`, port Mailpita E2E.
- **Do aktualizacji przez właściciela (nie edytuję `docs/architecture/` poza przewodnikami):** `architecture.md` tabela błędów — `400 invalid_token` (jest w `api.md`); `api.md` „Stan po T-004” — most udostępnia też `reset-password` (Origin 403, reset kończy sesje i połączenia na żywo); `testing-strategy.md` — E2E czyta maile przez API Mailpita na porcie `E2E_MAILPIT_PORT`.


## QA round 1 (2026-11-01)

Verdict: pass

Niezależna weryfikacja (tryb autonomiczny, świeży kontekst). Zmiany: `9a8f8fd`, `e598abb`.

### Reprodukcja

- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality`, `pnpm design-check`: zielone.
- `pnpm test`: 106 plików, 575 testów, zielone.
- `pnpm test:e2e`: 54 passed (4,6 min), w tym `j01-nowe-haslo.spec.ts` (telefon, komputer) z Mailpit i axe.

### Kryteria akceptacji

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | test 1 przeczytany: 200, stare hasło 401 `invalid_credentials`, nowe 200; E2E zielone |
| AC2 | pass | test 2 (400 `validation_failed` + `fields.newPassword`, token dalej działa); test komponentu: opis błędu powiązany z polem, fokus |
| AC3 | pass | testy komponentu; spot-check: bez `replace: true` w `useNewPassword` test AC3 pada |
| AC4 | pass | użyty / 1 h + 1 s / nieznany / konto usunięte → 400 `invalid_token`; ekran „link nieważny” → krok 1 z fokusem na nagłówku |
| AC5 | pass | E2E z axe we wszystkich stanach, oba viewporty |
| SEC1 (TH-10) | pass | test 4 i równoległe resety (200 + 400); spot-check: `revokeSessionsOnPasswordReset: false` → test 4 pada |
| SEC2 (TH-28) | pass | spot-check: bez `deps.onPasswordReset(userId)` → test WS pada (`connection still open`) |
| SEC3 (TH-21) | pass | test logów: brak tokenu, hasła, e-maila; `password_reset` z `userId`; redakcja `?token=` na `/reset-hasla` |

Spot-checki przywrócone (`git checkout`), `git status` czysty.

### Próby ataku (lokalnie, `fastify.inject`, konta z fabryk testowych)

- Obcy / brak `Origin`, także `/api/%61uth/reset-password`: 403 (test 6a).
- Wrogie wejście (`{}`, pusty token, NUL, tablica, liczba): 400, nigdy 500. Token 100 kB: 413 (limit treści).
- `GET /api/auth/reset-password/:token` (callback Better Auth): 404, mostek nie wystawia innych tras Better Auth.
- Dwa linki z dwóch próśb: po użyciu drugiego (200) pierwszy **dalej ustawia hasło** (200) — patrz #1.

### Findings

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security / F-03 | Udany reset nie unieważnia innych niewykorzystanych linków resetu tego konta; starszy link działa do końca swojej godziny i zmienia hasło ponownie (i znowu kończy sesje). F-03 jest spełnione dosłownie (każdy link jednorazowy, 1 h), ale to przypadek z planu QA. | tymczasowy test: `requestResetToken` ×2, reset tokenem 2 → 200, potem tokenem 1 → 200 | po udanym resecie usunąć wszystkie wiersze `verification` `reset-password:*` tego konta (follow-up, decyzja właściciela) |
| 2 | minor | code quality (spójność modułu) | Stan wejścia `passwordChanged` i `passwordChangedOf` dodane do `apps/web/src/invitations/invitationContext.ts` — moduł zaproszeń niesie stan resetu hasła. | `invitationContext.ts:19`, `:51` | przenieść stan wejścia SC-01 do neutralnego modułu (np. `screens/SC-01-logowanie` albo `entry`) |
| 3 | minor | docs | Pozycja DoD „Architecture docs updated” niezaznaczona: `architecture.md` (tabela błędów, `invalid_token`), `api.md` „Stan po T-004” (most z `reset-password`), `testing-strategy.md` (Mailpit E2E, `E2E_MAILPIT_PORT`) czekają na właściciela. | sekcja Evidence, „Do aktualizacji przez właściciela” | uzupełnić dokumenty |
| 4 | note | security (TH-27) | `/api/auth/reset-password` nie ma limitu per IP w Fastify przed limitem Better Auth, który zapisuje wiersz `rate_limit` (IP + ścieżka). Odczyt `verification` przed Better Auth to tylko odczyt. To samo, co zgłosił autor. | `auth-routes.ts`, `newPasswordRoute` poza zakresem `perIpRateLimit` | decyzja o progu; wtedy `perIp(...)` jak przy prośbie o reset |
| 5 | note | API errors | 413 dla zbyt dużej treści wraca w domyślnym formacie Fastify (`statusCode`, `code`, `message`), nie `{ error: { code } }`. Dotyczy wszystkich tras, istniało przed tym taskiem. | spot-check: token 100 kB → 413 `FST_ERR_CTP_BODY_TOO_LARGE` | błąd w formacie API (osobny task) |
| 6 | note | UX | Utracona odpowiedź po zapisie: ponowienie daje `invalid_token`, więc ekran pokazuje „link nieważny” + „Wyślij nowy link”. Akceptowalne zgodnie z propozycją planu (hasło jest już zmienione, logowanie działa). | plan, „Client state during writes” | bez zmian |
| 7 | note | design | Teksty spoza tabeli Copy SC-03: „Hasło może mieć najwyżej 128 znaków”, „Nie udało się zapisać hasła. Spróbuj ponownie.” | `SC-03-reset-hasla/messages.ts` | dopisać do `docs/design/screens/SC-03-reset-hasla.md` |
| 8 | note | manual checks | Nie sprawdzone ręcznie: czytnik ekranu, prawdziwe telefony z maila, menedżer haseł, zoom 200 % (środowisko bez urządzeń). Automaty: axe w E2E, fokus i opisy w testach komponentu. | — | sprawdzić w UAT epiki |

### Jakość testów

Czerwone komunikaty w Evidence dla każdego testu z planu; testy, które przeszły od razu, mają udokumentowany spot-check. Testy na uzgodnionych granicach (HTTP, WS, ekran z MSW, Playwright), oczekiwane wartości to literały. Wszystkie 8 planowanych testów jest w repo.

### Story / epic

Story S-02-01 nie jest skończona (T-055 `todo`).
