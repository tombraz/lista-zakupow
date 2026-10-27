---
id: T-002
title: CI z bramkami jakości i bezpieczeństwa
epic: E-01
story: S-01-01
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given workflow w `.github/workflows/`, when uruchomię `actionlint` (obraz `rhysd/actionlint` z przypiętą wersją), then nie ma błędów; job `infra` w CI robi to samo. — verified by: rung 1 (lokalnie) + przebieg CI
- [ ] AC2: Given PR zmieniający `apps/api/**`, when CI się zakończy, then przeszły joby: format, lint, typy, jakość (jscpd, złożoność, dependency-cruiser), unit, integracja (Testcontainers), build, sprawdzenie migracji na pustej bazie, E2E web z axe; `ci-ok` zielony. — verified by: rung 3, link do przebiegu
- [ ] AC3: Given gałąź z celowo zepsutym testem, when CI się zakończy, then `ci-ok` jest czerwony. — verified by: rung 3, link do przebiegu (gałąź usunięta po teście)
- [ ] AC4: Given PR zmieniający tylko `docs/**`, when CI się zakończy, then joby warstw są pominięte, a `ci-ok` zielony (pominięty job nie blokuje). — verified by: rung 3
- [ ] AC5: Given każdy PR, when CI się zakończy, then uruchomiły się `node scripts/backlog-check.mjs` i `node scripts/design-check.mjs --scan apps/web/src apps/mobile/src --allow generated`. — verified by: rung 3
- [ ] AC6: Given skrypt ochrony repo (`gh`), when właściciel go uruchomi, then `main` wymaga PR, checków `ci-ok` i `codeql`, blokuje force push i usuwanie; skrypt ma tryb `--dry-run` wypisujący komendy. — verified by: rung 2 (`--dry-run` lokalnie) + zrzut ustawień od właściciela
- [ ] SEC1 (TH-22): Given zależność z podatnością high lub critical, when CI się uruchomi, then `pnpm audit --audit-level high` zatrzymuje `ci-ok`. — verified by: rung 3 na gałęzi testowej
- [ ] SEC2 (TH-22): Given workflow, when sprawdzę ich treść, then każda akcja jest przypięta do SHA, `permissions: contents: read` domyślnie i tylko niezbędne uprawnienia per job; `dependabot.yml` obejmuje npm i github-actions (co tydzień, grupowane). — verified by: przegląd + actionlint
- [ ] SEC3 (TH-22, TH-23): Given instrukcja w `SECURITY.md` i lista kroków dla właściciela, when właściciel włączy secret scanning z push protection i private vulnerability reporting, then push testowego sekretu (np. przykładowy klucz z dokumentacji GitHub) jest odrzucony. — verified by: rung 3, zrzut od właściciela
- [ ] SEC4 (TH-15, TH-20): Given kod z `dangerouslySetInnerHTML` albo `sql.raw` z danymi, when CI uruchomi lint, then `ci-ok` jest czerwony; CodeQL (JavaScript/TypeScript) działa na PR i co tydzień. — verified by: rung 3 na gałęzi testowej

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

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
