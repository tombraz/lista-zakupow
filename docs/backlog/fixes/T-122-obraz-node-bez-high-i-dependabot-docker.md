---
id: T-122
title: "Obraz Node bez podatności HIGH; Dependabot aktualizuje przypięty obraz Docker"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

T-010 przypiął tag i digest obrazu Node (dobre dla TH-22), ale nic go nie aktualizuje: `dependabot.yml` nie miał ekosystemu `docker`. Do tego obraz był podany przez `ARG NODE_IMAGE` w `FROM ${NODE_IMAGE}`, a Dependabot `docker` aktualizuje tylko dosłowne `FROM`, więc samo dopisanie ekosystemu nic by nie dało. Po opublikowaniu CVE-2026-109518 (apt i libapt-pkg7.0 3.0.3) przypięty obraz stał się podatny bez żadnej zmiany w repo. Testy tego nie złapały, bo nie miały czego łapać przed publikacją CVE. Bramka Trivy zadziałała zgodnie z planem, ale nie ma automatu, który podnosi pin.

Poprawka: `apt-get upgrade` w etapie runtime (poprawki Debiana, których upstream jeszcze nie ma) oraz `node:24.22.2-trixie-slim@sha256:0820eaa8…` (apt i libapt-pkg7.0 3.0.4, Node v24.22.2, zgodne z `.nvmrc` 24 i `engines` `>=24.11 <25`) wpisany dosłownie w obu `FROM`. Dependabot `docker` dla `/` co tydzień, bez podbić semver-major (Node zostaje na 24). `pipeline.md` (etap 3, TH-22) i `SECURITY.md` wymieniają ekosystem docker.

Inne wystąpienia: obraz Postgresa w `docker-compose.yml` jest poza obrazem produkcyjnym i poza Trivy, więc nie wchodzi w zakres tego zadania (ekosystem `docker-compose` można dodać osobnym zadaniem).

## Evidence

- Red (CI, run 42078397111, job `image`): `Total: 2 (HIGH: 2, CRITICAL: 0)`, `apt │ CVE-2026-109518 │ HIGH │ fixed │ 3.0.3 │ 3.0.4` (druga HIGH to `libapt-pkg7.0` z tym samym CVE).
- Lokalnie (2026-11-10): `node:24.21.0-trixie-slim@sha256:173f1258…`: `node v24.21.0`, `apt 3.0.3`, `libapt-pkg7.0 3.0.3`. `node:24.22.2-trixie-slim@sha256:0820eaa8…` (to samo, co obecny `node:24-trixie-slim`): `node v24.22.2`, `apt 3.0.4`, `libapt-pkg7.0 3.0.4`.
- Lokalnie nie da się uruchomić `scripts/image.sh build` ani Trivy: kontenery nie ufają certyfikatowi pośredniczącemu w TLS na tej maszynie (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` przy `npm install`, `x509: certificate signed by unknown authority` przy pobieraniu bazy Trivy). AC1 i `image-run.test.sh` (AC4) weryfikuje job `image` w CI.
- CI po pierwszej poprawce (run 42826144581, 690bcf4): `image-run.test.sh` ok (migracje, bez roota, smoke). Trivy nadal `Total: 2 (HIGH: 2)`, ale już nie apt: `zlib1g 1:1.3.dfsg+really1.3.1-1+b1` (CVE-2026-76844, CVE-2026-85091, poprawka `+deb13u1`). Najnowszy upstream `node:24-trixie-slim` też ma `+b1`, więc zgodnie z AC1 etap runtime robi `apt-get upgrade`. Lokalnie w obrazie bazowym `apt-get update && apt-get upgrade` daje `zlib1g …+deb13u1`.
- `bash scripts/test/image.test.sh`: ok. `dependabot.yml` parsuje się (`npm`, `github-actions`, `docker`).

## Prevention

Dependabot `docker` (AC2) zapobiega powtórce.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
