---
id: T-013
title: "Wdrożenie na staging tylko z main (usunięcie deploy-test/**)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change   # bug | small-change
severity: high       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `scripts/test/deploy-workflow.test.sh`

## QA plan

- **Regression:** deploy z `main` po merge PR epiku (T-010 AC2), `workflow_dispatch`
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
