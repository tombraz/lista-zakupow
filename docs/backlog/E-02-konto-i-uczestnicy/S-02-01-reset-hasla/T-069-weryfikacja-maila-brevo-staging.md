---
id: T-069
title: Weryfikacja maila resetu przez Brevo na staging
epic: E-02
story: S-02-01
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

**Run 2026-11-03 ~10:45 (implementer, stan „czerwony” potwierdzony):**

- Test 1 / AC1 — **czerwony.** Deploy z merge PR #13 (`5de6893`, run https://github.com/tombraz/lista-zakupow/actions/runs/41612128862) w toku; maszyna `83d177ebde2ee8` (obraz `tombraz/lista-zakupow:5de6893…`) nie wstaje: `fly logs` pokazuje `ZodError` — „BREVO_API_KEY is required when MAILER=brevo”, „MAIL_FROM is required when MAILER=brevo”, osiągnięty limit 10 restartów; `curl https://lista-staging.fly.dev/api/health` → brak odpowiedzi (000). `fly secrets list -a lista-staging` (tylko nazwy): `BETTER_AUTH_SECRET`, `DATABASE_URL`, `ALERT_EMAIL` — **brak `BREVO_API_KEY` i `MAIL_FROM`** (zakładane w T-055 ustawienie z `--stage` nie zostało wykonane albo się nie zapisało). Walidacja konfiguracji działa zgodnie z T-055/T-088 (fail-fast).
- Test 2 / SEC2 — workflow Security na `main` dla `5de6893` zielony: https://github.com/tombraz/lista-zakupow/actions/runs/41612128877. `git grep xkeysib` — trafienia wyłącznie w tekście backlogu (T-055, T-069: nazwa prefiksu w opisie), żadnego klucza w kodzie ani konfiguracji. Brak klucza w obrazie: klucz nie istnieje w repo, a obraz budowany jest z repo (sekret tylko w Fly) — do potwierdzenia po ustawieniu sekretu (nie dodawany jako build arg).
- Test 3 / AC2 i Test 4 / SEC1 — niewykonalne, dopóki API na staging nie wstaje; wymagają właściciela (skrzynki).
- AC3 — wpis do `docs/architecture/deployment.md` przygotowany niżej (szkic); implementer w trybie autonomicznym nie edytuje `docs/architecture/` — patrz Open question.

**Kroki dla właściciela:**

1. `fly secrets set -a lista-staging BREVO_API_KEY=<klucz staging z Brevo> MAIL_FROM=<zweryfikowany w Brevo adres>` (bez `--stage` — wdroży od razu i zrestartuje maszynę; jeśli maszyna dalej stoi: `fly machine restart 83d177ebde2ee8 -a lista-staging`).
2. `fly secrets list -a lista-staging` — mają być `BREVO_API_KEY`, `MAIL_FROM`, `ALERT_EMAIL`; `bash scripts/smoke.sh staging` zielony (albo ponów job Deploy).
3. Na `https://lista-staging.fly.dev/reset-hasla` reset dla konta testowego na Gmailu i na drugiej skrzynce (Onet/WP). Zanotuj per skrzynka: odbiorcza/spam, czas od kliknięcia do maila, czy link `https://lista-staging.fly.dev/reset-hasla?token=…` działa, nowe hasło loguje, stare nie. Dodatkowo prośba dla nieistniejącego e-maila (ten sam komunikat, brak maila).
4. Czy Brevo przyjęło nadawcę z darmowej poczty (żadnego odrzucenia w panelu Brevo → Transactional → Logs).
5. Implementer potem przejrzy `fly logs` z okresu testu (SEC1) i wpisze wynik.

**Szkic wpisu do `deployment.md` (do uzupełnienia wynikami):**

- „Zmienne API”: wiersz `MAIL_FROM` | API (nadawca maili resetu i alarmów, zweryfikowany w Brevo) | sekrety Fly per aplikacja | przy zmianie adresu; zdanie: `MAILER=brevo` w `fly.staging.toml` / `fly.toml` (zmienna jawna), lokalnie `mailpit`; przy `MAILER=brevo` wymagane `BREVO_API_KEY`, `MAIL_FROM`, `ALERT_EMAIL`, inaczej API nie wystartuje.
- „Mail”/decyzje: „Wysyłka bez własnej domeny: zweryfikowana 2026-11-0X na staging — Gmail: <odbiorcza/spam>, <n> s; <Onet/WP>: <odbiorcza/spam>, <n> s; Brevo przyjmuje pojedynczego nadawcę z darmowej poczty: <tak/nie>.”
- Otwarte punkty: `[x]` „Wysyłka Brevo bez własnej domeny — zweryfikowane w T-069”.

<!-- QA rounds are appended below by /qa-task -->

## Open question

Staging po merge PR #13 nie wstaje: brakuje sekretów `BREVO_API_KEY` i `MAIL_FROM` w `lista-staging` (jest tylko `ALERT_EMAIL`). Proszę: (a) ustawić oba sekrety i wykonać kroki 1–4 z Evidence, a w odpowiedzi podać wyniki (per skrzynka: odbiorcza/spam, czas, link i nowe hasło działają; czy Brevo przyjęło nadawcę); (b) zgodzić się, by implementer w tym tasku wpisał wynik do `docs/architecture/deployment.md` (AC3 tego wymaga, a tryb autonomiczny zabrania edycji `docs/architecture/` bez zgody).

Rekomendacja: ustawić sekrety bez `--stage` (natychmiastowy restart), podać wyniki tutaj i zezwolić implementerowi na wpis do `deployment.md` wg szkicu z Evidence; implementer domknie SEC1 (przegląd logów) i odda do QA.

Alternatywa: właściciel sam wpisuje wynik do `deployment.md` i odhacza punkt; implementer tylko weryfikuje logi i diff, i oddaje do QA.

Answer: Właściciel 2026-11-03: sekrety BREVO_API_KEY i MAIL_FROM ustawione bez --stage (fly secrets list: 5 sekretów Deployed; smoke staging OK). Gmail: mail w skrzynce odbiorczej (nie spam), przyszedł od razu, link działa, nowe hasło loguje, stare nie. Nieistniejący e-mail: ten sam komunikat, brak maila. Brevo Logs: Sent, Delivered, Opened, bez odrzuceń; nadawca przepisany przez Brevo na tom.brazkiewicz@12664190.brevosend.com (Gmail jako MAIL_FROM, DMARC) — zapisać w wyniku. Druga skrzynka (Onet/WP): niewykonana, właściciel nie ma innych kont — zapisać jako nieprzetestowane. Zgoda (jak T-088): implementer wpisuje wynik do docs/architecture/deployment.md wg szkicu z Evidence, sprawdza logi (SEC1) i oddaje do QA.
