---
id: T-055
title: Mail resetu przez Brevo na staging
epic: E-02
story: S-02-01
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given `MAILER=brevo` i klucz API, when `Mailer` wysyła mail, then wysyła `POST https://api.brevo.com/v3/smtp/email` z nagłówkiem `api-key`, nadawcą z konfiguracji, odbiorcą, tematem i treścią tekstową; odpowiedź 2xx = sukces. — verified by: test adaptera z serwerem HTTP podstawionym na granicy (sprawdza żądanie)
- [ ] AC2: Given Brevo odpowiada 4xx/5xx albo nie odpowiada w 10 s, when wysyłka, then błąd jest zalogowany (status, bez e-maila i treści), a odpowiedź `request-password-reset` dalej 200 jak zawsze (SEC1 T-053). — verified by: test adaptera + test integracyjny
- [ ] AC3: Given konfiguracja produkcyjna bez `BREVO_API_KEY` lub nadawcy, when API startuje, then start kończy się czytelnym błędem konfiguracji (nie cichą wysyłką donikąd). — verified by: `config.test.ts`
- [ ] AC4: Given staging po wdrożeniu, when właściciel prosi o reset, then mail dochodzi; wynik (skrzynka odbiorcza czy spam, czas dostarczenia, czy Brevo akceptuje nadawcę bez własnej domeny) zapisany w `deployment.md` (zamyka punkt „Wysyłka Brevo bez własnej domeny”). — verified by: ręcznie właściciel + wpis w `deployment.md`
- [ ] SEC1 (TH-21): Given wysyłka (udana i nieudana), when API loguje, then logi nie zawierają klucza API, e-maila odbiorcy ani linku z tokenem. — verified by: test logów adaptera
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

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
