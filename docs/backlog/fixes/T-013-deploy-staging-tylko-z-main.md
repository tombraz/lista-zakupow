---
id: T-013
title: "Wdrożenie na staging tylko z main (usunięcie deploy-test/**)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change   # bug | small-change
severity: high       # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
depends_on: [T-010]
layers: [infra]
requirements: [N-03]
threats: []
screens: []
related_tasks: [T-010]
---

# T-013 Wdrożenie na staging tylko z main (usunięcie deploy-test/**)

## Report

- **Actual:** `.github/workflows/deploy.yml:9-11` nadal wdraża na staging z gałęzi `deploy-test/**` z sekretami środowiska staging, a `ci.yml` na tych gałęziach się nie uruchamia — nieprzetestowany kod może trafić na staging. Ścieżka „merge do `main` → staging” (T-010 AC2) nie była uruchomiona.
- **Expected:** Staging wdraża wyłącznie commit z `main` (oraz ręczny `workflow_dispatch`), komentarz TYMCZASOWE usunięty — source: komentarz w `deploy.yml` („Przed zamknięciem epiku E-01 wraca do [main]”), `layers/infra.md` „Konwencje”, T-010 AC2
- **Steps to reproduce:**
  1. `git push origin HEAD:deploy-test/x` → uruchamia się `Deploy` na staging.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #S1, #P8.

## Acceptance criteria

- [ ] AC1: Given push na gałąź `deploy-test/**`, when GitHub ocenia wyzwalacze, then workflow `Deploy` się nie uruchamia; push do `main` nadal go uruchamia. — verified by: `scripts/test/deploy-workflow.test.sh` (sprawdza `on.push.branches == [main]`) + actionlint
- [ ] AC2: Given workflow w `.github/workflows/` z komentarzem `TYMCZASOWE`, when `pnpm check` / CI, then sprawdzenie go odrzuca. — verified by: test skryptu (red na kopii z komentarzem)
- [ ] AC3: No regression in: deploy z `main` po merge PR epiku (T-010 AC2), `workflow_dispatch`.

## TDD plan

**Seam:** konfiguracja `on:` w `deploy.yml`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `deploy-workflow.test.sh` „wyzwalacze: push tylko na main, workflow_dispatch” — cały blok `on:` bez komentarzy | rung 2 | bash | AC1 |
| 2 | `workflow-check.test.sh` „bieżące .github/workflows przechodzą” | rung 2 | bash | AC2 |
| 3 | `workflow-check.test.sh` „kopia ze znacznikiem TYMCZASOWE odrzucona” + „komunikat wskazuje plik i linię” | rung 2 | bash | AC2 |
| 4 | actionlint na wszystkich workflow | rung 1 | actionlint 1.7.12 | AC1, AC3 |

**Run:** `bash scripts/test/deploy-workflow.test.sh && bash scripts/test/workflow-check.test.sh`

## QA plan

- **Regression:** deploy z `main` po merge PR epiku (T-010 AC2), `workflow_dispatch`
- **Edge cases:** znacznik `TYMCZASOWE` w dowolnym pliku `*.yml`/`*.yaml` w `.github/workflows/` (nie tylko `deploy.yml`); dodatkowa gałąź dopisana w innej linii bloku `on:` (test porównuje cały blok, nie jedną linię); `workflow_dispatch` dalej obecny
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

T-010 dodał świadomie tymczasowy wyzwalacz `deploy-test/**` (decyzja właściciela: na `main` nie było jeszcze `deploy.yml`), a warunek „wraca do `[main]` przed zamknięciem E-01” zapisano tylko jako komentarz i zdanie w `deployment.md` / `UAT.md`, bez taska ani automatycznej kontroli. Istniejący test `deploy-workflow.test.sh` utrwalał stan tymczasowy (oczekiwał `[main, "deploy-test/**"]`), więc nic nie mogło się zaczerwienić; żadna kontrola nie szukała znaczników tymczasowości w workflow.

Konsekwencja poprawki: bez środowisk podglądowych staging dostaje kod epiku dopiero po merge do `main` — zgodnie z `tech-stack.md` („Git workflow”: security review i UAT na staging po merge, przed akceptacją produkcji). Warunek w `UAT.md` zaktualizowany; pierwszy przebieg „merge → staging” (T-010 AC2) nastąpi przy merge PR epiku.

Inne wystąpienia: brak innych `TYMCZASOWE` w `.github/workflows/` (grep); w kodzie/dokumentach odwołania do `deploy-test` tylko historyczne (T-010, story, progress) — bez zmian.

## Evidence

- Red (przed poprawką, 2026-10-29): `bash scripts/test/deploy-workflow.test.sh` → `FAIL wyzwalacze: push tylko na main, workflow_dispatch` (`<     branches: [main]` / `>     branches: [main, "deploy-test/**"]`), exit 1. `bash scripts/test/workflow-check.test.sh` (ze skryptem, przed edycją `deploy.yml`) → `FAIL bieżące .github/workflows przechodzą` (oczekiwane 0, jest 1): `.github\workflows\deploy.yml:9: TYMCZASOWE — # TYMCZASOWE (T-010, …)`.
- Green: oba testy exit 0 (12 × ok, 3 × ok); pozostałe testy skryptów (`protect-main`, `mobile`, `deploy`, `image`, `smoke`, `zap`, `staging-setup`) ok; actionlint 1.7.12 exit 0; `pnpm check` zielony (vitest 87 plików / 397 testów, jest 10 testów, backlog-check bez błędów, workflow-check OK); `pnpm build` zielony.
- Prawdziwy przebieg `deploy.yml` z `main` (AC3, rung 4) możliwy dopiero po merge PR epiku — krok w `UAT.md` „Przed UAT”.

