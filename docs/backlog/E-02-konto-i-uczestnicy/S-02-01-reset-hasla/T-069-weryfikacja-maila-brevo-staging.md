---
id: T-069
title: Weryfikacja maila resetu przez Brevo na staging
epic: E-02
story: S-02-01
status: done    # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given staging wdrożony z `main` z kodem T-055, when API startuje, then maszyna jest zdrowa (smoke po wdrożeniu zielony), a `fly secrets list -a lista-staging` pokazuje `BREVO_API_KEY`, `MAIL_FROM` i `ALERT_EMAIL` (T-088) (same nazwy, bez wartości w Evidence). — verified by: przebieg `deploy.yml` (link) + wynik `fly secrets list`
- [x] AC2: Given istniejące konto testowe, when właściciel poprosi o reset na staging, then mail dochodzi z działającym linkiem na `lista-staging.fly.dev`, a nowe hasło działa. — verified by: ręcznie właściciel (skrzynka Gmail i druga skrzynka, np. Onet / WP)
- [x] AC3: Given wynik AC2, when weryfikacja się kończy, then `deployment.md` zawiera: skrzynka odbiorcza czy spam (per dostawca poczty), czas dostarczenia, czy Brevo przyjmuje nadawcę bez własnej domeny; „Zmienne API” wymieniają `MAILER=brevo` i sekret `MAIL_FROM` obok `BREVO_API_KEY`; punkt „Wysyłka Brevo bez własnej domeny” odhaczony. — verified by: diff `deployment.md`
- [x] SEC1 (TH-21): Given wysyłka na staging (udana oraz prośba dla nieistniejącego e-maila), when przeglądamy logi API (`fly logs -a lista-staging`), then nie zawierają klucza API, e-maila odbiorcy ani linku z tokenem. — verified by: przegląd logów z okresu weryfikacji (fragment w Evidence, zredagowany)
- [x] SEC2 (TH-22): Given `main` po merge i obraz staging, when skan sekretów w CI, then klucz Brevo nie występuje w repo ani w obrazie; `git grep xkeysib` bez wyników. — verified by: zielony job skanu sekretów na `main` (link) + `git grep`

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

- [x] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

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

**Run 2026-11-03 ~11:30 (implementer, po odpowiedzi właściciela — stan „zielony”):**

- Test 1 / AC1 — **zielony.** Właściciel ustawił `BREVO_API_KEY` i `MAIL_FROM` bez `--stage`. `fly secrets list -a lista-staging` (tylko nazwy i status): `BETTER_AUTH_SECRET`, `DATABASE_URL`, `ALERT_EMAIL`, `BREVO_API_KEY`, `MAIL_FROM` — wszystkie `Deployed`. `bash scripts/smoke.sh staging` → „Smoke test: OK” (implementer, 2026-11-03). Job `staging` w Deploy z merge PR #13 ponowiony (`gh run rerun 41612128862 --failed`): **success** — `staging` (wdrożenie + smoke) i `zap` zielone: https://github.com/tombraz/lista-zakupow/actions/runs/41612128862 (próba 2).
- Test 2 / SEC2 — **zielony.** Security na `main` (`5de6893`): https://github.com/tombraz/lista-zakupow/actions/runs/41612128877 (success). `git grep -nE 'xkeysib-[A-Za-z0-9]{10,}'` → brak wyników (rc=1); `git grep xkeysib` trafia tylko w tekst backlogu (T-055, T-069 — nazwa prefiksu). Klucz jest wyłącznie w sekretach Fly (wstrzykiwany do maszyny w runtime, nie jako build arg), więc nie trafia do obrazu budowanego z repo.
- Test 3 / AC2 — **zielony (Gmail), druga skrzynka nieprzetestowana.** Wyniki właściciela (Answer w Open question): Gmail — skrzynka odbiorcza, mail od razu, link działa, nowe hasło loguje, stare nie; nieistniejący e-mail — ten sam komunikat, brak maila; Brevo Logs: Sent, Delivered, Opened, bez odrzuceń; nadawca przepisany przez Brevo na `<login>@<id>.brevosend.com` (DMARC Gmaila). Onet/WP: niewykonane — właściciel nie ma takich kont; zapisane w `deployment.md` jako nieprzetestowane (odchylenie od „Gmail i druga skrzynka” w AC2, decyzja właściciela).
- Test 4 / SEC1 — **zielony.** `fly logs -a lista-staging --no-tail` (100 linii, 10:14–10:21Z, okres testu właściciela): żądania `request-password-reset` (10:14:44, 10:15:46, 10:17:57), `reset-password` + `password_reset` (10:14:59, 10:18:25), `sign-in` (w tym `sign_in_failed` starym hasłem 10:18:55). Wyszukanie `@`, `xkeysib`, `token=` i `BREVO`/`api-key`: brak e-maili i klucza; jedyne `token=` to `"url":"/reset-hasla?token=[redacted]"`. Zredagowany fragment:
  `{"level":40,"channel":"security","event":"password_reset","userId":"ljrB…","route":"/api/auth/reset-password","msg":"password_reset"}`
  `{"req":{"method":"GET","url":"/reset-hasla?token=[redacted]"},"msg":"incoming request"}`
  `{"level":40,"channel":"security","event":"sign_in_failed","accountKey":"qrhQ…","route":"/api/auth/sign-in/email"}`
