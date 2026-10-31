---
id: T-002
title: CI z bramkami jakości i bezpieczeństwa
epic: E-01
story: S-01-01
status: done           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-001]    # inline list only, e.g. [T-001, T-004]; only real blockers
size: M                # S | M (L must be split)
layers: [infra]
requirements: [N-02, N-04]
threats: [TH-15, TH-20, TH-22, TH-23]
screens: []
---

# T-002 CI z bramkami jakości i bezpieczeństwa

## Goal

Każdy PR (także draft) i push do `main` uruchamia CI z bramkami z `testing-strategy.md`, a zbiorczy check `ci-ok` blokuje merge, gdy którakolwiek zawiedzie. Działają CodeQL, `pnpm audit`, Dependabot i secret scanning; właściciel ma skrypt `gh` do ochrony `main`.

## Demo

1. PR z gałęzi z drobną zmianą: w zakładce Checks widać joby per warstwa i zielony `ci-ok` oraz `codeql`.
2. Gałąź z celowo zepsutym testem (lub błędem lint): `ci-ok` czerwony, przycisk merge zablokowany (po uruchomieniu skryptu ochrony przez właściciela).
3. Gałąź z dodaną zależnością z podatnością high: `ci-ok` czerwony przez `pnpm audit`.
4. Zmiana tylko w `docs/`: uruchamiają się tylko joby „zawsze” (format, backlog check, audit), `ci-ok` zielony.

## Context

- `docs/architecture/pipeline.md` — etapy 1–3, „Joby CI per warstwa”, „Pokrycie zagrożeń `ci`”, kandydaci na taski infra 1–2.
- `.claude/skills/ci-cd/references/github-actions.md` — minimalne `permissions`, akcje przypięte do SHA, `concurrency`, `timeout-minutes`, drabina weryfikacji.
- `docs/architecture/testing-strategy.md` — „Bramki CI”.
- Depends on: T-001 — komendy lint, typów, jakości, testów, build i E2E, które CI wywołuje.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given workflow w `.github/workflows/`, when uruchomię `actionlint` (obraz `rhysd/actionlint` z przypiętą wersją), then nie ma błędów; job `infra` w CI robi to samo. — verified by: rung 1 (lokalnie) + przebieg CI
- [x] AC2: Given PR zmieniający `apps/api/**`, when CI się zakończy, then przeszły joby: format, lint, typy, jakość (jscpd, złożoność, dependency-cruiser), unit, integracja (Testcontainers), build, sprawdzenie migracji na pustej bazie, E2E web z axe; `ci-ok` zielony. — verified by: rung 3, link do przebiegu
- [x] AC3: Given gałąź z celowo zepsutym testem, when CI się zakończy, then `ci-ok` jest czerwony. — verified by: rung 3, link do przebiegu (gałąź usunięta po teście)
- [x] AC4: Given PR zmieniający tylko `docs/**`, when CI się zakończy, then joby warstw są pominięte, a `ci-ok` zielony (pominięty job nie blokuje). — verified by: rung 3
- [x] AC5: Given każdy PR, when CI się zakończy, then uruchomiły się `node scripts/backlog-check.mjs` i `node scripts/design-check.mjs --scan apps/web/src apps/mobile/src --allow generated`. — verified by: rung 3
- [x] AC6: Given skrypt ochrony repo (`gh`), when właściciel go uruchomi, then `main` wymaga PR, checków `ci-ok` i `codeql`, blokuje force push i usuwanie; skrypt ma tryb `--dry-run` wypisujący komendy. — verified by: rung 2 (`--dry-run` lokalnie) + zrzut ustawień od właściciela
- [x] SEC1 (TH-22): Given zależność z podatnością high lub critical, when CI się uruchomi, then `pnpm audit --audit-level high` zatrzymuje `ci-ok`. — verified by: rung 3 na gałęzi testowej
- [x] SEC2 (TH-22): Given workflow, when sprawdzę ich treść, then każda akcja jest przypięta do SHA, `permissions: contents: read` domyślnie i tylko niezbędne uprawnienia per job; `dependabot.yml` obejmuje npm i github-actions (co tydzień, grupowane). — verified by: przegląd + actionlint
- [x] SEC3 (TH-22, TH-23): Given instrukcja w `SECURITY.md` i lista kroków dla właściciela, when właściciel włączy secret scanning z push protection i private vulnerability reporting, then push testowego sekretu (np. przykładowy klucz z dokumentacji GitHub) jest odrzucony. — verified by: rung 3, zrzut od właściciela
- [x] SEC4 (TH-15, TH-20): Given kod z `dangerouslySetInnerHTML` albo `sql.raw` z danymi, when CI uruchomi lint, then `ci-ok` jest czerwony; CodeQL (JavaScript/TypeScript) działa na PR i co tydzień. — verified by: rung 3 na gałęzi testowej

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- przebieg pipeline'u (job `ci-ok`) i skrypt ochrony repo (`--dry-run`)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | actionlint na pustym / niepoprawnym workflow daje błąd, na docelowym przechodzi | static | actionlint (Docker) | AC1 |
| 2 | skrypt ochrony `--dry-run` wypisuje oczekiwane komendy `gh` | script | bash + porównanie wyjścia | AC6 |
| 3 | przebieg na PR ze zmianą api — wszystkie joby zielone | real run | GitHub Actions | AC2, AC5 |
| 4 | przebieg na gałęzi z zepsutym testem — `ci-ok` czerwony | real run | GitHub Actions | AC3 |
| 5 | przebieg na PR tylko z `docs/**` | real run | GitHub Actions | AC4 |
| 6 | gałąź z podatną zależnością i z `dangerouslySetInnerHTML` — czerwony | real run | GitHub Actions | SEC1, SEC4 |

