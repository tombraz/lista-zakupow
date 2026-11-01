---
id: T-055
title: Mail resetu przez Brevo na staging
epic: E-02
story: S-02-01
status: in-progress    # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-053]
size: S                # S | M (L must be split)
layers: [backend, infra]
requirements: [F-03, N-02]
threats: [TH-21, TH-22]
screens: []
---

# T-055 Mail resetu przez Brevo na staging

## Goal

Na staging prośba o reset wysyła prawdziwy mail przez Brevo HTTP API ze zweryfikowanego adresu właściciela; klucz API jest sekretem Fly, a brak lub błąd Brevo nie zdradza istnienia konta i nie psuje odpowiedzi.

## Demo

1. Na `https://lista-staging.fly.dev` poproś o reset dla swojego konta testowego.
2. Mail „Reset hasła — Wspólna lista zakupów” przychodzi do skrzynki (sprawdź też spam) z linkiem na `https://lista-staging.fly.dev/reset-hasla?token=…`.
3. Link działa (krok 2, gdy T-054 jest gotowe; inaczej otwiera SC-03).

## Context

- BRD: F-03 — „dostaje mail z linkiem”.
- Architektura: `deployment.md` (Brevo API, 300/dzień, nadawca: zweryfikowany adres właściciela; sekret `BREVO_API_KEY` w sekretach Fly per aplikacja, rotacja raz w roku; ryzyko: wysyłka bez własnej domeny „niezweryfikowane — sprawdzić w tasku”), `pipeline.md` (smoke po wdrożeniu), `epic.md` E-02 „Technology”.
- Depends on: T-053 — interfejs `Mailer` i wybór implementacji z konfiguracji.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given `MAILER=brevo` i klucz API, when `Mailer` wysyła mail, then wysyła `POST https://api.brevo.com/v3/smtp/email` z nagłówkiem `api-key`, nadawcą z konfiguracji, odbiorcą, tematem i treścią tekstową; odpowiedź 2xx = sukces. — verified by: test adaptera z serwerem HTTP podstawionym na granicy (sprawdza żądanie)
- [x] AC2: Given Brevo odpowiada 4xx/5xx albo nie odpowiada w 10 s, when wysyłka, then błąd jest zalogowany (status, bez e-maila i treści), a odpowiedź `request-password-reset` dalej 200 jak zawsze (SEC1 T-053). — verified by: test adaptera + test integracyjny
- [x] AC3: Given konfiguracja produkcyjna bez `BREVO_API_KEY` lub nadawcy, when API startuje, then start kończy się czytelnym błędem konfiguracji (nie cichą wysyłką donikąd). — verified by: `config.test.ts`
- [ ] AC4: Given staging po wdrożeniu, when właściciel prosi o reset, then mail dochodzi; wynik (skrzynka odbiorcza czy spam, czas dostarczenia, czy Brevo akceptuje nadawcę bez własnej domeny) zapisany w `deployment.md` (zamyka punkt „Wysyłka Brevo bez własnej domeny”). — verified by: ręcznie właściciel + wpis w `deployment.md`
- [x] SEC1 (TH-21): Given wysyłka (udana i nieudana), when API loguje, then logi nie zawierają klucza API, e-maila odbiorcy ani linku z tokenem. — verified by: test logów adaptera
- [ ] SEC2 (TH-22): Given repozytorium i obraz, when skan sekretów w CI, then klucz Brevo nie występuje w repo ani w obrazie (tylko sekret Fly `BREVO_API_KEY`). — verified by: zielony skan sekretów w CI + przegląd `fly secrets list` w Evidence (bez wartości)

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- adapter Brevo wobec serwera HTTP podstawionego w teście (granica systemu)
- konfiguracja startowa API (`config`)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | adapter wysyła poprawne żądanie Brevo | integration | Vitest (lokalny serwer HTTP) | AC1 |
| 2 | 4xx, 5xx, timeout → zalogowany błąd bez danych osobowych | integration | Vitest | AC2, SEC1 |
| 3 | prośba o reset przy awarii Brevo dalej 200 | integration | Vitest + Testcontainers | AC2 |
| 4 | brak klucza na produkcji = błąd startu | unit | Vitest | AC3 |

**Run:** `pnpm vitest run --project api mailer config`

