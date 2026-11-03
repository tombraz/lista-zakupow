---
id: T-088
title: Alert mailem do właściciela, gdy reset nie unieważni pozostałych linków
epic: E-02
story: S-02-01
status: in-progress          # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-087]
size: S                # S | M (L must be split)
layers: [backend, infra]
requirements: [F-03, N-03, N-02]
threats: [TH-10, TH-21]
screens: []
---

# T-088 Alert mailem do właściciela, gdy reset nie unieważni pozostałych linków

## Goal

Gdy po udanej zmianie hasła nie uda się unieważnić pozostałych linków resetu konta (zdarzenie `reset_tokens_revoke_failed`, T-087), API wysyła mail do właściciela projektu. Właściciel dowiaduje się o oknie ryzyka (linki działają do 1 h, F-03, TH-10) bez czytania logów Fly. Seria takich błędów (np. awaria bazy) daje najwyżej jeden mail na okno czasowe, więc nie wyczerpuje limitu Brevo (300/dzień) potrzebnego na maile resetu.

## Demo

1. Lokalnie (`pnpm dev`, Mailpit) wywołaj błąd unieważnienia tak jak test T-087 (pula odrzucająca `DELETE FROM verification …`) i ustaw nowe hasło z linku.
2. Klient dostaje 200 jak dotąd. W Mailpicie jest mail na `ALERT_EMAIL` z tematem „Alarm: linki resetu hasła nie zostały unieważnione” i treścią z `userId`, czasem zdarzenia i godziną, do której pozostałe linki mogą działać. Mail nie zawiera e-maila konta ani tokenów.
3. Drugi taki błąd w ciągu okna nie daje nowego maila. Pierwszy mail po oknie podaje, ile zdarzeń pominięto.

## Context

- BRD: F-03 — „link jednorazowy, ważny 1 godzinę”; N-03 — „Alarm o awarii mailem do właściciela projektu”; N-02 — bez zewnętrznej analityki i śledzenia (dlatego mail z API, a nie zewnętrzne narzędzie do logów; decyzja właściciela 2026-11-02, `/plan-backlog`).
- Architektura: `architecture.md` „Obserwowalność”; `pipeline.md` „Monitoring i alarmy”; `deployment.md` (Brevo 300/dzień, sekrety Fly); ADR 0003 (jedna instancja API, więc licznik okna może być w pamięci).
- Depends on: T-087 — miejsce, w którym błąd `revokeAll` jest łapany i logowany (`revokeOtherLinks` w `newPasswordRoute`).
- Istniejący kod: `apps/api/src/modules/konta/http/auth-routes.ts` (`revokeOtherLinks`), `apps/api/src/modules/konta/domain/mailer.ts` (`Mailer`, błędy dostawcy), `apps/api/src/config.ts` (`MAILER`, `REQUIRED_FOR_MAILER`), test `apps/api/test/password-reset.revoke-failure.test.ts` i `test/failing-pool.ts`.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given ustawiony adres alarmu i błąd unieważnienia linków po udanej zmianie hasła, when trasa kończy reset, then mailer dostaje jeden mail na adres alarmu z tematem „Alarm: linki resetu hasła nie zostały unieważnione”, `userId`, czasem zdarzenia i godziną, do której pozostałe linki mogą działać (zdarzenie + 1 h). — verified by: test integracyjny (mailer przechwytujący)
- [x] AC2: Given kolejne błędy unieważnienia w oknie 15 minut od wysłanego alarmu, when występują, then nie wychodzi nowy mail. Pierwszy błąd po oknie wysyła mail z liczbą pominiętych zdarzeń. — verified by: test integracyjny ze sterowanym zegarem (`clock.ts`)
- [x] AC3: Given mailer odrzuca wysyłkę alarmu (błąd dostawcy albo timeout), when trasa kończy reset, then klient dalej dostaje 200, a `password_reset` w `security` i zamknięcie połączeń na żywo działają jak w T-087. Błąd wysyłki trafia do logu jako `owner_alert_failed` (nazwa zdarzenia alarmu i status, bez adresu). — verified by: test integracyjny
- [x] AC4: Given wysyłka alarmu trwa (mailer odpowiada z opóźnieniem), when klient czeka na odpowiedź resetu, then odpowiedź nie czeka na mail. — verified by: test integracyjny z mailerem wstrzymanym do zwolnienia
- [x] AC5: Given `MAILER=brevo` bez `ALERT_EMAIL`, when API startuje, then start kończy się czytelnym błędem konfiguracji. Given `MAILER=mailpit` bez `ALERT_EMAIL`, then start działa, a alarm jest tylko w logu. — verified by: `config.test.ts`
- [x] AC6: Given udany reset bez błędu unieważnienia, then nie wychodzi żaden alarm. — verified by: test integracyjny
- [x] AC7: Given staging, then sekret `ALERT_EMAIL` jest ustawiony w Fly (`fly secrets list` pokazuje nazwę, bez wartości) przed merge E-02 na `main`. `deployment.md` (tabela zmiennych) i `.env.example` opisują zmienną. — verified by: ręczna kontrola (właściciel uruchamia `fly secrets set`), wpis w Evidence
- [ ] SEC1 (TH-21): Given alarm, when mail powstaje, then treść i temat nie zawierają e-maila konta, tokenów, haseł ani komunikatu błędu bazy (tylko `errorSummary`-owy kod, np. `57P01`), a log `owner_alert_failed` nie zawiera adresu alarmu. — verified by: test integracyjny (szuka e-maila konta, obu tokenów i `ALERT_EMAIL` w mailu i w całym logu)
- [ ] SEC2 (TH-10): Given osoba spoza projektu, when wywołuje dowolną trasę `/api/*`, then nie może wywołać wysyłki alarmu ani zmienić adresu alarmu. Alarm uruchamia wyłącznie błąd po stronie serwera po udanym resecie. — verified by: test integracyjny, że nieudany reset (zły lub zużyty token) nie wysyła alarmu, oraz przegląd tras w QA

