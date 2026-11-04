---
id: T-093
title: "CI: `ci-ok` przepuszcza job porzucony przez GitHub (`abandoned`)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [infra]
requirements: []
threats: []
screens: []
related_tasks: [T-002]
---

# T-093 CI: `ci-ok` przepuszcza job porzucony przez GitHub (`abandoned`)

## Report

Źródło: CI na PR #14 (2026-11-04), zgłoszenie użytkownika. Gałąź: `fix/T-093-<slug>` z `main` (po merge PR #14) i pull request.

- **Actual:** w przebiegu `41872112002` (attempt 1, commit `6dc667d`) job `mobile-ios` nie dostał runnera `macos-latest`, nie wykonał żadnego kroku i został anulowany po 15 min. W `needs.*.result` widocznym w jobie `ci-ok` jego wynik to `"abandoned"`. Krok „Wynik jobów” w `.github/workflows/ci.yml` blokuje tylko `"failure"` i `"cancelled"` (`grep -Eq '"(failure|cancelled)"'`), więc `ci-ok` — jedyny wymagany check CI — był zielony, choć build iOS się nie odbył.
- **Expected:** `ci-ok` przechodzi tylko wtedy, gdy każdy job przeszedł albo został pominięty (`pipeline.md:57`: „przechodzi tylko, gdy każdy uruchomiony job przeszedł”). Każdy inny wynik (`failure`, `cancelled`, `abandoned`, nieznany w przyszłości) blokuje merge. — source: `pipeline.md` (etapy 1–2, „Zbiorczy wymagany check”)
- **Steps to reproduce:**
  1. PR, w którym uruchamia się job mobilny, a runner macOS jest niedostępny (albo job zakończy się wynikiem spoza `failure`/`cancelled`).
  2. `ci-ok` → pass; `gh pr view` → `mergeStateStatus: UNSTABLE`, a merge jest możliwy.
- **Environment:** GitHub Actions, `ci.yml`, PR #14.
- **Evidence:** log `ci-ok` (job `126732329250`): `RESULTS: [ "success", …, "abandoned", "success", "success" ]`, krok zakończony sukcesem.

## Acceptance criteria

- [ ] AC1: Given wyniki jobów zawierające `abandoned` (oraz osobno: `failure`, `cancelled`, dowolny nieznany napis), when logika `ci-ok` je ocenia, then kończy się błędem i wypisuje, który job nie przeszedł. — verified by: test skryptu z `scripts/test/` (czerwony na obecnej logice dla `abandoned`)
- [ ] AC2: Given wyniki tylko `success` i `skipped` (także wszystkie `skipped` poza `changes`), then `ci-ok` przechodzi. — verified by: ten sam test
- [ ] AC3: Given test z AC1, then uruchamia się w CI (job `infra`, jak pozostałe testy `scripts/test/*.test.sh`). — verified by: `ci.yml` + zielony job `infra` na PR
- [ ] AC4: No regression in: zielony `ci-ok` na zwykłym PR; `actionlint`; `scripts/protect-main.sh` nadal wymaga `ci-ok` i `codeql`.

## TDD plan

**Seam:** logika oceny wyników jobów wyjęta z `ci.yml` do skryptu (wejście: JSON `needs.*.result` albo lista wyników; wyjście: kod wyjścia i komunikat), testowana jak inne skrypty infra (`scripts/test/*.test.sh`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `abandoned` → błąd (dziś przechodzi) | unit | bash (`scripts/test/`) | AC1 |
| 2 | `failure`, `cancelled`, nieznany wynik → błąd | unit | bash | AC1 |
| 3 | tylko `success`/`skipped` → sukces | unit | bash | AC2 |
| 4 | test dopisany do joba `infra` | — | actionlint + CI | AC3 |

**Run:** `bash scripts/test/<ci-ok>.test.sh` oraz `actionlint` (jak w jobie `infra`).

## QA plan

- **Regression:** PR bez zmian mobilnych (joby mobilne `skipped`) — `ci-ok` zielony; PR z celowo zepsutym testem — `ci-ok` czerwony (jak pokaz z T-002).
- **Edge cases:** pusta lista wyników; wyniki z białymi znakami / formatowaniem `toJSON`; job `changes` sam niezielony.
- **Platforms:** GitHub Actions (`ubuntu-latest`); skrypt uruchamialny lokalnie w Git Bash na Windows.

## Implementation notes

Lista dozwolonych (`success`, `skipped`) zamiast listy zabronionych — nowe lub nieudokumentowane wartości wyniku blokują. Zmiana dokumentowana w `pipeline.md` (opis `ci-ok`) i w „Pułapkach” `infra.md` w tym samym zadaniu.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