**Run:** `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:<wersja>`; skrypt ochrony z `--dry-run`; przebiegi na PR (push gałęzi wymaga zgody właściciela — pytać przez normalny mechanizm pytań)

**Mocks:** brak.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** PR z forka (sekrety niedostępne, CI nadal działa); zmiana `.github/**` uruchamia wszystkie joby; czas całego CI (cel: < 15 min) i cache pnpm.
- **Design states:** —
- **Platforms / devices:** `ubuntu-latest` (Docker dla Testcontainers).
- **Accessibility:** skan axe w E2E jest częścią bramki (czerwony przy naruszeniu — sprawdzić celowym naruszeniem).
- **Security / privacy:** brak sekretów w logach przebiegów; `permissions` minimalne; brak `pull_request_target`; akcje przypięte do SHA.
- **Regression:** komendy z przewodników warstw (T-001) działają tak samo lokalnie i w CI.

## Implementation notes

- Joby per warstwa przez `dorny/paths-filter` wg tabeli w `pipeline.md`; `ci-ok` zbiera wynik wszystkich uruchomionych jobów (pominięte = OK, nieudane = czerwony).
- E2E web w CI: Postgres jako service container, api serwuje build web (jak na produkcji).
- Job mobile jest dodawany w T-003; tu tylko miejsce w filtrze ścieżek.
- Trivy na obrazie API — T-010 (obraz powstaje tam).
- Ustawienia repozytorium zmienia właściciel: przygotuj skrypt i listę kroków, nie uruchamiaj ich.
- Raport pokrycia jako artefakt, bez progu blokującego.
- Przebiegi testowe (decyzja właściciela, 2026-10-27):
  - `ci.yml` bez filtra `branches:` dla `pull_request` (każdy PR, także draft) + `push` do `main`.
  - Gałęzie tymczasowe `ci-test/T-002-<przypadek>` (np. `ci-test/T-002-broken-test`, `-vulnerable-dep`, `-dangerous-html`, `-docs-only`) odgałęzione od gałęzi epiku; PR-y testowe mają bazę **`epic/E-01-szkielet-i-wspolna-lista`**, nie `main`. Po teście PR zamknięty bez merge'a, gałąź usunięta. Dopisać tę konwencję do „Git workflow” w `tech-stack.md` (gałęzie tymczasowe do weryfikacji CI).
  - Demo 2 / AC6 (blokada merge): po uruchomieniu skryptu ochrony przez właściciela jeden **draft PR do `main`** z `ci-test/T-002-broken-test` — zrzut zablokowanego przycisku merge, PR zamknięty bez merge'a. Alternatywnie dowodem jest wymagany `ci-ok` na draft PR epiku.
  - CodeQL jako workflow w repo (advanced setup); „Default setup” w ustawieniach repo wyłączony przez właściciela — inaczej workflow CodeQL się z nim zderza. Nazwa checka `codeql` stała, bo wymaga jej ochrona `main`.
