---
id: T-116
title: "backlog-check --write-index: „—” zamiast „undefined” w kolumnach Epic i Story zadań z fixes/"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [infra]
requirements: []
threats: []
screens: []
related_tasks: [T-099, T-110]
---

# T-116 backlog-check --write-index: „—” zamiast „undefined” w kolumnach Epic i Story zadań z fixes/

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-10-1.md`, ustalenie P3. Właściciel zatwierdził zadanie 2026-11-10. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** wygenerowany `docs/backlog/index.md` ma `undefined | undefined` w kolumnach Epic i Story dla każdego zadania z `docs/backlog/fixes/` (88 wystąpień, np. `index.md:321-325`). Generator wstawia surowe `t.epic` i `t.story` (`scripts/backlog-check.mjs:743`), choć w kolumnie „Depends on” używa „—”.
- **Expected:** puste pole to „—”, tak jak w „Depends on”. Źródło: właściciel, przegląd 2026-11-10.
- **Steps to reproduce:** `node scripts/backlog-check.mjs --write-index`, potem `grep -c "undefined" docs/backlog/index.md`.
- **Environment:** lokalnie, HEAD `3de5af5`.
- **Evidence:** `grep -c "undefined | undefined" docs/backlog/index.md` → 88.

Poza zakresem (decyzja właściciela 2026-11-10, ustalenie P2): nieodhaczone pozycje „Definition of done” w zadaniach `done` nie są śledzone po `done`. Zapisać to jednym zdaniem w opisie kontroli T-110 (`scripts/backlog-check.mjs` przy kontroli AC albo w `infra.md`), żeby nie wracało w przeglądach.

## Acceptance criteria

- [ ] AC1: Given zadanie z `fixes/` bez `epic` i `story`, when uruchamia się `backlog-check --write-index`, then jego wiersz w `index.md` ma „—” w kolumnach Epic i Story. — verified by: test w `scripts/test/backlog-check.test.mjs`
- [ ] AC2: Given repo po `--write-index`, then `index.md` nie zawiera „undefined”. — verified by: `grep`
- [ ] AC3: Given opis kontroli T-110, then mówi, że „Definition of done” nie jest śledzone po `done` (decyzja 2026-11-10). — verified by: odczyt
- [ ] AC4: No regression in: `node --test scripts/test/backlog-check.test.mjs`, `node scripts/backlog-check.mjs`.

## TDD plan

**Seam:** CLI `backlog-check --write-index --root <fikstura>`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | fikstura z zadaniem `fixes/` → wiersz indeksu z „— \| —” | integration | node:test | AC1 |

**Run:** `node --test scripts/test/backlog-check.test.mjs`

## QA plan

- **Regression:** `pnpm backlog-check`, `node --test scripts/test/*.test.mjs`, wiersze zadań epików w `index.md` bez zmian.
- **Edge cases:** zadanie z `epic`, ale bez `story`.
- **Platforms:** CI (job `infra`).

## Root cause

<Wypełnia /fix.>

## Evidence

<Wypełnia /fix.>

## Prevention

<Wypełnia /fix.>

<!-- QA rounds are appended below by /qa-task -->
