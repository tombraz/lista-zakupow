---
id: T-092
title: "Lint: zakaz stałej pauzy przed asercją w testach API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-090, T-091]
layers: [backend]
requirements: []
threats: []
screens: []
related_tasks: [T-082]
---

# T-092 Lint: zakaz stałej pauzy przed asercją w testach API

## Report

Źródło: T-082 („Prevention”), przegląd E-02 C3 („Proposals”). Gałąź: `fix/T-092-<slug>` z `main` po T-090 i T-091.

- **Actual:** zasada „bez stałej pauzy przed asercją” (`testing-strategy.md:41`) jest tylko opisem; nic nie pada, gdy nowy test jej nie spełnia (powtarzające się ustalenie: przegląd E-02, T-082).
- **Expected:** `pnpm lint` pada na stałą pauzę w `apps/api/test/**/*.test.ts`.

## Acceptance criteria

- [ ] AC1: Given plik testowy z `await new Promise((resolve) => setTimeout(resolve, n))`, when `pnpm lint`, then błąd z komunikatem wskazującym `testing-strategy.md` (sygnał zamiast pauzy). — verified by: test reguły na fiksturze (ESLint API), czerwony przed dodaniem reguły
- [ ] AC2: Given import `pause` (lub `expectSilence`, jeśli zostało) z `./live` w pliku `*.test.ts`, then błąd lintu. — verified by: jak AC1
- [ ] AC3: Given `rejects.toThrow("still open")`, then błąd lintu. — verified by: jak AC1
- [ ] AC4: Given helpery testowe (`live.ts`, `gated-pool.ts`, `brevo.ts`) z limitem czasu jako wykrywaczem awarii, then nie są objęte regułą. — verified by: `pnpm lint` zielony na repo
- [ ] AC5: No regression in: `pnpm lint`, `pnpm test`; `eslint.directives.config.js` (bez wyłączeń inline) nadal przechodzi.

## TDD plan

**Seam:** konfiguracja ESLint (`no-restricted-syntax`, `no-restricted-imports` — wbudowane, bez nowych zależności).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Fikstura ze stałą pauzą daje błąd lintu | unit | Vitest + ESLint API | AC1 |
| 2 | Fikstury z importem `pause` i „still open” dają błąd | unit | Vitest + ESLint API | AC2, AC3 |
| 3 | `pnpm lint` na repo zielony | — | ESLint | AC4, AC5 |

**Run:** `pnpm lint && pnpm vitest run <test reguły>`

## QA plan

- **Regression:** `pnpm check` w całości.
- **Edge cases:** pauza zapisana inaczej (`setTimeout` z `node:timers/promises`, `wait` przez `bind`) — co reguła łapie, a czego nie, opisane w Evidence; `apps/web` i `apps/mobile` poza zakresem (osobna propozycja, jeśli QA znajdzie tam ten wzorzec).
- **Platforms:** CI.

## Implementation notes

Reguła matchuje kod tak, jak jest zapisany — nie złapie każdej formy. Zasada i reguła opisane w `testing-strategy.md:41` oraz w „Pułapkach” `backend.md` w tym samym zadaniu (dokumenty przekrojowe).

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

To zadanie jest prewencją dla T-082, T-090 i T-091.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
