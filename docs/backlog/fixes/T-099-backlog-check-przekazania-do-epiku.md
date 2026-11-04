---
id: T-099
title: "backlog-check: praca przekazana „to E-xx” musi mieć task albo wpis w epiku"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [infra]
requirements: []
threats: []
screens: []
related_tasks: [T-005, T-059, T-094]
---

# T-099 backlog-check: praca przekazana „to E-xx” musi mieć task albo wpis w epiku

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, propozycja do P1 (zaakceptowana przez właściciela 2026-11-04). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** T-005 zapisał w notatkach „„Opuść listę” to E-02 (F-13)” (`docs/backlog/E-01-szkielet-i-wspolna-lista/S-01-03-moje-listy/T-005-moje-listy.md:175`). Żaden task E-02 tego nie przejął, a `scripts/backlog-check.mjs` tego nie wykrywa. Skutek: P1 (blocker) w przeglądzie E-02.
- **Expected:** `node scripts/backlog-check.mjs` zgłasza przekazanie do epiku, którego nie pokrywa żaden task tego epiku ani wpis w jego „Out of scope”.

## Acceptance criteria

- [ ] AC1: Given task z frazą przekazania do epiku E-xx (np. „to E-02”, „w E-02”, „→ E-02”; wzorzec opisany w nagłówku skryptu) i epik E-xx, w którym żaden task nie odwołuje się do tego taska (`related_tasks` lub ID w treści) ani „Out of scope” go nie wymienia, when `node scripts/backlog-check.mjs`, then ostrzeżenie z plikiem, linią i epikiem docelowym. — verified by: test skryptu na fiksturze (`scripts/test/`), czerwony przed zmianą
- [ ] AC2: Given przekazanie pokryte (task E-xx ma ID źródłowego taska w `related_tasks` albo w treści), then brak ostrzeżenia. — verified by: jak AC1
- [ ] AC3: Na obecnym repo ostrzeżenie wskazuje `T-005-moje-listy.md:175` do czasu, aż T-094 doda `T-005` w `related_tasks` (T-094 już to ma → po zmianie brak ostrzeżenia); inne znalezione przekazania wymienione w Evidence. — verified by: uruchomienie na repo
- [ ] AC4: Ostrzeżenie, nie błąd (kod wyjścia 0), żeby nie blokować `/build-epic`; opis w `docs/architecture/pipeline.md` lub tam, gdzie opisano `backlog-check`. No regression in: `--write-index`, `--summary`, `--board`.

## TDD plan

**Seam:** CLI `scripts/backlog-check.mjs --root <fikstura>`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | niepokryte przekazanie → ostrzeżenie z plikiem i linią | unit | node:test / Vitest (jak istniejące `scripts/test/`) | AC1 |
| 2 | pokryte przekazanie → brak ostrzeżenia | unit | jak wyżej | AC2 |

**Run:** `node --test scripts/test/` (albo polecenie używane przez istniejące testy skryptów)

## QA plan

- **Regression:** `node scripts/backlog-check.mjs`, `--write-index`, `--summary --epic E-02`.
- **Edge cases:** przekazanie do epiku, który jeszcze nie ma tasków (E-03, E-04) — ostrzeżenie tylko gdy epik ma status inny niż `todo`, albo opisana decyzja; fraza w bloku kodu.
- **Platforms:** Node 18+, Windows i Linux (CI).

## Root cause

## Evidence

## Prevention

To zadanie jest prewencją dla klasy P1.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
