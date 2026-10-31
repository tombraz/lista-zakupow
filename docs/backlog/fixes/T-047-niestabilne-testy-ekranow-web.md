---
id: T-047
title: "Niestabilne testy ekranów web pod obciążeniem pełnego `pnpm test`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: []
threats: []
screens: [SC-02, SC-06, SC-07]
related_tasks: [T-021, T-036]
---

# T-047 Niestabilne testy ekranów web pod obciążeniem pełnego `pnpm test`

## Report

Źródło: QA round 1 tasku T-046 (2026-10-30), uwaga #3; przyjęte przez właściciela jako osobne zadanie 2026-10-31.

- **Actual:** jeden z trzech pełnych przebiegów `pnpm test` dał 6 porażek w testach ekranów web: `SignUpScreen`, `ListScreen` (w tym `ListScreen.edit`), `ParticipantsScreen` (`Test Files 4 failed | 89 passed (93)`). Te same pliki uruchomione osobno: 123/123 zielone; kolejny pełny przebieg 515/515 zielony.
- **Expected:** testy ekranów są deterministyczne: wynik nie zależy od obciążenia maszyny ani od tego, co biegnie równolegle (testy API z Testcontainers w tym samym `pnpm test`). — source: `docs/architecture/testing-strategy.md` (bramki CI), właściciel.
- **Steps to reproduce:** `pnpm test` (pełny zestaw, kilka razy z rzędu); w izolacji się nie odtwarza.
- **Environment:** lokalnie, Windows 11 / Git Bash; gałąź `epic/E-01-szkielet-i-wspolna-lista`, commit `3844e87`. W CI (ubuntu) nie zaobserwowano.
- **Evidence:** raport QA T-046 (`docs/backlog/fixes/T-046-test-przebiegu-lintu-komentarzy.md`, „QA round 1”, uwaga #3). Komunikaty błędów nie zostały zapisane: pierwszy krok to je zebrać. Hipoteza do sprawdzenia: limity czasu (`findBy*` / `waitFor` domyślnie 1000 ms, `testTimeout` 5000 ms) przekraczane pod obciążeniem, albo stan współdzielony między testami (MSW, timery, `localStorage`). Nie poprawiać przed potwierdzeniem przyczyny.

## Acceptance criteria

- [ ] AC1: Given warunki, w których porażka się odtwarza (obciążenie albo utrwalony wyścig, np. spowolniona odpowiedź MSW, mniej zasobów dla workerów), when uruchomione zostaną testy `SignUpScreen`, `ListScreen*`, `ParticipantsScreen*`, then przechodzą — także w pętli wielu powtórzeń. — verified by: test odtwarzający z Root cause
- [ ] AC2: Poprawka usuwa przyczynę (oczekiwanie na stan, izolacja stanu, kod ekranu), a nie tylko podnosi limity czasu globalnie; jeśli przyczyną jest kod ekranu (np. wyścig widoczny dla użytkownika), poprawka jest w kodzie, a nie w teście. — verified by: QA (przegląd diffu)
- [ ] AC3: No regression in: `pnpm test` (pełny zestaw, 3 przebiegi z rzędu zielone), `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`.

## TDD plan

**Seam:** testy ekranów web (Vitest + jsdom + RTL + MSW), te same pliki co w porażce.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Odtworzenie: pełny `pnpm test` w pętli (np. 5×) z zapisem wyjścia porażek; potem zawężenie do jednego pliku z utrwalonym warunkiem (np. `--maxWorkers`/obciążenie CPU, opóźniona odpowiedź MSW) | komponent | Vitest | AC1 (czerwony) |
| 2 | Test utrwalający przyczynę w danym pliku (deterministycznie czerwony przed poprawką) | komponent | Vitest + RTL + MSW | AC1 |
| 3 | Pętla powtórzeń zawężonych plików (`pnpm vitest run --project web <pliki>`, ≥ 20×) zielona | komponent | Vitest | AC1 |

**Run:** `pnpm vitest run --project web SignUpScreen ListScreen ParticipantsScreen`

## QA plan

- **Regression:** testy ekranów SC-02, SC-06, SC-07; pełny `pnpm test` 3× z rzędu.
- **Edge cases:** pliki uruchamiane razem z testami API (Testcontainers) i osobno; wolna maszyna (Windows) i CI (ubuntu).
- **Platforms:** lokalnie Windows / Git Bash, CI.

## Root cause

## Evidence

## Prevention

<!-- QA rounds are appended below by /qa-task -->
