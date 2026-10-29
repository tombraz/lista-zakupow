---
id: T-010
title: Wdrożenie na staging
epic: E-01
story: S-01-01
status: in-progress    # todo | in-progress | in-qa | done | blocked
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
| 2a | konfiguracja `fly.staging.toml` (porównanie kluczy) i pula ≤ 60 s — dodany w implementacji | script | bash | AC5 |
| 2b | struktura `deploy.yml`: `packages: write` tylko w `image`, sekrety Fly tylko w `staging`, `concurrency` bez anulowania — dodany w implementacji | script | bash | SEC4 |
| 3a | `image.sh --dry-run build/scan/push`; Trivy na celowo starym obrazie kończy się porażką — dodany w implementacji | script | bash + Docker | SEC1 |
| 4a | `zap.sh --dry-run`, próg alertów wysokich, reguły FAIL w `.zap/rules.tsv`; prawdziwy ZAP na lokalnym obrazie — dodany w implementacji | script | bash + Docker | AC4 |
| 4b | `staging-setup.sh --dry-run` (kroki właściciela bez wartości sekretów; `DATABASE_URL` bez `sslmode=require` / spoza Frankfurtu odrzucony) — dodany w implementacji | script | bash | SEC3 |

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

Stan: rungi 1–2 (i lokalny odpowiednik rungu 3 dla obrazu, Trivy i ZAP) zrobione 2026-10-29; rung 4 (prawdziwe wdrożenie) czeka na właściciela — zob. „Open question” na końcu.

**Testy (red → green):**