- AC3 — **zielony.** `docs/architecture/deployment.md` (zgoda właściciela w Answer): „Środowiska” — akapit z wynikiem weryfikacji (Gmail odbiorcza, od razu; Brevo przyjmuje nadawcę z darmowej poczty, przepisuje na `brevosend.com`; inni dostawcy nieprzetestowani); „Sekrety i dostęp” — wiersz `MAIL_FROM` w tabeli i akapit o `MAILER` (`brevo` na staging, `mailpit` lokalnie, wymagane `BREVO_API_KEY`/`MAIL_FROM`/`ALERT_EMAIL`); „Uzasadnienie — Mail” i „Ryzyka” zaktualizowane; otwarty punkt „Wysyłka Brevo bez własnej domeny” odhaczony (`[x]`, osobny wiersz; „Ceny w €” zostaje otwarte).
- Uwaga poza zakresem: CI na `main` dla `5de6893` czerwone — job `tests`: 1160/1160 testów zielonych, ale 1 „Unhandled Error” `57P01` (pg, usuwanie bazy testowej) — znany flake, task naprawczy `T-052` (todo). Bez związku z T-069 (brak zmian w kodzie).
- Nowego kodu nie ma; `pnpm check` nieuruchamiany (zmiany tylko w dokumentacji).

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-03)

Verdict: pass

Zakres: task bez zmian w kodzie (tylko `docs/architecture/deployment.md` i backlog; `git diff 5de6893 HEAD` — 4 pliki dokumentacji). QA zweryfikowało samodzielnie wszystko, co da się sprawdzić bez skrzynek właściciela; AC2 opiera się na relacji właściciela (Answer w Open question).

**Reprodukcja:** `pnpm check` na `17fa726` — exit 0 (format, lint, typecheck, quality, design-check, backlog-check, workflow-check; vitest 147 plików / 1160 testów, jest mobile 10/10). `git status` po przebiegu czysty.

**Kryteria:**

- AC1 — **pass.** `fly secrets list -a lista-staging` (QA, tylko nazwy): `BETTER_AUTH_SECRET`, `DATABASE_URL`, `ALERT_EMAIL`, `BREVO_API_KEY`, `MAIL_FROM` — wszystkie `Deployed`. `gh run view 41612128862`: `success` (image, staging, zap). `GET https://lista-staging.fly.dev/health` → 200, `/reset-hasla` → 200. `apps/api/fly.staging.toml` ma `MAILER = "brevo"`.
- AC2 — **pass (na podstawie relacji właściciela).** Gmail: odbiorcza, od razu, link działa, nowe hasło loguje, stare nie; Brevo Logs bez odrzuceń. Druga skrzynka niewykonana — odchylenie zaakceptowane przez właściciela i zapisane w `deployment.md` jako nieprzetestowane. QA nie ma dostępu do skrzynek; zachowanie API dla nieistniejącego e-maila sprawdzone niżej.
- AC3 — **pass.** Diff `deployment.md` (`c509a84`): wynik per dostawca (Gmail odbiorcza; inni „nieprzetestowane”), czas („od razu (sekundy)”), Brevo przyjmuje nadawcę z darmowej poczty i przepisuje go na `…brevosend.com`; wiersz `MAIL_FROM` w tabeli sekretów, akapit o `MAILER` (jawna zmienna, `brevo` / `mailpit`, wymagane sekrety); punkt otwarty odhaczony, „Ceny w €” zostaje otwarte. Zgoda właściciela na edycję `docs/architecture/` jest w Answer.
- SEC1 — **pass.** Logi z okresu testu właściciela (10:14–10:21Z) wypadły już z bufora `fly logs`, więc QA wykonało własną próbę: `POST /api/auth/request-password-reset` dla `qa-t069-nobody@example.com` → 200 `{}`; `fly logs -a lista-staging --no-tail` (100 linii, do 10:27Z): jedyne `@` to `lista-zakupow@sha256:…` (digest obrazu), 0 trafień `xkeysib` / `api-key` / `BREVO_API`, brak `token=`. `apps/api/src/modules/konta/infra/brevo-mailer.ts` nie loguje niczego.
- SEC2 — **pass.** `git grep -nE 'xkeysib-[A-Za-z0-9]{10,}'` → brak (rc=1); `git grep -l xkeysib` tylko T-055 i T-069 (tekst). GitHub secret scanning i push protection włączone, `secret-scanning/alerts` → 0. Obraz `ghcr.io/tombraz/lista-zakupow:5de6893…` pobrany: `Config.Env` tylko `PATH, NODE_VERSION, YARN_VERSION, NODE_ENV, HOST, PORT`; `docker history` bez `brevo`/`xkeysib`; `grep -rlI "xkeysib-[A-Za-z0-9]" /` w kontenerze — brak.

