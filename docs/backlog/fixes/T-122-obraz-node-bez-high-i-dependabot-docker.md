---
id: T-122
title: "Obraz Node bez podatności HIGH; Dependabot aktualizuje przypięty obraz Docker"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [infra]
requirements: []
threats: [TH-22]
screens: []
related_tasks: [T-010]
---

# T-122 Obraz Node bez podatności HIGH; Dependabot aktualizuje przypięty obraz Docker

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #5 (medium).

- **Actual:** ostatni CI na PR #15 (run 42078397111, 2026-11-05) ma czerwony job `image`. Trivy zgłasza HIGH CVE-2026-109518 w `apt` 3.0.3 (poprawka w 3.0.4) w obrazie `node:24.21.0-trixie-slim@sha256:173f125896c3…`, przypiętym w `Dockerfile:4`. Bramka działa: wdrożenie z `main` zatrzyma się na tym kroku. `.github/dependabot.yml` ma jednak tylko ekosystemy `npm` i `github-actions`, więc przypięty digest nie dostaje automatycznych aktualizacji. Ten sam problem wróci przy każdej nowej podatności obrazu bazowego. Gałąź epiku jest 83 commity przed `origin`, a CI dla `cad0509` nie było uruchamiane.
- **Expected:** obraz API przechodzi Trivy (brak high/critical z dostępną poprawką), a obraz bazowy dostaje cotygodniowe PR z aktualizacją, tak jak zależności npm. Źródło: TH-22, `pipeline.md` etap 3 („Dependabot / Renovate”).
- **Steps to reproduce:** `gh run view 42078397111 --log-failed` (job `image`).
- **Environment:** CI (GitHub Actions), PR #15.
- **Evidence:** wiersz Trivy: `apt │ CVE-2026-109518 │ HIGH │ fixed │ 3.0.3 │ 3.0.4`.

## Acceptance criteria

- [ ] AC1: Given `Dockerfile` z nowym tagiem i digestem `node:24.x-trixie-slim` (albo `apt-get upgrade` w obrazie, jeśli upstream nie ma jeszcze poprawki), when CI buduje obraz, then job `image` (Trivy) jest zielony. — verified by: run CI na PR
- [ ] AC2: `.github/dependabot.yml` ma `package-ecosystem: docker` dla katalogu z `Dockerfile` (co tydzień, z aktualizacją digestu). — verified by: przegląd konfiguracji; pierwszy PR Dependabota albo walidacja `dependabot.yml`
- [ ] AC3: `pipeline.md` (etap 3 i tabela TH-22) wymienia ekosystem `docker`.
- [ ] AC4: No regression in: `image-run.test.sh`, smoke test staging, wersja Node zgodna z `.nvmrc` / `engines`.

## TDD plan

**Seam:** pipeline CI

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | job `image` (Trivy) na PR | CI | GitHub Actions | AC1 |
| 2 | `scripts/test/image-run.test.sh` | smoke | bash | AC4 |

**Run:** `bash scripts/test/image-run.test.sh` lokalnie, potem push i `gh pr checks 15`

## QA plan

- **Regression:** build obrazu, start API w obrazie, deploy staging (po merge).
- **Edge cases:** nowy digest zmienia wersję Node (musi zostać 24.x zgodna z `.nvmrc`).
- **Platforms:** CI, staging.

## Root cause

<Do uzupełnienia przy poprawce. Wstępnie: przypięcie digestu (dobre dla TH-22) bez automatu do jego aktualizacji.>

## Evidence

## Prevention

Dependabot `docker` (AC2) zapobiega powtórce.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
