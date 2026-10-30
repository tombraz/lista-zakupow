---
id: T-045
title: "Reguł lintu nie wyłącza komentarz konfiguracyjny `/* eslint … */`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-progress           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given komentarz `/* eslint <reguła>: off */` (także z inną opcją reguły, np. `["error"]`) w `apps/*/src`, `packages/*/src` lub `apps/web/test`, when uruchomię `pnpm lint`, then lint pada. To samo dla `/* global */`, `/* globals */`, `/* eslint-env */` i `/* exported */`. — verified by: `pnpm lint` na próbnym pliku
- [x] AC2: Given dozwolony komentarz `// eslint-disable-next-line react-hooks/exhaustive-deps` (jak w `Modal.tsx`, `useFocus.ts`), when uruchomię `pnpm lint`, then lint go przyjmuje; komentarz `eslint-disable` dla `no-restricted-syntax` nadal pada (T-044). — verified by: `pnpm lint` na repo i próbnym pliku
- [x] AC3: `CODING_STANDARDS.md`, wiersz „Wyjątki od reguł z przeglądów”, opisuje też zakaz komentarzy konfiguracyjnych; linia w „Zmiany”.
- [x] AC4: No regression in: `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm quality`.

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

T-044 zamknął tylko dyrektywy wyłączenia (`eslint-comments/no-restricted-disable` widzi wyłącznie `eslint-disable*`). Komentarz konfiguracyjny `/* eslint reguła: … */` (oraz `/* global(s) */`, `/* eslint-env */`, `/* exported */`) to inny rodzaj dyrektywy: ESLint stosuje go jako lokalną konfigurację pliku, więc `off` lub podmiana opcji (`["error"]` bez selektorów) usuwa regułę z przeglądu bez śladu w `eslint.config.js`. Istniejące kontrole tego nie łapały, bo nikt nie sprawdzał tej drugiej klasy komentarzy — w repo nie było żadnego, więc lint był zielony.

Ten sam wzorzec gdzie indziej: brak (w repo zero komentarzy konfiguracyjnych; `apps/web/e2e` i pliki `*.js` poza zakresem `files` jak w T-044).

## Evidence

- **Red (przed zmianą, `b6801a0`+):** `pnpm exec eslint` na próbnych plikach: `apps/api/src/__t045/probe1.ts` (`/* eslint no-restricted-syntax: off */` nad `log.warn({ event: "rate_limited" })`) — 0 błędów; `apps/web/src/__t045/probe2.ts` — `/* eslint-env node */`, `/* exported baz */`, `/* eslint no-restricted-syntax: ["error"] */` bez błędu (`/* global foo */` tylko przypadkiem przez `no-unused-vars`); `probe3.ts` z `// eslint-disable-next-line no-restricted-syntax` — błąd `eslint-comments/no-restricted-disable` (T-044 trzyma).
- **Green (po zmianie):** każdy komentarz konfiguracyjny w probe1, probe2, `probe4.tsx` (`/* global foo */` z użyciem `foo`) i `packages/shared/src/__t045/probe6.tsx` — `Unexpected ESLint directive comment  eslint-comments/no-use`; probe3 nadal `no-restricted-disable`.
- **Edge:** `// eslint no-restricted-syntax: off` (komentarz liniowy) nie działa jako konfiguracja — `no-restricted-syntax` dalej zgłasza `rate_limited` (probe5). Próbne pliki usunięte.
- **Regression:** `pnpm lint` exit 0 (dozwolone `eslint-disable-next-line react-hooks/exhaustive-deps` w `Modal.tsx`, `useFocus.ts` przechodzą), `pnpm typecheck` ok, `pnpm quality` ok (depcruise bez naruszeń), `pnpm test` exit 0 (93 pliki / 515 testów w wyświetlonym podsumowaniu).

## Prevention

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: fail

Odtworzenie (czyste drzewo, `98537ad`): `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm quality` exit 0 (depcruise 0 naruszeń), `pnpm format:check` exit 0, `pnpm test` exit 0 (515/515).

