---
id: T-112
title: "`MenuAction.writes` wymagane, żeby każda pozycja menu jawnie decydowała o działaniu bez połączenia"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-progress           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-15]
threats: []
screens: [SC-06]
related_tasks: [T-063, T-094, T-104]
---

# T-112 `MenuAction.writes` wymagane, żeby każda pozycja menu jawnie decydowała o działaniu bez połączenia

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-09-1.md`, S5 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** `MenuAction.writes` jest opcjonalne (`apps/web/src/components/MoreMenu/MoreMenu.tsx:18`), a brak flagi oznacza „aktywne bez połączenia”. Po T-104 wszystkie trzy akcje mają `writes: true` (`apps/web/src/screens/SC-06-lista/ListScreen.tsx:172-186`, `:206-213`). Nowa pozycja menu bez flagi powtórzy K3 z przeglądu 3: akcja zapisu aktywna bez połączenia.
- **Expected:** reguła `docs/architecture/layers/web.md:77` (wyzwalacz akcji zapisu w menu ma `writes`) jest wymuszona przez typ. Źródło: F-15, T-104 AC2.
- **Steps to reproduce:** dodaj w `OwnerMenu` akcję `{ label, onSelect }` bez `writes`. `pnpm typecheck` przechodzi.
- **Environment:** lokalnie, commit `f0eb4d6`.
- **Evidence:** `docs/reviews/E-02-2026-11-09-1.md`, S5.

## Acceptance criteria

- [ ] AC1: Given `MenuAction` bez pola `writes`, when uruchamia się `pnpm typecheck`, then typecheck kończy się błędem. — verified by: `pnpm typecheck` (pole wymagane w typie; QA sprawdza próbną akcję bez pola)
- [ ] AC2: Given istniejące akcje menu SC-06, then każda ma jawne `writes` i zachowanie bez połączenia się nie zmienia. — verified by: istniejące testy `ListScreen.test.tsx` i `ListScreen.leave.test.tsx` (offline)
- [ ] AC3: No regression in: T-094, T-104, T-063.

## TDD plan

**Seam:** typ `MenuAction` (kompilator) oraz ekran SC-06 offline (istniejące testy).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | istniejące testy menu offline zielone | component | Vitest + RTL + MSW | AC2 |

**Run:** `pnpm typecheck && pnpm vitest run --project web SC-06`

## QA plan

- **Regression:** menu właściciela i uczestnika na SC-06, online i offline.
- **Edge cases:** pozycja, która nie zapisuje (gdyby powstała), ma `writes: false` zapisane jawnie.
- **Platforms:** web.

## Root cause

Flaga opcjonalna z bezpieczną dla użytkownika, ale niebezpieczną dla reguły wartością domyślną. T-104 poprawił istniejące akcje, ale nie zmienił typu.

## Evidence

- **Red:** próbny plik `apps/web/src/components/MoreMenu/probe-T112.ts` z `const probe: MenuAction = { label: "x", onSelect: () => undefined }`; `pnpm --filter @lista/web typecheck` kończy się kodem 0 (akcja bez `writes` przechodzi).
- **Green:** po zmianie `writes?: boolean` → `writes: boolean` ten sam plik daje `error TS2741: Property 'writes' is missing in type '{ label: string; onSelect: () => undefined; }' but required in type 'MenuAction'.` Próbka usunięta.
- Lint wskazał zbędne `action.writes === true` (`no-unnecessary-boolean-literal-compare`) w `MoreMenu.tsx:67` → `action.writes && !online` (to samo zachowanie).
- Pełny zestaw: `pnpm typecheck` OK, `pnpm lint` OK, `pnpm format:check` OK, `pnpm test` 155 plików / 1269 testów zielone, `pnpm vitest run --project web SC-06` 109 zielonych, `pnpm --filter @lista/web build` OK.
- Inne wystąpienia: `MenuAction` używane tylko w `ListScreen.tsx` (3 akcje, wszystkie `writes: true`); brak innych opcjonalnych flag `writes` w menu.

## Prevention

Typ wymusza regułę `web.md:77` (zaakceptowane przez właściciela 2026-11-09).

<!-- QA rounds are appended below by /qa-task -->