## TDD plan

**Test seams:**

- HTTP `POST /api/auth/reset-password` przez `buildTestApp` z mailerem przechwytującym (`test/reset-token.ts`) i pulą odrzucającą unieważnienie (`test/failing-pool.ts`, T-087), bez `vi.mock`.
- Zegar przez istniejący `clock.ts` (granica systemu).
- `loadConfig` w `config.test.ts`.

**Tests in order:**

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Błąd unieważnienia → jeden mail na adres alarmu z `userId`, czasem i godziną wygaśnięcia linków | integration | Vitest + Testcontainers | AC1 |
| 2 | Udany reset bez błędu i nieudany reset (zły token) → brak alarmu | integration | Vitest + Testcontainers | AC6, SEC2 |
| 3 | Mail i cały log bez e-maila konta, tokenów, `ALERT_EMAIL` i treści błędu bazy | integration | Vitest + Testcontainers | SEC1 |
| 4 | Drugi błąd w oknie → bez maila; po 15 min (zegar) → mail z liczbą pominiętych | integration | Vitest + Testcontainers | AC2 |
| 5 | Mailer odrzuca / nie odpowiada → 200, `password_reset`, WS zamknięte, `owner_alert_failed` w logu | integration | Vitest + Testcontainers | AC3 |
| 6 | Mailer wstrzymany → odpowiedź resetu przychodzi przed zwolnieniem mailera | integration | Vitest + Testcontainers | AC4 |
| 7 | `MAILER=brevo` bez `ALERT_EMAIL` → błąd startu; `mailpit` bez niego → start działa | unit | Vitest | AC5 |

**Run:** `pnpm vitest run --project api password-reset config`

**Mocks:** tylko granice: mailer (adapter przechwytujący), zegar, pula bazy odrzucająca jedno zapytanie. Asynchroniczną wysyłkę sprawdzać czekaniem na warunek, bez stałej pauzy (T-082).

## QA plan

