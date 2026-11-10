---
id: T-122
title: "Obraz Node bez podatności HIGH; Dependabot aktualizuje przypięty obraz Docker"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given `Dockerfile` z nowym tagiem i digestem `node:24.x-trixie-slim` (albo `apt-get upgrade` w obrazie, jeśli upstream nie ma jeszcze poprawki), when CI buduje obraz, then job `image` (Trivy) jest zielony. — verified by: run CI na PR
- [x] AC2: `.github/dependabot.yml` ma `package-ecosystem: docker` dla katalogu z `Dockerfile` (co tydzień, z aktualizacją digestu). — verified by: przegląd konfiguracji; pierwszy PR Dependabota albo walidacja `dependabot.yml`
- [x] AC3: `pipeline.md` (etap 3 i tabela TH-22) wymienia ekosystem `docker`.
- [x] AC4: No regression in: `image-run.test.sh`, smoke test staging, wersja Node zgodna z `.nvmrc` / `engines`.

AC4, smoke test staging: zweryfikowany przed merge tym samym `scripts/smoke.sh` na obrazie z 28f6875 w jobie `image` (CI run 42830045236, 2026-11-10, QA round 1); wdrożenie staging jest możliwe tylko z `main` (T-013), więc `deploy.yml` uruchomi `smoke.sh staging` po merge PR #15 i zatrzyma wdrożenie przy porażce.

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
- Green (CI run 42830045236, 28f6875): job `image` success (migracje z obrazu, bez roota, smoke; Trivy bez high/critical z poprawką), `ci-ok` success.
- `bash scripts/test/image.test.sh`: ok. `dependabot.yml` parsuje się (`npm`, `github-actions`, `docker`).

## Prevention

Dependabot `docker` (AC2) zapobiega powtórce.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-10)

Verdict: pass

Zakres: commity 690bcf4, 28f6875 (bez df02771 `in-qa`). Kind `fix`: bez akceptacji story i epiku.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | dokumentacja warstwy | `docs/architecture/layers/infra.md` nie ma wiersza T-122 w „Historia zmian” (l. 104–116), a „Pułapki” nie mówią, że Dependabot `docker` aktualizuje tylko dosłowne `FROM` (obraz przez `ARG` w `FROM ${…}` nie dostaje PR). Wiedza jest tylko w komentarzu `Dockerfile:3-4` | `grep -n T-122 docs/architecture/layers/infra.md` — brak | wiersz w „Historia zmian” + punkt w „Pułapki” (zakaz `ARG` w `FROM` dla przypiętych obrazów) |
| 2 | note | łańcuch dostaw | Inne przypięte obrazy nie mają automatu aktualizacji: `aquasec/trivy:0.76.1@sha256` (`scripts/image.sh:14`), `rhysd/actionlint:1.7.12@sha256` (`.github/workflows/ci.yml:278`, `docker://` — sprawdzić, czy obejmuje go ekosystem `github-actions`), `postgres:17.11-alpine` i `axllent/mailpit` (`docker-compose.yml`, poza zakresem wg „Root cause”) | przegląd plików | osobne zadanie: ekosystem `docker-compose` i aktualizacja obrazu Trivy |
| 3 | note | powtarzalność obrazu | `apt-get upgrade` w etapie runtime (`Dockerfile:20`) sprawia, że digest nie wyznacza już w pełni zawartości obrazu (zależy od dnia budowy). Zgodne z AC1 i łagodzone zasadą „jeden obraz na commit `main`, promowany” | `Dockerfile:18-20` | akceptowalne; ewentualnie usunąć `upgrade`, gdy upstream nadąża |
| 4 | note | weryfikacja | QA, jak autor, nie zbudował obrazu lokalnie (TLS proxy na maszynie); AC1 i AC4 zweryfikowane na przebiegach CI | — | — |

Weryfikacja (uruchomione przez QA):

- AC1 pass: `gh run view 42830045236` — `headSha` 28f6875 (= head PR #15), wszystkie joby `success`, w tym `image` i `ci-ok`. Log `image`: `apt-get upgrade` instaluje `zlib1g 1:1.3.dfsg+really1.3.1-1+deb13u1` (z `+b1`); Trivy: obraz `debian 13.7`, 79 pakietów, `0` znalezisk w wierszu debian i we wszystkich `node-pkg`. Red potwierdzony: run 42078397111 (ac98869) i 42826144581 (690bcf4) — job `image` `failure`.
- AC2 pass: `.github/dependabot.yml` ma `package-ecosystem: docker`, `directory: /`, `weekly`, ignorowane `semver-major` dla `node`; `Dockerfile` ma dosłowne `FROM node:24.22.2-trixie-slim@sha256:0820eaa8…` w obu etapach, bez `ARG`. Prettier parsuje plik bez błędów. Config Dependabota zadziała dopiero na `main` (pierwszy PR po merge).
- AC3 pass: `pipeline.md` etap 3 („Dependabot dla npm, github-actions i docker”) i wiersz TH-22 („Dependabot (npm, github-actions, docker)”); `SECURITY.md` zaktualizowany.
- AC4 pass: `image-run.test.sh` w CI: `ok` migracje z obrazu, `ok` bez roota, `ok` smoke test api i web. Node 24.22.2 zgodny z `.nvmrc` (`24`) i `engines` (`>=24.11 <25`). Smoke staging — patrz notka pod AC.
- Lokalnie: `bash scripts/test/image.test.sh` — 4× ok; `node scripts/backlog-check.mjs` — OK (2 ostrzeżenia TH-34/TH-35 spoza zadania); `prettier --check` na zmienionych plikach — ok.
- Stare odwołania: `grep NODE_IMAGE|24.21.0|173f1258` — tylko historyczne wpisy w T-010 i przeglądzie bezpieczeństwa.
- Root cause wyjaśnia, czemu testy nie złapały błędu (CVE opublikowane po przypięciu; brak automatu podnoszącego pin, `ARG` w `FROM` blokowałby Dependabota). Reprodukcja: czerwony Trivy na starym digeście (run 42078397111).
- TH-22: zagrożenie łańcucha dostaw — bramka Trivy zablokowała podatny obraz (red), po poprawce zielona; exploit w sensie aplikacyjnym nie dotyczy (zmiana obrazu i konfiguracji).
- `docs/backlog/E-02-konto-i-uczestnicy/UAT.md` l. 3: status T-122 zaktualizowany na `done` (pozostałe T-118–T-121 `todo`).
