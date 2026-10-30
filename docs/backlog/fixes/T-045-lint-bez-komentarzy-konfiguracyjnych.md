---
id: T-045
title: "Reguł lintu nie wyłącza komentarz konfiguracyjny `/* eslint … */`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-044]
layers: [backend, web]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-030, T-044]
---

# T-045 Reguł lintu nie wyłącza komentarz konfiguracyjny `/* eslint … */`

## Report

Źródło: T-044, sekcja Prevention (luka poza zakresem, zaplanowana przez `/plan-backlog` 2026-10-30).

- **Actual:** T-044 zakazał komentarzy `eslint-disable` dla `no-restricted-imports` i `no-restricted-syntax` (`eslint-comments/no-restricted-disable`). Komentarz konfiguracyjny `/* eslint no-restricted-syntax: off */` (albo `/* eslint no-restricted-syntax: ["error"] */`, który podmienia listę selektorów) nie jest dyrektywą wyłączenia. `no-restricted-disable` go nie widzi, więc reguła z przeglądu znika bez śladu w `eslint.config.js`. To samo dotyczy `/* global */` i `/* eslint-env */`.
- **Expected:** reguły zmienia tylko `eslint.config.js`. W kodzie dozwolone są wyłącznie `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` i `eslint-enable`. Zakazy z przeglądów pilnuje dalej `no-restricted-disable`. Źródło: T-044 AC2 („reguły dodane po przeglądach nie mają furtki bez śladu w konfiguracji”), `CODING_STANDARDS.md` wiersz „Wyjątki od reguł z przeglądów”.
- **Steps to reproduce:**
  1. Dodaj na początku dowolnego pliku w `apps/api/src` komentarz `/* eslint no-restricted-syntax: off */`, a pod nim `log.warn({ event: "rate_limited" })`.
  2. `pnpm lint` jest zielony.
- **Environment:** lokalnie / CI; `b6801a0`.
- **Evidence:** w repo nie ma dziś żadnego komentarza konfiguracyjnego (`/* eslint `, `/* global `, `/* eslint-env `, `/* exported `), więc zakaz nie wymaga zmian w kodzie.

## Acceptance criteria

- [ ] AC1: Given komentarz `/* eslint <reguła>: off */` (także z inną opcją reguły, np. `["error"]`) w `apps/*/src`, `packages/*/src` lub `apps/web/test`, when uruchomię `pnpm lint`, then lint pada. To samo dla `/* global */`, `/* globals */`, `/* eslint-env */` i `/* exported */`. — verified by: `pnpm lint` na próbnym pliku
- [ ] AC2: Given dozwolony komentarz `// eslint-disable-next-line react-hooks/exhaustive-deps` (jak w `Modal.tsx`, `useFocus.ts`), when uruchomię `pnpm lint`, then lint go przyjmuje; komentarz `eslint-disable` dla `no-restricted-syntax` nadal pada (T-044). — verified by: `pnpm lint` na repo i próbnym pliku
- [ ] AC3: `CODING_STANDARDS.md`, wiersz „Wyjątki od reguł z przeglądów”, opisuje też zakaz komentarzy konfiguracyjnych; linia w „Zmiany”.
- [ ] AC4: No regression in: `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm quality`.

## TDD plan

**Seam:** konfiguracja ESLint (`eslint.config.js`), sprawdzana przez `eslint` na próbnych plikach.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | próbny plik w `apps/api/src` z `/* eslint no-restricted-syntax: off */` nad ręcznym `warn({ event: "rate_limited" })`: przed zmianą exit 0, po zmianie błąd `eslint-comments/no-use` | lint | eslint | AC1 |
| 2 | próbny plik w `apps/web/src` z `/* global foo */`, `/* eslint-env node */` i `/* eslint no-restricted-syntax: ["error"] */`: błąd dla każdego | lint | eslint | AC1 |
| 3 | `pnpm lint` na repo: zielony (dozwolone `eslint-disable-next-line react-hooks/exhaustive-deps` przechodzą); próbny `// eslint-disable-next-line no-restricted-syntax` nadal błąd | lint | eslint | AC2 |

**Run:** `pnpm exec eslint <próbne pliki> && pnpm lint`

Wskazówka: `eslint-comments/no-use` z `allow: ["eslint-disable", "eslint-disable-line", "eslint-disable-next-line", "eslint-enable"]` w bloku z `no-restricted-disable` (T-044). Próbne pliki usunąć przed commitem.

## QA plan

- **Regression:** cały lint i testy w CI; komentarze `eslint-disable-next-line` w `apps/web/e2e/j01-konto.spec.ts` (poza zakresem `files`) i w `Modal.tsx`, `useFocus.ts` dalej przechodzą.
- **Edge cases:** komentarz liniowy `// eslint no-restricted-syntax: off` (ESLint czyta konfigurację tylko z komentarzy blokowych; potwierdzić, że nie działa jako furtka); `/* eslint-disable */` bez nazwy reguły (blokuje T-044); plik w `packages/*/src` z `.tsx`.
- **Platforms:** CI.

## Root cause

## Evidence

## Prevention

<!-- QA rounds are appended below by /qa-task -->