- **Edge cases:** seria błędów z wielu kont w jednym oknie (jeden mail, licznik pominiętych obejmuje wszystkie konta); błąd unieważnienia przy równoczesnym drugim resecie tego samego konta (kolejka `ResetTokens.exclusive` się nie blokuje, T-087); restart API zeruje okno (akceptowane: jedna instancja, ADR 0003; zapisz to w notatkach architektury).
- **Design states:** brak ekranu; SC-03 bez zmian (200 i komunikat sukcesu).
- **Platforms:** API lokalnie z Mailpitem; staging tylko konfiguracja (sekret i start aplikacji, weryfikacja maili po merge w T-069).
- **Accessibility:** nie dotyczy (mail tekstowy do właściciela).
- **Security / privacy:** TH-21: przejrzyj mail w Mailpicie i log pod kątem danych osobowych i sekretów. TH-10: spróbuj wywołać alarm z zewnątrz (zły token, zużyty token, brak tokenu, zalew `request-password-reset`). Żadna z tych prób nie może dać maila. Sprawdź, czy wysyłka alarmów nie wpływa na limit maili resetu (najwyżej jeden alarm na 15 min).
- **Regression:** T-087 (`password-reset.revoke-failure.test.ts`), T-075 (`other reset links of the account`), T-054 (`live.password-reset.test.ts`, `password-reset.logs.test.ts`), T-053 / T-055 (mail resetu dalej wychodzi, błąd Brevo nie zmienia odpowiedzi `request-password-reset`).

## Implementation notes

- Mechanizm alarmu nazwij ogólnie (np. alarm do właściciela z nazwą zdarzenia, treścią i oknem tłumienia). E-03 (S-03-02, monitoring) może go użyć dla innych zdarzeń. W tym tasku podłączamy tylko `reset_tokens_revoke_failed`; inne zdarzenia są poza zakresem.
- Wysyłka nie może opóźnić ani zmienić odpowiedzi resetu i nie może odrzucić kolejki `ResetTokens.exclusive` (pułapka „krok mostu po zatwierdzeniu w Better Auth” w `backend.md`).
- Okno tłumienia trzymaj w pamięci procesu (jedna instancja, ADR 0003). Długość okna (15 min) to stała przypięta testem, jak inne limity (T-044).
- Zaktualizuj komentarz w `mailer.ts` („aplikacja wysyła tylko mail resetu”), `architecture.md` „Obserwowalność” (alarm mailowy z API dla wybranych zdarzeń `error`), `pipeline.md` „Monitoring i alarmy” oraz `deployment.md` (zmienna `ALERT_EMAIL`, sekret Fly per aplikacja). Mail alarmu idzie tym samym dostawcą co reset (Brevo), więc nie przybywa nowy podmiot (N-02).
- `ALERT_EMAIL` na staging ustawia właściciel (`fly secrets set ALERT_EMAIL=… -a lista-staging`). Bez tego wdrożenie staging po merge nie wystartuje (AC5). Implementujący przygotowuje komendę i prosi właściciela o jej uruchomienie.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

**Run 2026-11-02/03 (implementacja, autonomicznie).** Kod i testy gotowe; AC7 czeka na właściciela (sekret Fly), patrz „Open question” na końcu.

Zmiany:

- `apps/api/src/owner-alerts.ts` (nowy, ogólny mechanizm N-03): `createOwnerAlerts({ mailer, to, log })`, `raise({ event, at, subject, text })` — wysyłka w tle (bez `await`, nie rzuca), okno tłumienia `OWNER_ALERT_WINDOW_SECONDS = 15 * 60` per nazwa zdarzenia w pamięci procesu (ADR 0003; restart zeruje okno), w treści „Pominięte takie same zdarzenia od poprzedniego alarmu: N”, błąd wysyłki → log `owner_alert_failed` (`alert`, `error`, `status`), bez adresu. Bez `to` (brak `ALERT_EMAIL`) nic nie wysyła; zdarzenie `reset_tokens_revoke_failed` jest już w logu.
- `apps/api/src/modules/konta/domain/reset-alert.ts`: `linksNotRevokedAlert(userId, at, errorCode)` — temat „Alarm: linki resetu hasła nie zostały unieważnione”, `userId`, czas zdarzenia (ISO UTC), godzina wygaśnięcia (zdarzenie + `PASSWORD_RESET_VALIDITY_SECONDS`), kod błędu.
- `auth-routes.ts` `revokeOtherLinks`: po logu `reset_tokens_revoke_failed` woła `deps.onLinksNotRevoked(userId, errorCodeOf(summary))` (kod najgłębszej przyczyny z `errorSummary`, np. `57P01`); `konta/index.ts` składa alarm z `clock.now()` i woła `ownerAlerts.raise` (nowy typ `AccountDeps` z `clock` i `ownerAlerts`). Kolejka `ResetTokens.exclusive` nie czeka na mail.
- `app.ts`: `AppOptions.alertEmail`; `server.ts`: `config.mail.alertTo`. `config.ts`: `ALERT_EMAIL` (`z.email()`), wymagany przy `MAILER=brevo`, opcjonalny przy `mailpit`.
- `deliveryFailure` przeniesione z `konta/index.ts` do `src/logging.ts` (wspólne dla maila resetu i alarmu; zachowanie bez zmian: typ + liczbowy `status`).
- `.env.example`, `apps/api/fly.staging.toml` (komentarz o sekretach), komentarz w `mailer.ts`; `test/require-user.test.ts` podaje nowe zależności `accountRoutes`.
- Step 8b: `docs/architecture/layers/backend.md` „Gdzie jest kod” (`owner-alerts.ts`, `reset-alert.ts`, `deliveryFailure`) i nota pod „Komendy” (`ALERT_EMAIL`). Z opisu `reset-mail.ts` usunięte „jedyny tekst po polsku tworzony przez API” (już nieprawda).

