---
id: T-010
title: Wdrożenie na staging
epic: E-01
story: S-01-01
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-002]
size: M                # S | M (L must be split)
layers: [infra]
requirements: [N-03]
threats: [TH-07, TH-15, TH-22, TH-24]
screens: []
---

# T-010 Wdrożenie na staging

## Goal

Każdy merge do `main` buduje jeden obraz (API + `apps/web/dist`) w GHCR i wdraża go na `lista-staging.fly.dev` z migracjami przed startem, smoke testem i skanem ZAP baseline. Staging jest miejscem security review i UAT epików.

## Demo

1. Merge drobnej zmiany do `main`: workflow `deploy.yml` buduje obraz `ghcr.io/tombraz/lista-zakupow:<sha>`, skanuje go Trivy, wdraża na staging, `smoke.sh staging` i ZAP przechodzą.
2. `https://lista-staging.fly.dev` pokazuje stronę web z T-001 („API działa · baza działa”), a funkcje dodane w kolejnych taskach E-01 pojawiają się tam po ich merge.
3. Po kilku minutach bez ruchu maszyna staging się zatrzymuje; pierwsze żądanie ją budzi.

## Context

- `docs/architecture/deployment.md` — środowiska, sekrety, hosting (Fly `fra`, Neon `lista-staging` Free), ryzyka (koszt Neon, nazwy aplikacji Fly), otwarte pytania (limit bezczynności WebSocket na Fly, ceny w €).
- `docs/architecture/pipeline.md` — etapy 4–6, 8, 11, kandydat na task infra 3; migracje przez `release_command`.
- `.claude/skills/ci-cd/references/github-actions.md` — drabina weryfikacji (rungi 1, 2, 4), środowiska, sekrety.
- ADR 0006 (Fly + Neon, jeden origin).
- Depends on: T-002 — `ci.yml`, konwencje workflow, ochrona `main` (merge tylko z zielonym `ci-ok`).

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given workflow `deploy.yml` i skrypty `scripts/deploy.sh`, `scripts/smoke.sh`, when uruchomię actionlint i skrypty w trybie `--dry-run`, then actionlint przechodzi, a skrypty wypisują komendy dla `staging` i `<sha>` bez ich wykonania. — verified by: rungi 1 i 2 (lokalnie)
- [ ] AC2: Given merge do `main`, when `deploy.yml` się zakończy, then obraz `:<sha>` jest w GHCR, migracje wykonały się jako `release_command`, nowa wersja działa na staging, a `smoke.sh staging` sprawdził `/health`, `/health/ready` i stronę web. — verified by: rung 4, link do przebiegu
- [ ] AC3: Given nieudana migracja (gałąź testowa z celowo błędną migracją, wdrożona ręcznie na staging przez `workflow_dispatch` za zgodą właściciela), when wdrożenie się uruchomi, then zostaje przerwane, a poprzednia wersja działa dalej. — verified by: rung 4, link do przebiegu i `smoke.sh staging`
- [ ] AC4: Given staging po wdrożeniu, when uruchomi się ZAP baseline z `.zap/rules.tsv`, then brak alertów wysokich; brak nagłówków CSP / HSTS / Referrer-Policy jest regułą FAIL. — verified by: rung 4, raport ZAP jako artefakt
- [ ] AC5: Given `fly.staging.toml`, when sprawdzę konfigurację, then: region `fra`, auto-stop włączony, healthcheck na `/health`, `force_https`, `release_command` z migracjami; pula połączeń zamyka bezczynne połączenia ≤ 60 s. — verified by: przegląd + test konfiguracji (porównanie kluczy) w `--dry-run`
- [ ] AC6: Given `deployment.md`, when task się zakończy, then otwarte pytania o limit bezczynności WebSocket na Fly i rzeczywiste nazwy aplikacji są rozstrzygnięte i zapisane (z datą i źródłem). — verified by: przegląd dokumentu
- [ ] SEC1 (TH-22): Given obraz z podatnością high lub critical z dostępną poprawką, when Trivy go skanuje, then wdrożenie się zatrzymuje. — verified by: rung 3/4 (obraz testowy ze starym obrazem bazowym na gałęzi testowej) albo przegląd konfiguracji z progiem, jeśli nie da się bezpiecznie odtworzyć — opisane w Evidence
- [ ] SEC2 (TH-15, TH-24): Given wdrożony staging, when `smoke.sh` pobierze `/` i `/health`, then są nagłówki CSP, HSTS i `Referrer-Policy: no-referrer`, a żądanie `http://` przekierowuje na `https://`. — verified by: `smoke.sh staging` (rung 4)
- [ ] SEC3 (TH-07): Given konfiguracja Neon i Fly, when sprawdzę ją, then baza i maszyna są w UE (Frankfurt), `DATABASE_URL` ma `sslmode=require` i jest tylko w sekretach Fly, a szyfrowanie danych w spoczynku u Neon jest potwierdzone (źródło i data w `deployment.md`). — verified by: przegląd konfiguracji (Evidence ze zrzutami od właściciela)
- [ ] SEC4: Given workflow `deploy.yml`, when sprawdzę uprawnienia, then sekrety pochodzą wyłącznie ze środowiska GitHub `staging`, `permissions` są minimalne (`packages: write` tylko w jobie budowy), a `concurrency` per środowisko nie anuluje wdrożeń w toku. — verified by: przegląd + actionlint

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- skrypty `deploy.sh` / `smoke.sh` (`--dry-run`), przebieg `deploy.yml`, healthcheck i nagłówki wdrożonego staging

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | actionlint na `deploy.yml` | static | actionlint | AC1, SEC4 |
| 2 | `deploy.sh --dry-run staging <sha>` wypisuje oczekiwane komendy; brak argumentów = błąd | script | bash | AC1 |
| 3 | `smoke.sh` przeciw lokalnemu api (build web) — przechodzi; przeciw api bez nagłówków — nie przechodzi | script | bash + lokalne api | SEC2 |
| 4 | obraz budowany lokalnie uruchamia api i web pod jednym portem | script | Docker | AC2 |
| 5 | wdrożenie z `main` + smoke + ZAP | real run | GitHub Actions + Fly | AC2, AC4 |
| 6 | celowo błędna migracja przerywa wdrożenie | real run | GitHub Actions + Fly | AC3 |