- Z QA T-001 (uwagi przekazane do tego tasku):
  - Tag obrazu `postgres:17.11-alpine` w jednym źródle: dziś jest w `docker-compose.yml`, `apps/api/test/database-constants.ts` i `apps/web/e2e/server.ts` (ten nie używa `POSTGRES_IMAGE`), a service container w CI byłby czwartym miejscem.
  - Równoległość E2E na Linuksie: T-001 ustawiło 1 worker na Windows (zamieranie API przy wielu workerach). Sprawdzić w CI, czy równoległe workery są stabilne, i zapisać decyzję w przewodniku web.
  - „Pułapki” w przewodniku infra: (a) E2E na Windows z 1 workerem i dlaczego; (b) porty hosta w Compose są stałe (5442, 1025, 8025), więc drugi klon na tej samej maszynie nie wystartuje `services:up`, gdy działa pierwszy; (c) przerwane przebiegi zostawiały kontenery Testcontainers: sprzątanie (Ryuk włączony, w CI bez `TESTCONTAINERS_RYUK_DISABLED`) plus komenda `docker ps --filter label=org.testcontainers=true`.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Wszystkie przebiegi 2026-10-27, commit epiku `16f0174`.

**TDD plan**

| # | Test | Red (przed) | Green (po) |
| --- | --- | --- | --- |
| 1 | actionlint (`rhysd/actionlint:1.7.12@sha256:b1934ee5…`) | workflow z `${{ github.event.pull_request.title }}` w `run:` → exit 1: `"github.event.pull_request.title" is potentially untrusted … [expression]` | `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:… ` → exit 0; job `infra` w CI zielony (run 40521770039) |
| 2 | `bash scripts/test/protect-main.test.sh` (porównanie z `scripts/test/protect-main.dry-run.txt` + odrzucenie złej nazwy repo, exit 2) | stub `not implemented`: `FAIL dry-run wypisuje komendy gh` (diff 13 linii), `FAIL odrzuca niepoprawną nazwę repozytorium (exit 2)` (było 1) | `ok` ×2, exit 0; także w jobie `infra` w CI |
| 3 | PR ze zmianą tylko `apps/api/src/server.ts` (#2) | — (pierwszy przebieg workflow) | wszystkie joby warstw zielone, `infra` pominięty, `ci-ok` zielony: [run 40523300955](https://github.com/tombraz/lista-zakupow/actions/runs/40523300955); epik PR #1 (zmiana `.github/**` → wszystkie joby): [run 40521770039](https://github.com/tombraz/lista-zakupow/actions/runs/40521770039), `codeql` [run 40521769938](https://github.com/tombraz/lista-zakupow/actions/runs/40521769938) |
| 4 | PR z zepsutym testem (#3, `health.test.ts` 200→201) | — | job `tests`: `AssertionError: expected 200 to be 201`, `ci-ok` czerwony: [run 40523320866](https://github.com/tombraz/lista-zakupow/actions/runs/40523320866) |
| 5 | PR tylko z `docs/ci-test.md` (#4) | — | `always` zielony, `static/tests/migrations/build/e2e-web/infra` pominięte, `ci-ok` zielony: [run 40523340926](https://github.com/tombraz/lista-zakupow/actions/runs/40523340926) |
| 6a | PR z `lodash@4.17.20` (#6) | lokalnie `pnpm audit --audit-level high` → `2 high`, exit 1 | krok „Skan zależności”: `Severity: 4 moderate | 2 high`, `ci-ok` czerwony: [run 40523373127](https://github.com/tombraz/lista-zakupow/actions/runs/40523373127) |
| 6b | PR z `dangerouslySetInnerHTML` i `sql.raw` (#5) | lokalnie ESLint: 3 błędy | job `static`: `sql.raw jest zakazany (TH-20)`, `react/no-danger`, `dangerouslySetInnerHTML jest zakazany (TH-15)`; `ci-ok` czerwony: [run 40523356573](https://github.com/tombraz/lista-zakupow/actions/runs/40523356573) |

Testy 3–6 to „real run” (rung 3); nie mają fazy red przed workflow, który dopiero je umożliwia — dowodem bramki jest para zielony (#2, #4) / czerwony (#3, #5, #6).

**Kryteria**

- AC1: test 1 lokalnie + job `infra` (run 40521770039).
- AC2: test 3 — format, lint, typy, jakość (jscpd, złożoność w ESLint, dependency-cruiser), unit + integracja (Testcontainers) z raportem pokrycia (artefakt `coverage`), build, migracje na pustej bazie (`docker compose up postgres` + `db:migrate`), E2E web z axe — zielone. Czas całego CI ~1,5 min.
- AC3: test 4.
- AC4: test 5.
- AC5: w każdym PR (#1–#6) job `always` uruchomił `node scripts/backlog-check.mjs` i `node scripts/design-check.mjs --scan apps/web/src apps/mobile/src --allow generated`.
- AC6: rung 2 zielony (test 2). Właściciel uruchomił `bash scripts/protect-main.sh` 2026-10-27; odczyt API: checki `ci-ok`, `codeql`, PR wymagany, `enforce_admins: true`, force push i usuwanie wyłączone; zrzut `evidence/T-002/ac6-ochrona-main.png`. Demo 2: PR #7 do `main` z `ci-test/T-002-broken-test` (oznaczony jako gotowy do review): `tests` czerwony, wymagany `ci-ok` czerwony ([run 40526979533](https://github.com/tombraz/lista-zakupow/actions/runs/40526979533)), `mergeStateStatus: BLOCKED`, „Merging is blocked due to failing merge requirements” — zrzut `evidence/T-002/demo2-merge-zablokowany.png`; PR zamknięty bez merge'a. Pierwotnie czekało na: uruchomienie `bash scripts/protect-main.sh` (kroki w `SECURITY.md`) i zrzut ustawień `main`; Demo 2 — draft PR do `main` z gałęzi `ci-test/T-002-broken-test` (gałąź zostawiona na ten cel).
- SEC1: test 6a.
- SEC2: przegląd — każda akcja przypięta do SHA (checkout v7.0.1, pnpm/action-setup v6.1.0, setup-node v7.1.0, paths-filter v4.0.3, upload-artifact v7.0.2, codeql-action v4.39.1; SHA sprawdzone przez `gh api repos/<akcja>/commits/<tag>`), actionlint w obrazie przypiętym digestem; `permissions: contents: read` na górze obu workflow, `pull-requests: read` tylko w `changes`, `security-events: write` tylko w `codeql`; brak `pull_request_target`; `dependabot.yml`: npm + github-actions (także `.github/actions/*`), co tydzień, grupowane. actionlint czysty.
- SEC3: ustawienia włączone (odczyt API: secret scanning i push protection `enabled`, private vulnerability reporting `true`, alerty Dependabot 204, CodeQL default setup `not-configured`; zrzuty `evidence/T-002/sec3-advanced-security.png`, `sec3-code-security.png`). „Dependabot version updates” w ustawieniach pokazuje „Create dependabot.yml”, bo plik jest jeszcze tylko na gałęzi epiku. Test push protection (właściciel, 2026-10-27): push fine-grained PAT na `ci-test/T-002-secret` odrzucony — `GH013: Repository rule violations … GITHUB PUSH PROTECTION – Push cannot contain secrets (GitHub Personal Access Token, secret-test.txt:1)`; zrzuty `evidence/T-002/sec3-push-odrzucony-1.png`, `-2.png`. Pierwsza próba przeszła, bo plik zapisany przez `echo >` w Windows PowerShell 5.1 był w UTF-16 (BOM `ff fe`), którego GitHub nie skanuje; token unieważniony, gałąź usunięta, ostrzeżenie dopisane do `SECURITY.md` (krok 4). Instrukcja: `SECURITY.md` (zgłaszanie + kroki 1–4); secret scanning z push protection i private vulnerability reporting włącza `scripts/protect-main.sh`; test push protection opisany w `SECURITY.md`, krok 4.
- SEC4: test 6b (lint) + CodeQL JavaScript/TypeScript na PR, push do `main` i `cron: "17 3 * * 1"` (`security.yml`), check `codeql` zielony na #1–#6.

**Uwagi z QA T-001**

- Tag `postgres:17.11-alpine` w jednym źródle: `docker-compose.yml`; `apps/api/test/database-constants.ts` czyta go stamtąd, `apps/web/e2e/server.ts` importuje `POSTGRES_IMAGE`, job `migrations` używa `docker compose`. Decyzja właściciela (2026-10-27): bez service containera w CI (odstępstwo od notatki „Postgres jako service container” i `pipeline.md` etap 2 — do aktualizacji przy przeglądzie pipeline'u).
- Równoległość E2E na Linuksie: 2 workery w CI, 5 przebiegów stabilnych — zapisane w `layers/web.md` („Pułapki”).
- „Pułapki” infra (a)–(c) dopisane w `layers/infra.md`.

**Weryfikacja lokalna (ten przebieg):** `pnpm check` zielony (format, lint, typy, jakość, design-check, backlog-check, 24 testy), `pnpm test:e2e` 4/4, `pnpm test:coverage` (65,8 % instrukcji), `pnpm audit --audit-level high` exit 0.

**Przewodniki warstw (Step 8b):** `layers/infra.md` — „Gdzie jest kod”, „Komendy”, „Pułapki”; `layers/web.md` — „Pułapki”. `tech-stack.md` — gałęzie `ci-test/`, `@vitest/coverage-v8` (zatwierdził właściciel).

**Do uwagi QA**

- CodeQL zgłosił alert high `js/missing-rate-limiting` w `apps/api/src/modules/health/http/routes.ts:9` (`/health/ready` dotyka bazy bez limitu; kod T-001). Wymagany check `codeql` (job) przechodzi; czerwony jest tylko informacyjny check „CodeQL” z GitHub Advanced Security na PR #1. Poza zakresem T-002. Decyzja właściciela (2026-10-27): limit dodaje T-004 razem z limitami MC-04 (kryterium SEC8, test #9 w planie TDD T-004); alert zostaje otwarty do tego czasu.
- PR-y testowe #2–#7 zamknięte bez merge'a, wszystkie gałęzie `ci-test/T-002-*` usunięte (lokalnie i zdalnie).
- Nie dodano jobu „build obrazu (bez push)” z tabeli warstwy backend — `Dockerfile` powstaje w T-010.


<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-27)

Verdict: pass

Zakres: commity `16f0174`, `3ea2cb4`, `a9bbf49`, `83840fc`, `4d54a8f`, `af3fab1`, `625caf8` (diff `fb80790..625caf8`).

**Reprodukcja (lokalnie, Windows + Docker Desktop):** `pnpm install --frozen-lockfile` bez zmian w lockfile; `pnpm check` zielony (format, lint, typy, jscpd, dependency-cruiser, design-check 0 błędów, backlog-check, 24/24 testy); `pnpm test:e2e` 4/4; `pnpm audit --audit-level high` exit 0 (1 moderate); `bash scripts/test/protect-main.test.sh` 2× `ok`; actionlint `1.7.12@sha256:b1934ee5…` exit 0.

**Spot-checki (wszystkie przywrócone, `git status` czysty):**

- `enforce_admins:false` w `scripts/protect-main.sh` → test 2 `FAIL dry-run wypisuje komendy gh` z diffem, exit 1.
- kopia `ci.yml` z `run: echo "${{ github.event.pull_request.title }}"` → actionlint `[expression] … potentially untrusted`, exit 1.
- `<img src="/x.png" />` w `StartScreen.tsx` → E2E czerwone, axe `image-alt` we wszystkich 4 testach (bramka a11y z QA planu gryzie).

**Przebiegi GitHub (sprawdzone przez `gh run view`, nie z Evidence):** 40523300955 (api) — wszystkie joby warstw `success`, `infra` skipped, `ci-ok` success; 40523320866 (broken test) — `tests` failure → `ci-ok` failure; 40523340926 (docs) — tylko `changes` + `always`, reszta skipped, `ci-ok` success; 40523373127 — krok „Skan zależności”: `high │ Command Injection in lodash` → `ci-ok` failure; 40523356573 — `static`: `sql.raw jest zakazany (TH-20)`, `react/no-danger`, `dangerouslySetInnerHTML jest zakazany (TH-15)` → `ci-ok` failure; 40526979533 (PR #7 do `main`) — `ci-ok` failure. PR #1 (bieżący head epiku): `ci-ok` i `codeql` pass. PR-y #2–#7 zamknięte, zero zdalnych gałęzi `ci-test/*`.

**Ustawienia repo (odczyt API):** ochrona `main`: checki `ci-ok` i `codeql` przypięte do `app_id` 15368 (GitHub Actions), `enforce_admins: true`, PR wymagany, force push i usuwanie wyłączone; secret scanning i push protection `enabled`; private vulnerability reporting `enabled: true`; CodeQL default setup `not-configured`.

**Kryteria**

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | actionlint lokalnie (zielony + spot-check czerwony); job `infra` success w 40521770039 i 40526979533 |
| AC2 | pass | run 40523300955: static (lint, typy, jakość), tests (unit + integracja Testcontainers, artefakt `coverage`), migrations, build, e2e-web (axe), `ci-ok` |
| AC3 | pass | run 40523320866 i 40526979533 |
| AC4 | pass | run 40523340926 |
| AC5 | pass | job `always` w `ci.yml` bez `needs`/`if` (uruchamia się zawsze); obecny i `success` we wszystkich sprawdzonych przebiegach |
| AC6 | pass | test 2 + spot-check; odczyt API ochrony `main`; zrzut `demo2-merge-zablokowany.png` |
| SEC1 | pass | run 40523373127, log kroku audytu |
| SEC2 | pass | przegląd: 6 akcji przypiętych do SHA + obraz actionlint digestem; `permissions: contents: read` na górze obu workflow, `pull-requests: read` tylko `changes`, `security-events: write` tylko `codeql`; brak `pull_request_target`, brak `secrets.*`; `dependabot.yml` npm + github-actions (`/`, `/.github/actions/*`), weekly, grupy |
| SEC3 | pass (zrzut właściciela) | ustawienia potwierdzone przez API; samego odrzuconego pushu nie powtarzałem (wymaga utworzenia prawdziwego tokenu przez właściciela) — dowód: zrzuty `sec3-push-odrzucony-*.png` z komunikatem `GH013 … Push cannot contain secrets` |
| SEC4 | pass | run 40523356573 (lint); `security.yml`: `pull_request`, push `main`, `cron: "17 3 * * 1"`, check `codeql` pass na PR #1 |

**Ustalenia**

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | docs | `pipeline.md` („Joby CI per warstwa”, db) nadal opisuje service container Postgres i „build obrazu (bez push)” w backendzie; implementacja używa `docker compose` (decyzja właściciela) i build obrazu jest w T-010. Evidence odkłada aktualizację „do przeglądu pipeline'u”, bez taska. | `docs/architecture/pipeline.md:50-51` vs `ci.yml` job `migrations` | Poprawić wiersz db w `pipeline.md` teraz albo dopisać to do notatek T-010. |
| 2 | minor | docs | `tech-stack.md` „Git workflow”: „required check ci-ok” — wymagany jest też `codeql`. `layers/infra.md` „Planowane” nadal wymienia `SECURITY.md`, który już istnieje. | `docs/architecture/tech-stack.md` (Main branch), `layers/infra.md:31` | `required checks ci-ok, codeql`; usunąć `SECURITY.md` z „Planowane”. |
| 3 | note | struktura | `apps/web/e2e/server.ts` importuje `apps/api/test/database-constants.ts` (kod testowy innej aplikacji), a ten parsuje `docker-compose.yml` wyrażeniem regularnym (pierwszy obraz `postgres:`). Działa i daje jedno źródło tagu; dependency-cruiser nie protestuje. | diff `16f0174` | Przy kolejnej zmianie można przenieść do wspólnego modułu testowego (np. `packages/test-utils`), jeśli dojdzie trzeci konsument. |
| 4 | note | security | Alert CodeQL `js/missing-rate-limiting` (`/health/ready`) otwarty; informacyjny check „CodeQL” (GHAS) jest czerwony na PR #1, wymagany `codeql` zielony. Przekazane do T-004 (SEC8) decyzją właściciela. | `gh pr checks 1` | Zamknąć alert w T-004. |
| 5 | note | security | „Dependabot security updates” wyłączone (alerty włączone, wersjonowanie co tydzień przez `dependabot.yml`). Kryteria tego nie wymagają. | `security_and_analysis.dependabot_security_updates: disabled` | Opcjonalnie włączyć w `protect-main.sh` — szybsze PR-y dla podatności. |
| 6 | note | QA plan | PR z forka niesprawdzony w praktyce (brak forka). Z analizy: workflow nie używa `secrets.*` ani `pull_request_target`, więc z forka działa tak samo, z tokenem tylko do odczytu. | `grep secrets\. .github` — brak | — |
| 7 | note | DoD | Pole „Definition of done” w tasku ma niezaznaczone checkboxy (spełnione wg weryfikacji wyżej). | treść taska | Autor zaznacza przy przekazaniu do QA. |

Czas CI ~1,5 min (cel < 15 min), cache pnpm przez `setup-node` `cache: pnpm`. Brak sekretów w logach (workflow nie używa żadnych).