Testy (TDD plan; `apps/api/test/password-reset.owner-alert.test.ts`, `apps/api/test/config.test.ts`):

| # | Test | Red | Teraz |
| --- | --- | --- | --- |
| 1 | `mails the owner once with userId, event time and the links' latest expiry (AC1)` | `AssertionError: expected [] to have a length of 1 but got +0` | pass |
| 2 | `sends no alert after a reset without a revocation failure (AC6)`, `sends no alert for a wrong, a missing or a used token (SEC2)` | przeszły od razu (ochrona wynika z miejsca wywołania); dowód, że gryzą — mutacja (alarm także po udanym `revokeAll` i po nieudanym resecie): `expected [ { …(3) } ] to deeply equal []` oraz `expected [ …3 ] to have a length of 1 but got 3`; kod przywrócony | pass |
| 3 | `keeps the account e-mail, tokens, the alert address and the database message out (SEC1)` | przeszedł od razu; mutacja (adres alarmu doklejony do treści): `expected 'Alarm: linki resetu hasła nie zostały…' not to contain 'alarm-wlasciciela@example.com'`; przywrócony | pass |
| 4 | `sends at most one alert per 15 minutes, then reports how many were skipped (AC2)` (10:00 alarm; 10:14:59.999 dwa błędy z dwóch kont — bez maila; 10:15:00 — mail z „…: 2”) | `expected [ {…}, {…}, {…} ] to have a length of 1 but got 3` | pass |
| 5 | `answers 200, logs password_reset and closes live connections despite a provider refusal / a provider timeout (AC3)` (`MailDeliveryError(502)`, `MailTimeoutError`) | `expected [ { level: 30, …(6) }, …(9) ] to deep equally contain ObjectContaining{…}` (brak `owner_alert_failed`) | pass |
| 6 | `answers the reset without waiting for the alert mail (AC4)` (mailer wstrzymany do `release()`) | przeszedł od razu; mutacja (trasa czeka na `send`): `Error: Test timed out in 30000ms.`; przywrócony | pass |
| 7 | `config.test.ts`: `refuses to start with MAILER=brevo without ALERT_EMAIL`, `refuses an alert address that is not an e-mail address`, `starts with Mailpit without ALERT_EMAIL and takes it when set`, zaktualizowane `takes the Brevo key and the sender…` | 4 × red: `expected [Function] to throw an error` (×2), `expected { provider: 'brevo', …(2) } to deeply equal { provider: 'brevo', …(3) }`, `expected { provider: 'mailpit', …(1) } to deeply equal { provider: 'mailpit', …(2) }` | pass |

Wysyłkę w tle sprawdza `vi.waitFor`, bez stałej pauzy. Brak wysyłki jest sprawdzany zaraz po odpowiedzi: `raise` woła `mailer.send` synchronicznie w obsłudze błędu, a adapter przechwytujący zapisuje mail przed pierwszym `await`.

Weryfikacja (świeża):