**Eksploracja (staging):** limit próśb o reset na e-mail — 3× 200, czwarta 429 `rate_limited` (zgodnie z 3/15 min); żądanie bez zaufanego `Origin` z `redirectTo` na obcą domenę → 403 `invalid_origin`. Nie sprawdzone przez QA (wymagają skrzynki): dwa maile i unieważnienie starszego linku, podgląd na telefonie, polskie znaki w temacie.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | AC2 / pokrycie | Wysyłka sprawdzona tylko w Gmailu; druga skrzynka (Onet/WP) z AC2 niewykonana | Answer właściciela; `deployment.md` „Środowiska” — „nieprzetestowane” | Odchylenie zaakceptowane przez właściciela i udokumentowane; sprawdzić przy pierwszym domowniku spoza Gmaila |
| 2 | minor | Evidence / SEC2 | Evidence podaje workflow „Security” jako „skan sekretów w CI”, a to tylko CodeQL; skan sekretów to natywny GitHub secret scanning (poza workflow) | `gh run view 41612128877` — jedyny job `codeql`; `pipeline.md` etap 3 | Dowód SEC2 przez alerty secret scanning (QA: włączone, 0 alertów) i skan obrazu — uzupełnione przez QA |
| 3 | note | Evidence / SEC1 | Fragment logów z okresu testu właściciela nie jest już odtwarzalny (bufor `fly logs`) | `fly logs --no-tail` zaczyna się od 10:21Z | QA potwierdziło własną próbą i przeglądem kodu mailera |
| 4 | note | QA plan | Przypadki wymagające skrzynki (dwa maile / starszy link, telefon, polskie znaki) niewykonane na staging | — | Do kroku UAT E-02 (UAT.md) |

## Open question

Staging po merge PR #13 nie wstaje: brakuje sekretów `BREVO_API_KEY` i `MAIL_FROM` w `lista-staging` (jest tylko `ALERT_EMAIL`). Proszę: (a) ustawić oba sekrety i wykonać kroki 1–4 z Evidence, a w odpowiedzi podać wyniki (per skrzynka: odbiorcza/spam, czas, link i nowe hasło działają; czy Brevo przyjęło nadawcę); (b) zgodzić się, by implementer w tym tasku wpisał wynik do `docs/architecture/deployment.md` (AC3 tego wymaga, a tryb autonomiczny zabrania edycji `docs/architecture/` bez zgody).

Rekomendacja: ustawić sekrety bez `--stage` (natychmiastowy restart), podać wyniki tutaj i zezwolić implementerowi na wpis do `deployment.md` wg szkicu z Evidence; implementer domknie SEC1 (przegląd logów) i odda do QA.

Alternatywa: właściciel sam wpisuje wynik do `deployment.md` i odhacza punkt; implementer tylko weryfikuje logi i diff, i oddaje do QA.

Answer: Właściciel 2026-11-03: sekrety BREVO_API_KEY i MAIL_FROM ustawione bez --stage (fly secrets list: 5 sekretów Deployed; smoke staging OK). Gmail: mail w skrzynce odbiorczej (nie spam), przyszedł od razu, link działa, nowe hasło loguje, stare nie. Nieistniejący e-mail: ten sam komunikat, brak maila. Brevo Logs: Sent, Delivered, Opened, bez odrzuceń; nadawca przepisany przez Brevo na tom.brazkiewicz@12664190.brevosend.com (Gmail jako MAIL_FROM, DMARC) — zapisać w wyniku. Druga skrzynka (Onet/WP): niewykonana, właściciel nie ma innych kont — zapisać jako nieprzetestowane. Zgoda (jak T-088): implementer wpisuje wynik do docs/architecture/deployment.md wg szkicu z Evidence, sprawdza logi (SEC1) i oddaje do QA.