**Run:** actionlint (jak w T-002); `bash scripts/deploy.sh --dry-run staging <sha>`; `bash scripts/smoke.sh http://localhost:<port>`; przebiegi `deploy.yml` (push i `workflow_dispatch` wymagają zgody właściciela)

**Mocks:** brak.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** wybudzanie maszyny po auto-stop (czas pierwszej odpowiedzi); uśpiona baza Neon (pierwsze `/health/ready`); dwa merge szybko po sobie (kolejka `concurrency`); nazwa aplikacji Fly zajęta.
- **Design states:** —
- **Platforms / devices:** staging w Chrome na komputerze i Safari na iPhonie (HTTPS, brak ostrzeżeń).
- **Accessibility:** —
- **Security / privacy:** nagłówki w przeglądarce; obraz w GHCR bez sekretów (`docker history`, Trivy); `fly secrets list` pokazuje tylko nazwy; logi Fly bez danych osobowych; brak dostępu do bazy spoza Fly.
- **Regression:** CI na PR (T-002) bez zmian; lokalne komendy z przewodników działają.

## Implementation notes

- Właściciel zakłada konta i nadaje sekrety (Fly, Neon, GitHub Environment `staging`); task przygotowuje listę kroków i komendy, nie uruchamia komend z reguły ask w `.claude/settings.json`.
- Jeden obraz na commit `main`, web z względnymi adresami (`/api/v1`); ten sam obraz pójdzie na produkcję w E-03.
- Brevo (mail resetu) dochodzi w E-02 razem z resetem hasła; tu bez maili.
- Wycofanie, gałąź-kopia Neon, tag i Release — E-03.
- Logika dostawców w `scripts/`, YAML tylko je wywołuje.

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