- `pnpm check` — exit 0: format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check, vitest 147 plików / 1160 testów, jest mobile 10/10.
- `pnpm vitest run --project api --sequence.shuffle --sequence.seed=88` — 104 pliki / 457 testów pass.
- `pnpm --filter @lista/api build` — ok.
- Regresja z QA planu (T-087 `password-reset.revoke-failure.test.ts`, T-075, T-054, T-053/T-055) — w pełnym przebiegu, zielone.

Kryteria:

- AC1 — test 1. AC2 — test 4. AC3 — test 5. AC4 — test 6. AC5 — test 7. AC6 — test 2.
- SEC1 — test 3 (mail bez e-maila konta, obu tokenów, adresu alarmu i komunikatu bazy „connection terminated”, z kodem `57P01`; cały log bez e-maila konta, tokenów i adresu alarmu); log `owner_alert_failed` bez adresu sprawdza też test 5.
- SEC2 — test 2 (zły, brak i zużyty token nie wysyłają alarmu, także poza oknem tłumienia). Przegląd tras: alarm woła tylko `revokeOtherLinks` w `reset-password` po udanej operacji Better Auth; żadna trasa nie przyjmuje adresu alarmu (tylko zmienna środowiskowa).
- AC7 — **czeka na właściciela** (stan z run 1, niżej rozwiązany).

Proponowane zmiany dokumentów architektury (implementer w trybie autonomicznym nie edytuje `docs/architecture/` poza faktami w przewodnikach warstw; do naniesienia przez właściciela):

- `architecture.md` „Obserwowalność”: „Wybrane zdarzenia `error` dają alarm mailem z API do właściciela (`ALERT_EMAIL`, `src/owner-alerts.ts`), tym samym dostawcą co mail resetu (Brevo; N-02 — bez nowego podmiotu). Najwyżej jeden mail na zdarzenie w 15 min (okno w pamięci procesu, ADR 0003; restart zeruje okno), z liczbą pominiętych. Treść tylko z identyfikatorami i kodem błędu (TH-21). Teraz: `reset_tokens_revoke_failed` (T-088).”
- `pipeline.md` „Monitoring i alarmy”: „Błąd po resecie hasła (linki nieunieważnione) → mail z API na `ALERT_EMAIL`, najwyżej 1 / 15 min (T-088).”
- `deployment.md`, tabela zmiennych: „`ALERT_EMAIL` — sekret Fly per aplikacja (staging, produkcja); adres alarmów do właściciela; wymagany przy `MAILER=brevo` (bez niego API nie startuje), lokalnie opcjonalny.” W budżecie Brevo: alarmy najwyżej 96 na dobę w skrajnym przypadku (1 / 15 min), zwykle 0.
- `backend.md` „Pułapki” (propozycja konwencji): „Mail z kroku po zatwierdzeniu w Better Auth (alarm) wysyłać w tle, bez `await` w kolejce `ResetTokens.exclusive`; test z mailerem wstrzymanym do zwolnienia.”

**Run 2026-11-03 (wznowienie po odpowiedzi właściciela).**

- AC7: `fly secrets list -a lista-staging` (2026-11-03) pokazuje `ALERT_EMAIL` ze statusem `Staged` (digest bez wartości; obok `BETTER_AUTH_SECRET`, `DATABASE_URL` — `Deployed`). Sekret zadziała przy następnym wdrożeniu (`--stage`, decyzja właściciela). `.env.example` opisuje zmienną (linie 10 i 17). Wpis w tabeli zmiennych `deployment.md` pozostaje propozycją wyżej (implementer nie edytuje `docs/architecture/`) — do naniesienia przez właściciela przed merge E-02.
- Świeża weryfikacja: `pnpm check` — exit 0 (format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check, vitest, jest mobile 10/10). Kod bez zmian od run 1.

<!-- QA rounds are appended below by /qa-task -->

## Open question

AC7 wymaga sekretu `ALERT_EMAIL` na staging. Ustawia go właściciel (`fly secrets set` poza repo); implementer nie może tego zrobić. Kod, testy i `pnpm check` są gotowe. `fly secrets list -a lista-staging` pokazuje dziś tylko `BETTER_AUTH_SECRET` i `DATABASE_URL`.

Komenda (z `--stage`, jak przy T-055, żeby nie restartować obecnej wersji):

