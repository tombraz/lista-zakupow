---
id: T-072
title: "SC-09: 401 przy usuwaniu konta to sukces tylko po utraconej odpowiedzi"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-04]
threats: []
screens: [SC-09, SC-01]
related_tasks: [T-062]
---

# T-072 SC-09: 401 przy usuwaniu konta to sukces tylko po utraconej odpowiedzi

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, S2 (major); spójność C8.

- **Actual:** `useDeleteAccount` liczy próby w `useRef` i nigdy nie zeruje licznika (`apps/web/src/screens/SC-09-konto/useDeleteAccount.ts:15-23`). Po każdej wcześniejszej porażce (np. 500) traktuje 401 jako „konto usunięte”. Jeśli sesja wygasła w innej karcie, użytkownik widzi na SC-01 „Konto zostało usunięte.”, choć konto istnieje.
- **Expected:** „Konto zostało usunięte.” pojawia się tylko wtedy, gdy konto naprawdę usunięto. 401 może oznaczać sukces tylko po próbie, której odpowiedź się zgubiła (błąd sieci). Każde inne 401 to zwykły koniec sesji (`RequireSession`). Źródło: komentarz w samym hooku i `T-062-usuniecie-konta.md` AC4.
- **Steps to reproduce:**
  1. Na SC-09 kliknij „Usuń konto”; API odpowiada 500 (MSW).
  2. Wyloguj się w innej karcie (sesja traci ważność) i ponów usunięcie: API odpowiada 401.
  3. SC-01 pokazuje „Konto zostało usunięte.”.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given pierwsza próba zakończona 500, when druga próba dostaje 401, then klient kończy sesję jak przy zwykłym 401, bez komunikatu „Konto zostało usunięte.”. — verified by: test ekranu (MSW)
- [ ] AC2: Given pierwsza próba zakończona błędem sieci (odpowiedź utracona), when ponowienie dostaje 401, then pojawia się „Konto zostało usunięte.” (zachowanie z T-062). — verified by: test (MSW)
- [ ] AC3: Given zamknięcie i ponowne otwarcie okna potwierdzenia, then stan prób zaczyna się od nowa. — verified by: test
- [ ] AC4: No regression in: E2E usunięcia konta (T-062).

## TDD plan

**Seam:** ekran SC-09 z MSW.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | 500, potem 401: brak komunikatu o usunięciu | component | Vitest + RTL + MSW | AC1 |
| 2 | błąd sieci, potem 401: komunikat o usunięciu | component | Vitest + RTL + MSW | AC2 |
| 3 | ponowne otwarcie okna zeruje stan | component | Vitest + RTL | AC3 |

**Run:** `pnpm vitest run --project web SC-09`

## QA plan

- **Regression:** T-062 (wszystkie AC), wylogowanie w innej karcie.
- **Edge cases:** 429 przed 401, dwa szybkie kliknięcia.
- **Platforms:** web.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Przegląd C8: jedna decyzja „już zrobione przy ponowieniu” dla wszystkich mutacji usuwających (wspólny helper w `api/`).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