Kryteria:

- AC1: **fail** — komentarze `/* eslint no-restricted-syntax: off */`, `["error"]`, `/* global */`, `/* globals */`, `/* eslint-env */`, `/* exported */`, `/*eslint …:off*/` bez spacji, w `apps/api/src`, `apps/web/test`, `packages/shared/src/*.tsx` dają `eslint-comments/no-use` (potwierdzone na próbnych plikach). Ale komentarz konfiguracyjny może wyłączyć samą regułę pilnującą — patrz #1, #2.
- AC2: pass — `pnpm lint` na repo zielony (`Modal.tsx`, `useFocus.ts`); próbny `// eslint-disable-next-line react-hooks/exhaustive-deps` przyjęty; `// eslint-disable-next-line no-restricted-syntax` nadal pada.
- AC3: pass — wiersz i „Zmiany” w `CODING_STANDARDS.md`.
- AC4: pass — jak wyżej.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | AC1 / TH-21 | Komentarz konfiguracyjny wyłącza regułę, która ma go zgłaszać. ESLint stosuje konfigurację z komentarza przed uruchomieniem reguł, więc `eslint-comments/no-use` wyłączona w tym samym komentarzu nic nie zgłasza. Furtka z Report zostaje otwarta, a przy okazji znika też zakaz z T-044. | Próbny `apps/api/src/__qa45/p3.ts`: `/* eslint eslint-comments/no-use: off, no-restricted-syntax: off */` nad `log.warn({ event: "rate_limited" })` — 0 błędów `no-use` i 0 `no-restricted-syntax` (ten sam kod bez komentarza: błąd `no-restricted-syntax`). `p10.ts`: `/* eslint eslint-comments/no-use: off, eslint-comments/no-restricted-disable: off */` + `// eslint-disable-next-line no-restricted-syntax` — 0 błędów. | Każdy komentarz `/* eslint <reguła>: … */` w zakresie pada, także gdy dotyczy reguł `eslint-comments/*`. Kontrola, której nie da się wyłączyć z poziomu pliku: np. skrypt w `pnpm lint`/CI (wzorzec `/\*\s*(eslint\s|eslint-env|globals?\s|exported\s)` w `apps/*/src`, `packages/*/src`, `apps/web/test`), albo inne rozwiązanie spoza konfiguracji inline. Test: próbny plik z `p3`/`p10` pada. |
| 2 | blocker | AC1 / TH-21 | `eslint-disable` dla `eslint-comments/no-use` nie jest zakazany, więc wystarczy go postawić nad komentarzem konfiguracyjnym. | `p4.ts`: `/* eslint-disable eslint-comments/no-use */` + `/* eslint no-restricted-syntax: off */` nad `rate_limited` — 0 błędów. | `eslint-comments/no-restricted-disable` obejmuje też `eslint-comments/*` (dozwolony glob). Test: próbny `p4` pada. |
| 3 | minor | Proces (fix) | Sekcja `## Prevention` jest pusta. | plik taska | Wpis o tym, co zapobiega powtórce (np. kontrola niewyłączalna z pliku z #1). |
| 4 | note | Narzędzia | `/* eslint-env */` daje dziś `ESLintEnvWarning` na stderr; w ESLint 10 będzie błędem sam z siebie. Bez wpływu na werdykt. | wyjście `eslint` na `p2.ts` | — |

Edge cases potwierdzone: `// eslint no-restricted-syntax: off` (liniowy) nie działa jako konfiguracja (reguła dalej zgłasza); `/* eslint-disable-next-line eslint-comments/no-use */` nad komentarzem konfiguracyjnym nie pomaga (błąd `no-use` zostaje). Próbne pliki usunięte.

Do zmiany: zamknąć #1 i #2, dodać do Evidence red/green dla próbnych `p3`, `p4`, `p10`, uzupełnić Prevention.