```
fly secrets set --stage ALERT_EMAIL=<twój adres> -a lista-staging
fly secrets list -a lista-staging   # do Evidence: sama nazwa, bez wartości
```

**Rekomendacja:** ustaw sekret teraz. Przy wznowieniu sprawdzę `fly secrets list`, zapiszę wynik w Evidence, odhaczę AC7 i oddam task do QA.

**Alternatywa:** oddać task do QA od razu, z nieodhaczonym AC7, a sekret ustawić i sprawdzić razem z `BREVO_API_KEY` / `MAIL_FROM` przed merge E-02 (jak T-055; T-069 AC1 i tak sprawdza `ALERT_EMAIL` w `fly secrets list`).

Answer: Właściciel ustawił sekret 2026-11-03: fly secrets set --stage ALERT_EMAIL=... -a lista-staging (staged, zadziała przy następnym wdrożeniu). Sprawdź fly secrets list, zapisz nazwę w Evidence, odhacz AC7 i oddaj do QA.

## Open question

**QA (2026-11-03) — decyzja właściciela przed werdyktem.** Kod i testy sprawdzone niezależnie: `pnpm check` exit 0 (147 plików / 1160 testów + mobile 10/10), testy taska 8/8 i `config.test.ts` zielone; mutacje gryzą (usunięcie wywołania `onLinksNotRevoked` → 7/8 testów czerwonych; okno 14 min zamiast 15 → test AC2 czerwony; przywrócone, `git status` czysty). AC1–AC6, SEC1, SEC2 spełnione; w kodzie nie znalazłem błędów blokujących.

Otwarte jest tylko AC7 (odhaczone przez implementera, ale niespełnione w części dokumentacyjnej): kryterium wymaga, żeby **`deployment.md` (tabela zmiennych)** opisywał `ALERT_EMAIL` — `grep ALERT docs/architecture/deployment.md` nic nie zwraca. Także „Implementation notes” i DoD wymagają wpisów w `architecture.md` „Obserwowalność” i `pipeline.md` „Monitoring i alarmy” (oraz notatki „restart API zeruje okno” z QA planu); żaden nie został naniesiony. Implementer w trybie autonomicznym ma zakaz edycji `docs/architecture/` (poza przewodnikami warstw), więc task i reguły implementera sobie przeczą — zwrot `fail` skończyłby się tą samą blokadą. Gotowe teksty wpisów są w Evidence („Proponowane zmiany dokumentów architektury”). T-069 nie obejmuje tych wpisów (jego AC3 wymienia tylko `MAILER` / `MAIL_FROM`).

- **Odczyt A (rekomendacja):** zgoda właściciela, żeby implementer w tym tasku naniósł cztery proponowane wpisy (`deployment.md` — zmienna `ALERT_EMAIL` i budżet Brevo, `architecture.md`, `pipeline.md`, pułapka w `backend.md`), jak przy T-010. Werdykt QA: `fail` (AC7) → poprawka samej dokumentacji → ponowne QA. Dokumenty są prawdziwe w chwili merge E-02.
- **Odczyt B:** wpisy dokumentacji to praca właściciela / innego taska (np. dopisać do T-069 AC3 `ALERT_EMAIL` oraz wpisy w `architecture.md` i `pipeline.md`). Werdykt QA: `pass`, z brakiem dokumentacji jako follow-up.

Answer: Odczyt A (właściciel, 2026-11-03): zgoda, żeby implementer w tym tasku naniósł cztery proponowane wpisy z Evidence (deployment.md: ALERT_EMAIL i budżet Brevo; architecture.md: Obserwowalność; pipeline.md: Monitoring i alarmy; pułapka w backend.md). QA: fail na AC7, poprawka samej dokumentacji, ponowne QA.

## QA round 1 (2026-11-03)

Verdict: fail

Niezależna weryfikacja (świeża sesja QA). Werdykt zgodny z decyzją właściciela (odczyt A w „Open question” wyżej): `fail` na AC7, poprawka samej dokumentacji, ponowne QA.

Wyniki:

