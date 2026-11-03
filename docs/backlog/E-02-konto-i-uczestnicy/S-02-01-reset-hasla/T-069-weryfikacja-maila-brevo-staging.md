---
id: T-069
title: Weryfikacja maila resetu przez Brevo na staging
epic: E-02
story: S-02-01
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-055, T-056, T-057, T-058, T-059, T-060, T-061, T-062, T-063, T-064, T-065, T-088]
size: S                # S | M (L must be split)
layers: [infra]
requirements: [F-03, N-02]
threats: [TH-21, TH-22]
screens: [SC-03]
---

# T-069 Weryfikacja maila resetu przez Brevo na staging

## Goal

Po wejściu E-02 na `main` i automatycznym wdrożeniu staging prośba o reset hasła na `lista-staging.fly.dev` dostarcza prawdziwy mail przez Brevo, a wynik (skrzynka czy spam, czas, czy Brevo przyjmuje nadawcę z darmowej poczty) jest zapisany w `deployment.md`. Zamyka AC4 i SEC2 z T-055 oraz kryterium 1 story S-02-01 („na staging w prawdziwej skrzynce”).

## Demo

1. Na `https://lista-staging.fly.dev/reset-hasla` poproś o reset dla konta testowego właściciela.
2. Mail „Reset hasła — Wspólna lista zakupów” przychodzi (skrzynka odbiorcza albo spam) z linkiem `https://lista-staging.fly.dev/reset-hasla?token=…`.
3. Link pozwala ustawić nowe hasło; logowanie nowym hasłem działa, starym nie.
4. `deployment.md` ma wynik weryfikacji i zmienne `MAILER`, `MAIL_FROM`; punkt „Wysyłka Brevo bez własnej domeny” zamknięty.

## Context

- BRD: F-03 — „dostaje mail z linkiem do ustawienia nowego hasła”.
- Architektura: `deployment.md` („Zmienne API”, „Ryzyka: mail resetu w spamie”, otwarty punkt „Wysyłka Brevo bez własnej domeny”, wyzwalacz staging tylko z `main` — T-013), `pipeline.md` (etap 6: po merge do `main` staging, smoke, ZAP).
- Design: SC-03 (komunikat po prośbie i krok 2 z linku).
- Depends on: T-055 — `BrevoMailer`, `MAILER = "brevo"` w `fly.staging.toml`, sekrety `BREVO_API_KEY` i `MAIL_FROM` ustawione przez właściciela z `--stage`. T-056…T-065 — staging wdraża się tylko z `main`, a gałąź epiku wchodzi na `main` (PR #13) po ukończeniu wszystkich tasków E-02 i UAT; decyzja właściciela 2026-11-01: weryfikacja dopiero po merge, bez obchodzenia T-013.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given staging wdrożony z `main` z kodem T-055, when API startuje, then maszyna jest zdrowa (smoke po wdrożeniu zielony), a `fly secrets list -a lista-staging` pokazuje `BREVO_API_KEY`, `MAIL_FROM` i `ALERT_EMAIL` (T-088) (same nazwy, bez wartości w Evidence). — verified by: przebieg `deploy.yml` (link) + wynik `fly secrets list`
- [ ] AC2: Given istniejące konto testowe, when właściciel poprosi o reset na staging, then mail dochodzi z działającym linkiem na `lista-staging.fly.dev`, a nowe hasło działa. — verified by: ręcznie właściciel (skrzynka Gmail i druga skrzynka, np. Onet / WP)
- [ ] AC3: Given wynik AC2, when weryfikacja się kończy, then `deployment.md` zawiera: skrzynka odbiorcza czy spam (per dostawca poczty), czas dostarczenia, czy Brevo przyjmuje nadawcę bez własnej domeny; „Zmienne API” wymieniają `MAILER=brevo` i sekret `MAIL_FROM` obok `BREVO_API_KEY`; punkt „Wysyłka Brevo bez własnej domeny” odhaczony. — verified by: diff `deployment.md`
- [ ] SEC1 (TH-21): Given wysyłka na staging (udana oraz prośba dla nieistniejącego e-maila), when przeglądamy logi API (`fly logs -a lista-staging`), then nie zawierają klucza API, e-maila odbiorcy ani linku z tokenem. — verified by: przegląd logów z okresu weryfikacji (fragment w Evidence, zredagowany)
- [ ] SEC2 (TH-22): Given `main` po merge i obraz staging, when skan sekretów w CI, then klucz Brevo nie występuje w repo ani w obrazie; `git grep xkeysib` bez wyników. — verified by: zielony job skanu sekretów na `main` (link) + `git grep`

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- wdrożony staging przez przeglądarkę i skrzynkę pocztową (prawdziwy Brevo, granica systemu)
- pipeline CI na `main` (skan sekretów, smoke)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | smoke po wdrożeniu staging zielony z `MAILER = "brevo"` | smoke | `scripts/smoke.sh staging` w `deploy.yml` | AC1 |
| 2 | skan sekretów na `main` zielony | CI | job skanu sekretów (`pipeline.md`) | SEC2 |
| 3 | reset na staging dostarcza mail z działającym linkiem | manual E2E | przeglądarka + skrzynka | AC2 |
| 4 | logi z okresu testu bez danych osobowych i klucza | manual | `fly logs` | SEC1 |

Nowego kodu nie ma; „czerwony” stan to dzisiejszy brak dowodu: AC4/SEC2 w T-055 nieodhaczone, punkt w `deployment.md` otwarty.

**Run:** `fly secrets list -a lista-staging`, `scripts/smoke.sh staging`, `git grep xkeysib`

**Mocks:** brak — prawdziwy Brevo i prawdziwe skrzynki.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** prośba dla e-maila bez konta — ten sam komunikat w SC-03, żaden mail nie wychodzi; druga prośba po minucie — dwa maile, starszy link po użyciu nowszego (zachowanie z T-054, minor QA); limit 3/15 min na e-mail daje „Zbyt wiele próśb o reset…” i mail nie wychodzi.
- **Design states:** SC-03 — komunikat po prośbie, krok 2 z linku, link wygasły/użyty.
- **Platforms / devices:** Gmail i inna skrzynka; link klikalny w podglądzie na telefonie; polskie znaki w temacie i treści.
- **Accessibility:** bez zmian w UI; regresja SC-03 na staging klawiaturą.
- **Security / privacy:** TH-21 — logi bez e-maila, linku z tokenem i klucza; TH-22 — klucz tylko w sekretach Fly, nie w repo, obrazie ani artefaktach CI; mail nie zawiera nic poza tekstem i linkiem z SC-03.
- **Regression:** smoke i ZAP po wdrożeniu; logowanie, listy i zaproszenia na staging działają po zmianie `MAILER`.

## Implementation notes

- To task właściciela z pomocą agenta: wdrożenie, sekrety i sprawdzenie skrzynki robi właściciel. Implementer przygotowuje listę kroków i wpis do `deployment.md`, zatrzymuje się z `NEEDS_USER` po wyniki.
- Jeśli Brevo odrzuci nadawcę z darmowej poczty albo mail nie dochodzi: zatrzymaj się i zapytaj właściciela (decyzja z `deployment.md`: Mailjet, Gmail SMTP albo domena); zmiana dostawcy to nowy task i ADR, nie ten.
- Jeśli API na staging nie wstaje po merge (brak sekretu): właściciel ustawia sekret i restartuje maszynę; zapisz to w Evidence.
- Po zamknięciu tego tasku S-02-01 może przejść na `done` (QA weryfikuje kryterium 1 story).

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

<!-- QA rounds are appended below by /qa-task -->