**Mocks:** serwer HTTP Brevo podstawiony lokalnie (granica systemu). Prawdziwy Brevo tylko na staging (AC4).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** dzienny limit Brevo (300) — co widzi użytkownik (to samo „wysłaliśmy”, błąd w logu); polskie znaki w temacie i treści; link w mailu klikalny w Gmailu i Outlooku.
- **Platforms / devices:** skrzynka Gmail i inna (np. Onet / WP) — czy mail nie ląduje w spamie; podgląd na telefonie.
- **Security / privacy:** klucz nie w logach, repo, obrazie, artefaktach CI; mail nie zawiera nic poza linkiem i tekstem z SC-03.
- **Regression:** lokalny przepływ z Mailpit (T-053), smoke po wdrożeniu.

## Implementation notes

- Wejście sekretu na staging robi właściciel (`fly secrets set` poza repo) — zatrzymaj się z `NEEDS_USER`, podając dokładne nazwy zmiennych.
- Jeśli Brevo odrzuci nadawcę z darmowej poczty: zatrzymaj się i zapytaj właściciela (decyzja z `deployment.md`: Mailjet, Gmail SMTP albo domena).
- Adres nadawcy w konfiguracji, nie w kodzie.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Run 2026-11-01 (implementer, autonomiczny). Kod gotowy; AC4 i część SEC2 czekają na właściciela (sekrety Fly, wdrożenie staging) — zob. „Open question”.

**Zmiany:** `apps/api/src/modules/konta/infra/brevo-mailer.ts` (`BrevoMailer`), `domain/mailer.ts` (`MailTimeoutError`), `src/config.ts` (`MAILER` = `mailpit` | `brevo`, `BREVO_API_KEY`, `MAIL_FROM` → `config.mail`), `src/server.ts` (wybór adaptera), `apps/api/fly.staging.toml` (`MAILER = "brevo"`, sekrety w komentarzu), `.env.example`; testy `apps/api/test/brevo-mailer.test.ts`, `brevo-mailer.reset.test.ts`, helper `test/brevo.ts` (`fakeBrevo`). Nadawca (`MAIL_FROM`) to sekret Fly, nie `[env]`: adres właściciela to dana osobowa, a repo jest publiczne.

**Tests (TDD plan):**

1. `Brevo mailer (AC1) > posts the mail to /v3/smtp/email with the api-key header and the configured sender` — red: `Error: not implemented` (stub); `talks to https://api.brevo.com by default` — red: `expected undefined to be 'https://api.brevo.com/v3/smtp/email'`. Teraz zielone.
2. `Brevo mailer failures (AC2, SEC1) > rejects with status 400/401/429/500/503 and no personal data` — zielone przy pierwszym uruchomieniu, bo `MailDeliveryError` przy `!response.ok` powstało już w kroku 1 (wzór z `MailpitMailer`). Sprawdzenie, że gryzie: po usunięciu `if (!response.ok) throw …` wszystkie 5 padło, kod przywrócony. `gives up after 10 s without an answer` (fałszywy `setTimeout`, po 9 999 ms dalej czeka, po 10 000 ms `MailTimeoutError`) — red: `expected 'pending' to be an instance of MailTimeoutError`; teraz zielone.
3. `password reset when Brevo fails (AC2, SEC1) > still answers 200 and logs only the provider status` (Testcontainers, `BrevoMailer` wobec `fakeBrevo` z 500) — zielone przy pierwszym uruchomieniu: obsługa błędu dostawcy w tle istnieje od T-053 (`konta/index.ts`, `deliveryFailure`). Sprawdzenie, że gryzie: po zamianie `.catch(` na `.then(` w `konta/index.ts` test padł (`expected [] to deeply equal [ ObjectContaining{…} ]`), kod przywrócony.
4. `readConfig > takes the Brevo key and the sender when MAILER=brevo, without MAILPIT_URL`, `refuses to start with MAILER=brevo without BREVO_API_KEY` / `MAIL_FROM` (brak i pusty), `refuses a sender that is not an e-mail address`, `refuses an unknown MAILER`, `uses Mailpit when MAILER is not set` — red: 6 failed (m.in. brak pola `mail`, błąd o `MAILPIT_URL` zamiast `BREVO_API_KEY`); teraz zielone. Usunięty stary test `takes the Mailpit address from MAILPIT_URL` (pole `MAILPIT_URL` zastąpione przez `config.mail`; to samo sprawdza `uses Mailpit when MAILER is not set`).