| # | Test | Red (przed implementacją) | Teraz |
| --- | --- | --- | --- |
| 1 | actionlint (`rhysd/actionlint:1.7.12`) na wszystkich workflow | spot-check: celowo zepsuty `deploy.yml` (`packages: writ`, `needs: imag`) → exit 1 z błędami `[permissions]` i `[job-needs]` | exit 0 |
| 2 | `scripts/test/deploy.test.sh` (dry-run, brak / zły argument, środowisko bez konfiguracji) | stub `deploy.sh`: „FAIL deploy --dry-run … wypisuje komendy”, exit 1 zamiast 2 | 6 × ok |
| 2a | ten sam plik, klucze `fly.staging.toml` | 8 × FAIL (pusty toml); pula 30 s już spełniała próg (T-004) | 15 × ok |
| 2b | `scripts/test/deploy-workflow.test.sh` | kopia z `packages: write` na poziomie workflow, sekretem Fly w `zap` i `cancel-in-progress: true` → 3 × FAIL | 11 × ok |
| 3 | `scripts/test/smoke.test.sh` (dry-run, atrapa z nagłówkami / bez) | stub `smoke.sh`: exit 9 zamiast 0 / 1 / 2 | 5 × ok |
| 3a | `scripts/test/image.test.sh` | stub `image.sh`: 4 × FAIL | 4 × ok; Trivy: obraz `node:18.0.0-slim` otagowany jako `ghcr.io/tombraz/lista-zakupow:badbad0` → `image.sh scan badbad0` exit 1 (debian 11.3: HIGH 72, CRITICAL 11) |
| 4 | `scripts/test/image-run.test.sh` (build, migracje z obrazu, `id -u` = 1000, smoke na `localhost:8090`) | bez Dockerfile build nie przechodzi | 3 × ok. Pierwszy build wykazał w Trivy 10 × HIGH w npm z obrazu bazowego i deweloperskie zależności w `node_modules/.pnpm` (`pnpm deploy --legacy`): poprawione (npm/corepack usunięte z obrazu, `pnpm deploy` bez `--legacy`) → `image.sh scan` exit 0, wszystkie cele „0” |
| 4a | `scripts/test/zap.test.sh` | stuby: 9 × FAIL | 9 × ok; prawdziwy `zap.sh http://host.docker.internal:8091` na lokalnym obrazie: `FAIL-NEW: 0 … WARN-NEW: 4 … PASS: 64`, „ZAP: brak alertów wysokich” |
| 4b | `scripts/test/staging-setup.test.sh` | stub: 4 × FAIL | 5 × ok |
| 5 | wdrożenie z `main` + smoke + ZAP | 2b: wyzwalacz `[main]` → FAIL „wyzwalacz push: main i tymczasowo deploy-test/**” | 2b zielony (12 × ok), actionlint exit 0. Przebieg 1 z `deploy-test/T-010` (`1bfaad4`): [run 40872833932](https://github.com/tombraz/lista-zakupow/actions/runs/40872833932) — `image` ✓ (build, Trivy, push do GHCR), `staging` ✗ „Error: no access token available” (`FLY_API_TOKEN` pusty: środowisko `staging` ma 0 sekretów wg `gh api …/environments/staging/secrets`), `zap` pominięty |
| 6 | celowo błędna migracja przerywa wdrożenie | — | **nie uruchomione** (jw.) |

**Weryfikacja (2026-10-29):** `pnpm check` exit 0 (format, lint, typy, jscpd, dependency-cruiser, design i backlog check; Vitest 86 plików / 396 testów, mobile 10 testów); wszystkie `scripts/test/*.test.sh` (protect-main, mobile, deploy, deploy-workflow, image, smoke, zap, staging-setup) exit 0; actionlint exit 0; `image-run.test.sh` 3 × ok; `image.sh scan` na obrazie aplikacji exit 0.

**Kryteria akceptacji:**

- AC1 — spełnione lokalnie: actionlint exit 0; `deploy.sh` / `smoke.sh` / `image.sh` / `zap.sh` `--dry-run` wypisują komendy dla `staging` i `<sha>` (oczekiwane wyjścia w `scripts/test/*.dry-run.txt`).
- AC2 — lokalnie: obraz z `Dockerfile` uruchamia migracje komendą z `release_command` i serwuje api + web pod jednym portem, `smoke.sh` przechodzi (test 4). Rung 4 (GHCR, Fly) — czeka.
- AC3 — czeka (rung 4). Mechanizm: `release_command` Fly; `deploy.sh` kończy się błędem, gdy `flyctl deploy` zwróci błąd.
- AC4 — lokalnie: `.zap/rules.tsv` z FAIL dla 10038 (CSP), 10035 (HSTS), 10020, 10021; każdy alert wysoki = porażka (`zap-high-alerts.mjs`); raport jako artefakt `zap-report` w `deploy.yml`. ZAP nie ma reguły dla Referrer-Policy — jej brak zatrzymuje `smoke.sh` (SEC2). Rung 4 — czeka.
- AC5 — spełnione: test 2a (region `fra`, `auto_stop_machines = "stop"`, `min_machines_running = 0`, healthcheck `/health`, `force_https`, `release_command`, `APP_ORIGIN`) i `IDLE_TIMEOUT_MS = 30_000` ≤ 60 s.
- AC6 — **nie spełnione**: wymaga zmiany `docs/architecture/deployment.md` (poza uprawnieniami implementera) i danych z pierwszego wdrożenia.
- SEC1 — spełnione lokalnie (test 3a: stary obraz → exit 1; obraz aplikacji → exit 0); w `deploy.yml` skan przed `push`, więc obraz z podatnością nie trafia do GHCR ani na Fly.
- SEC2 — test 3 (atrapa bez nagłówków nie przechodzi) i test 4 (prawdziwe api). Przekierowanie `http://` → `https://` sprawdzane tylko dla adresów https (rung 4 — czeka).
- SEC3 — częściowo: `staging-setup.sh` odrzuca `DATABASE_URL` bez `sslmode=require` lub spoza `eu-central-1` i wysyła go tylko do `fly secrets` przez stdin; `fly.staging.toml` w `fra`. Szyfrowanie w spoczynku u Neon i zrzuty — właściciel.
- SEC4 — spełnione: test 2b + actionlint.

**Decyzje do przejrzenia przez QA:**

- `apps/api/build.mjs`: drugi punkt wejścia `dist/db/migrate.js` (ta sama głębokość co `src/db/`, więc ścieżka do `drizzle/` działa po buildzie) — potrzebny dla `release_command` w obrazie bez zależności deweloperskich.
- Obraz: `node:24.21.0-trixie-slim` (tag + digest), npm i corepack usunięte w etapie uruchomieniowym, `pnpm deploy --prod` (bez `--legacy`: wersja legacy kopiowała cały wirtualny magazyn z zależnościami deweloperskimi).
- Job `image` w `ci.yml` (build, uruchomienie, Trivy na PR) — wcześniejsze wykrycie niż dopiero po merge; dołączony do `ci-ok`.
- `concurrency: deploy-staging` z `cancel-in-progress: false`: wdrożenie w toku nigdy nie jest anulowane; GitHub trzyma najwyżej jedno oczekujące, więc przy trzech szybkich merge'ach środkowy jest pomijany (wdraża się najnowszy).
- Trivy, ZAP, flyctl przypięte: `aquasec/trivy:0.76.1@sha256:790f…`, `ghcr.io/zaproxy/zaproxy:2.17.0@sha256:030d…`, `superfly/flyctl-actions/setup-flyctl@ed8efb3…` (v1.6) z flyctl 0.4.123.
- `TRUSTED_PROXIES` nie ustawione w `fly.staging.toml` (wartość do potwierdzenia przy pierwszym wdrożeniu, `deployment.md`).

**Po odpowiedzi właściciela (2026-10-29, przebieg 2 implementera):**

- `deploy.yml`: tymczasowy wyzwalacz `push` dla `deploy-test/**` (test 2b sprawdza `[main, "deploy-test/**"]`). **Warunek przed zamknięciem epiku E-01:** wyzwalacz wraca do `[main]` (wraz z testem 2b), gałęzie `deploy-test/*` usunięte — zapisane też w `deployment.md` („Środowiska”).
- `deployment.md`: dopisane potwierdzone fakty staging (aplikacja Fly `lista-staging`, Neon Frankfurt Free, `sslmode=require`, brak ograniczeń IP na Free) i warunek wyzwalacza. AC6 (limit bezczynności WebSocket, `TRUSTED_PROXIES`) — po pierwszym udanym wdrożeniu.
- Gałąź `deploy-test/T-010` wypchnięta za zgodą właściciela (bez gałęzi lokalnej: `git push origin HEAD:refs/heads/deploy-test/T-010`).

**Przewodnik warstwy (Step 8b):** `layers/infra.md` — „Gdzie jest kod” (T-010) i „Komendy” (testy skryptów, obraz, Trivy, smoke / ZAP, przygotowanie staging) uzupełnione faktami.

<!-- QA rounds are appended below by /qa-task -->

## Pytanie 1 (rozstrzygnięte 2026-10-29)

Lokalna część taska jest gotowa i zielona (rungi 1–2, obraz, Trivy i ZAP uruchomione lokalnie). Dalej (rung 4: testy 5 i 6, AC2–AC4, SEC2–SEC3, AC6) potrzebne są konta, sekrety i zgoda właściciela, a AC6 wymaga zmiany `docs/architecture/deployment.md`, której implementer nie może zrobić. **Czy właściciel wykona poniższe kroki i pozwala na przebiegi rungu 4 oraz zmianę `deployment.md`?**

Kroki właściciela (w tej kolejności):

1. Konto Fly.io (organizacja `personal`) i `fly auth login`; projekt Neon `lista-staging` (Free, region AWS Europe Central 1 / Frankfurt). Jeśli nazwa `lista-staging` na Fly jest zajęta — podać wolną (zmieni `app`, `APP_ORIGIN` w `apps/api/fly.staging.toml` i adresy w skryptach).
2. `STAGING_DATABASE_URL='<connection string Neon z sslmode=require>' bash scripts/staging-setup.sh --dry-run`, potem bez `--dry-run` (środowisko GitHub `staging`, aplikacja Fly, sekrety Fly przez stdin, token wdrożeń jednej aplikacji jako `FLY_API_TOKEN` w środowisku `staging`).
3. Zgoda na merge gałęzi epiku do `main` (albo `workflow_dispatch` `deploy.yml` na tej gałęzi) — pierwszy przebieg; potem pakiet `ghcr.io/tombraz/lista-zakupow` ustawić jako publiczny i uruchomić ponownie job `staging`.
4. Zgoda na gałąź testową z celowo błędną migracją i `workflow_dispatch` na staging (AC3), potem `bash scripts/smoke.sh staging`.
5. Zrzuty / linki: Neon — region i szyfrowanie danych w spoczynku (SEC3), `fly secrets list --app lista-staging` (same nazwy).
6. Do rozstrzygnięcia przy pierwszym wdrożeniu i zapisania w `deployment.md` (AC6): limit bezczynności WebSocket na Fly, faktyczne nazwy aplikacji, wartość `TRUSTED_PROXIES` dla proxy Fly. Uwaga: ograniczenie dostępu do bazy po IP (QA plan: „brak dostępu do bazy spoza Fly”) Neon daje tylko w płatnych planach — na Free ochroną jest hasło + TLS (`sslmode=require`).

**Rekomendacja:** właściciel wykonuje kroki 1–5, a wynik (linki do przebiegów, nazwy aplikacji, zrzuty) wpisuje pod `Answer:`; implementer w kolejnym przebiegu uruchamia rung 4, a zmianę `deployment.md` (AC6) robi właściciel albo wyraźnie na nią pozwala w odpowiedzi.

**Alternatywa:** podzielić task — T-010 kończy się na rungach 1–3 (stan obecny, do QA), a rung 4 i AC6 (wdrożenie, błędna migracja, ZAP na staging, zapis w `deployment.md`) przechodzą do nowego taska zależnego od T-010, wykonywanego razem z właścicielem.

Answer: Właściciel (2026-10-29): kroki 1–2 wykonane — konto Fly (org personal, flyctl zalogowany), aplikacja Fly lista-staging utworzona przez scripts/staging-setup.sh (bez --dry-run, przeszedł), sekrety Fly i FLY_API_TOKEN w środowisku GitHub staging ustawione; Neon lista-staging, plan Free, AWS Europe Central 1 (Frankfurt), gałąź production, połączenie bezpośrednie (bez -pooler), sslmode=require; IP restrictions: None set (Free). Pierwszy przebieg deploy.yml: NIE merge do main i NIE workflow_dispatch (na main nie ma workflow, więc dispatch nie zadziała) — zamiast tego tymczasowy wyzwalacz push w deploy.yml dla gałęzi epiku albo dedykowanej gałęzi deploy-test/T-010; przed zamknięciem epiku wyzwalacz ma wrócić do samego main (zapisz to jako warunek). Zgoda na gałąź testową z celowo błędną migracją (AC3) i na push gałęzi. Zgoda na edycję docs/architecture/deployment.md (AC6). Po pierwszym przebiegu właściciel ustawi pakiet GHCR jako publiczny i dostarczy zrzuty SEC3 — poproś o to przez Open question, podając link do przebiegu.

## Open question

Pierwszy przebieg `deploy.yml` z gałęzi `deploy-test/T-010`: https://github.com/tombraz/lista-zakupow/actions/runs/40872833932 — job `image` przeszedł (build, Trivy, obraz `ghcr.io/tombraz/lista-zakupow:1bfaad41658c7c6c598094e528a9b14166954439` w GHCR), job `staging` zatrzymał się na „Error: no access token available”: **środowisko GitHub `staging` nie ma sekretu `FLY_API_TOKEN`** (`gh api repos/tombraz/lista-zakupow/environments/staging/secrets` → `total_count: 0`; sekretów repozytorium też brak). Ostatni krok `staging-setup.sh` (`flyctl tokens create deploy … | gh secret set FLY_API_TOKEN --env staging`) najwyraźniej nie zapisał sekretu. **Czy właściciel ustawi sekret, upubliczni pakiet i dostarczy zrzuty SEC3?**

Kroki właściciela:

1. `flyctl tokens create deploy --app lista-staging --expiry 8760h | gh secret set FLY_API_TOKEN --env staging --repo tombraz/lista-zakupow`, potem sprawdzić `gh secret list --env staging` (ma pokazać `FLY_API_TOKEN`).
2. Pakiet `ghcr.io/tombraz/lista-zakupow` (już istnieje) → Package settings → Change visibility → Public.
3. Ponowić przebieg: `gh run rerun 40872833932 --failed` (albo „Re-run failed jobs” w GitHub).
4. Zrzuty SEC3: Neon — region i szyfrowanie danych w spoczynku (źródło, data); `fly secrets list --app lista-staging` (same nazwy).

**Rekomendacja:** właściciel wykonuje kroki 1–4 i wpisuje pod `Answer:` link do ponowionego przebiegu (albo „ponowione”) i zrzuty; implementer w kolejnym przebiegu sprawdza wynik, uruchamia `smoke.sh staging`, test błędnej migracji (AC3, gałąź `deploy-test/T-010-zla-migracja`) i uzupełnia AC6 w `deployment.md`.

**Alternatywa:** właściciel pozwala implementerowi samemu utworzyć token wdrożeń i ustawić sekret (`flyctl tokens create deploy` + `gh secret set`, komendy z reguły ask) oraz ponowić przebieg; upublicznienie pakietu i zrzuty SEC3 i tak zostają po stronie właściciela.