- `pnpm vitest run --project api password-reset config` — 8 plików / 48 testów pass (w tym `password-reset.owner-alert.test.ts` 8/8 i `config.test.ts`).
- `pnpm check` — format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check pass; vitest 1159/1160: jedna porażka `test/routes-nul.test.ts > never logs a raw database exception for NUL input (SEC1)` (T-070). Trzy ponowne uruchomienia `routes-nul` — 24/24 pass. Plik nie jest dotknięty przez T-088; asercja `not.toMatch(/byte sequence|22021/)` na całym logu łapie przypadkowe cyfry (`requestId`, `responseTime`, `time`), więc to niestabilny test, nie regresja tego taska (finding 3).
- Mutacja: usunięcie wywołania `deps.onLinksNotRevoked(...)` w `revokeOtherLinks` → 7/8 testów taska czerwonych; przywrócone (`git checkout`), `git status` czysty.

Kryteria:

- AC1 pass (test AC1; temat, `userId`, czas, czas + 1 h). AC2 pass (zegar testowy, 10:14:59.999 bez maila, 10:15:00 z „…: 2”, dwa konta). AC3 pass (502 i timeout → 200, `password_reset`, WS zamknięte, `owner_alert_failed` bez adresu). AC4 pass (mailer wstrzymany; `raise` nie jest awaitowane). AC5 pass (`config.test.ts`). AC6 pass.
- SEC1 pass (test szuka e-maila konta, obu tokenów, adresu alarmu i komunikatu bazy w mailu i logu; treść z `reset-alert.ts` zawiera tylko `userId`, czasy i kod). SEC2 pass: przegląd tras — `onLinksNotRevoked` wołane tylko z `catch` w `revokeOtherLinks` po udanym resecie Better Auth; adres alarmu wyłącznie ze zmiennej środowiskowej (`config.ts`), żadna trasa go nie przyjmuje; test zły / brak / zużyty token → brak alarmu.
- AC7 **fail** — sekret `ALERT_EMAIL` jest w Fly (`Staged`, wpis w Evidence), `.env.example` opisuje zmienną, ale `deployment.md` (tabela zmiennych) nie: `grep ALERT docs/architecture/deployment.md` — brak wyników.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | AC7 / docs | `deployment.md` nie opisuje `ALERT_EMAIL` (tabela zmiennych) ani alarmów w budżecie Brevo | `grep -n ALERT docs/architecture/deployment.md` → nic | Wpis `ALERT_EMAIL` (sekret Fly per aplikacja, wymagany przy `MAILER=brevo`, lokalnie opcjonalny) i budżet Brevo (≤ 96 alarmów/dobę, zwykle 0) — tekst z Evidence „Proponowane zmiany dokumentów architektury” |
| 2 | major | DoD / docs | `architecture.md` „Obserwowalność”, `pipeline.md` „Monitoring i alarmy” i pułapka w `backend.md` nie opisują alarmu (Implementation notes, DoD; QA plan: „restart API zeruje okno” w notatkach architektury) | `grep -n ALERT docs/architecture/architecture.md docs/architecture/pipeline.md` → nic; `backend.md` ma tylko „Gdzie jest kod” i „Komendy” | Nanieść trzy pozostałe wpisy z Evidence (zgoda właściciela, odpowiedź na „Open question”, odczyt A) |
| 3 | minor | testy (T-070, poza zakresem) | `routes-nul.test.ts` SEC1 niestabilny: regex `/22021/` na całym logu trafia losowe cyfry | 1 porażka w `pnpm check`, 3 × pass przy ponownym uruchomieniu | Zawęzić asercję (np. do pól `err`/`msg` albo `\b22021\b` w kontekście `code`) — osobny task |
| 4 | note | owner-alerts | Okno tłumienia startuje przed wynikiem wysyłki: nieudany mail alarmu zużywa okno, kolejny alarm najwcześniej po 15 min | `owner-alerts.ts`: `windows.set(...)` przed `mailer.send(...)` | Do rozważenia w E-03 (S-03-02); dziś akceptowalne — zdarzenie jest w logu jako `owner_alert_failed` |

Do zmiany (tylko dokumentacja, kod bez zmian): findings 1 i 2 — cztery wpisy z Evidence w `docs/architecture/deployment.md`, `architecture.md`, `pipeline.md` i `layers/backend.md` („Pułapki”). Potem `pnpm check` i ponowne QA.