## Prevention

Co by zapobiegło: automatyczna kontrola tymczasowych obejść w workflow. Wdrożone w tym tasku (propozycja z `docs/reviews/E-01-2026-10-29-1.md`, „Proposals”): `scripts/workflow-check.mjs` w `pnpm check` i w jobie `always` CI (bez filtra ścieżek, więc działa na każdym PR) — każde przyszłe tymczasowe obejście w workflow oznaczone `TYMCZASOWE` zatrzyma PR do `main`. Do decyzji właściciela: wpis w `layers/infra.md` „Pułapki” — „tymczasowe obejście w workflow oznacz `TYMCZASOWE` i nie utrwalaj go w teście jako stanu docelowego; utwórz task na jego usunięcie”.

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

Sprawdzone niezależnie (świeży kontekst): commit `a8742fd`.

**Reprodukcja:** `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych; `bash scripts/test/deploy-workflow.test.sh` → 12 × ok, exit 0; `bash scripts/test/workflow-check.test.sh` → 3 × ok, exit 0; `node scripts/workflow-check.mjs` → OK; actionlint 1.7.12 (Docker) exit 0; pozostałe testy skryptów (`protect-main`, `mobile`, `deploy`, `image`, `smoke`, `zap`, `staging-setup`) exit 0; `pnpm build` exit 0; `pnpm test:mobile` 10/10. `pnpm check`: format, lint, typecheck, quality, design-check, backlog-check, workflow-check zielone; vitest 396/397 — 1 porażka w `InvitationScreen.entry.test.tsx` (znany niestabilny test, task T-019, `todo`; w izolacji 3 × 4/4 zielone; T-013 nie dotyka `apps/web`) — patrz #3.

**Kryteria akceptacji:**

- AC1 — **pass.** `on:` w `deploy.yml` = `push: branches: [main]` + `workflow_dispatch`. Test porównuje cały blok `on:` bez komentarzy. Spot-check (kopie w scratchpadzie, repo nietknięte): przywrócony `[main, "deploy-test/**"]` → FAIL; gałąź dopisana jako lista w osobnych liniach → FAIL; usunięty `workflow_dispatch` → FAIL; dodany `pull_request` → FAIL; dodany `tags:` → FAIL.
- AC2 — **pass.** `scripts/workflow-check.mjs` w `pnpm check` i w jobie `always` CI (bez filtra ścieżek); test skryptu w jobie `infra` (filtr `.github/**`, `scripts/**`). Spot-check: znacznik w innym pliku `*.yaml` → exit 1 z plikiem i linią.
- AC3 — **pass (statycznie)**; prawdziwy przebieg „merge do `main` → staging” niemożliwy przed merge PR epiku (zapisany w `UAT.md`, „Przed UAT”). `workflow_dispatch` obecny, joby `image`/`staging`/`zap` i testy SEC4 bez zmian.

**Fix task:** „Root cause” wyjaśnia, czemu testy nie złapały błędu (test utrwalał stan tymczasowy). Red evidence dla obu testów obecny; test odtwarzający czerwienieje bez poprawki (spot-check 1). Zakres: zmiany tylko w workflow, skryptach, testach i dokumentacji — zgodne z taskiem. `git status` czysty po spot-checkach.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | infra / workflow-check | Znacznik sprawdzany z rozróżnianiem wielkości liter: `# tymczasowe hack` przechodzi (exit 0). | `node scripts/workflow-check.mjs <kopia z małymi literami>` → `workflow-check: OK` | Dopasowanie bez rozróżniania wielkości liter (ew. także `TEMPORARY`/`TODO remove`), albo konwencja w `infra.md` mówi wprost „wielkimi literami”. |
| 2 | note | test | `workflow-check.test.sh` używa `\n` w zamianie `sed` (rozszerzenie GNU); działa w Git Bash i CI Linux, nie w BSD/macOS sed. | `scripts/test/workflow-check.test.sh:28` | Przenośny zapis (np. `awk`) jeśli testy mają działać na macOS. |
| 3 | note | suite | `pnpm check` czerwony przez niestabilny `InvitationScreen.entry.test.tsx` (`expected 1 to be +0`, linia 111); niezwiązany z T-013, śledzony w T-019. Evidence taska podaje 397/397 — przy tym przebiegu 396/397. | log `pnpm check`; 3 × izolowany przebieg zielony | Naprawa w T-019. |
| 4 | note | docs | Propozycja wpisu w `layers/infra.md` „Pułapki” (oznaczanie `TYMCZASOWE`, task na usunięcie) czeka na decyzję właściciela. | sekcja „Prevention” | Decyzja właściciela. |