**Weryfikacja:** `pnpm check` — exit 0 (format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check, workflow-check, 108 plików / 589 testów vitest, jest mobile 10/10). `pnpm --filter @lista/api build` — OK. Losowa kolejność plików api: `--sequence.shuffle.files --sequence.seed=55` i `=7` — 299/299. (Uwaga dla QA: pełne `--sequence.shuffle` miesza też testy w pliku i wywraca istniejący `database.test.ts > starts the next test with empty tables` — zależność kolejności w tym pliku, sprzed tego tasku.)

**Acceptance criteria:**

- AC1 — test 1 (żądanie: `POST /v3/smtp/email`, `api-key`, `sender` z konfiguracji, `to`, `subject`, `textContent`; domyślnie `https://api.brevo.com`; 2xx = sukces).
- AC2 — test 2 (4xx/5xx → `MailDeliveryError` ze statusem, 10 s → `MailTimeoutError`) i test 3 (odpowiedź 200, log `error` z `source: "mailer"`, `error: "MailDeliveryError"`, `status: 500`).
- AC3 — test 4 (`config.test.ts`). Na staging `MAILER = "brevo"` w `fly.staging.toml`, więc brak sekretów = API nie startuje.
- AC4 — **czeka na właściciela** (sekrety, wdrożenie, wpis w `deployment.md`, którego implementer nie może edytować).
- SEC1 — testy 2 i 3: błąd i log bez e-maila odbiorcy, linku z tokenem, treści maila, klucza API i adresu nadawcy.
- SEC2 — w repo tylko wartości testowe (`test-api-key`, `brevo-test-key-0123`, `test-brevo-key`); `git grep xkeysib` (prefiks kluczy Brevo) — brak wyników. Zielony skan sekretów w CI i `fly secrets list` (bez wartości) — **czeka na właściciela**.

**Layer guide (Step 8b):** `docs/architecture/layers/backend.md` — „Gdzie jest kod” (`infra/brevo-mailer.ts`, `test/brevo.ts`) i akapit pod „Komendy” (`MAILER`, `BREVO_API_KEY`, `MAIL_FROM`).

**Do aktualizacji przez właściciela (poza uprawnieniami implementera):** `deployment.md` — „Zmienne API”: `MAILER=brevo`, sekret `MAIL_FROM` obok `BREVO_API_KEY`; wynik AC4 i zamknięcie punktu „Wysyłka Brevo bez własnej domeny”.

## Open question

Kod wysyłki przez Brevo jest gotowy i przetestowany lokalnie (AC1–AC3, SEC1). AC4 i SEC2 wymagają właściciela: sekretów na Fly i prawdziwej wysyłki na staging. Staging wdraża się tylko z `main`, a po wdrożeniu tej zmiany API z `MAILER = "brevo"` **nie wystartuje bez obu sekretów**.

Pytanie: czy ustawisz sekrety staging teraz i jak chcesz zweryfikować AC4?

Dokładne nazwy (wartości przez stdin, nie w argumentach):

```
fly secrets import --stage -a lista-staging
BREVO_API_KEY=<klucz API Brevo dla staging>
MAIL_FROM=<adres nadawcy zweryfikowany w Brevo>
<Ctrl-D>
fly secrets list -a lista-staging   # do Evidence: same nazwy, bez wartości
```

**Rekomendacja:** ustaw sekrety teraz z `--stage` (bez restartu obecnej maszyny), oddaj task do QA dla AC1–AC3 i SEC1, a AC4 (mail w skrzynce / spamie, czas dostarczenia, czy Brevo przyjmuje nadawcę z darmowej poczty) i wpis w `deployment.md` zrób po wdrożeniu gałęzi epiku na `main` — wynik dopisz w odpowiedzi.

**Alternatywa:** wdrożyć gałąź epiku na staging ręcznie (`workflow_dispatch` / `scripts/deploy.sh` z obrazem tej gałęzi) przed merge i zweryfikować AC4 od razu, w ramach tego tasku.
