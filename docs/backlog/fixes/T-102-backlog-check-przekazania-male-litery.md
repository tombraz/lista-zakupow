---
id: T-102
title: "backlog-check: przekazanie z małymi literami (`to e-02`) liczone jak `to E-02`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-099]
layers: [infra]
requirements: []
threats: []
screens: []
related_tasks: [T-099]
---

# T-102 backlog-check: przekazanie z małymi literami (`to e-02`) liczone jak `to E-02`

## Report

Źródło: QA T-099 runda 1 (2026-11-06), uwaga 1 (minor), zaakceptowana przez właściciela 2026-11-06. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** wzorzec `HANDOFF` w `scripts/backlog-check.mjs` (sekcja „Handoffs”) ma flagę `i`, więc łapie `to e-02`, ale target zostaje małymi literami (`e-02`). Porównania z ID epików (`ownerEpic(id) === target`, `target === epicOf(t)`, `epics.get(target)`) nie pasują. Skutek: ostrzeżenie `hands work over to e-02` także wtedy, gdy linia wymienia task E-02 jako odbiorcę, gdy to własny epik taska albo gdy epik docelowy jest w statusie `todo`. Odtworzone w QA T-099 na fiksturze `- Opuść listę to e-02.`; ten sam fałszywy alarm wywołał raport QA T-099 przed ujęciem przykładu w backticki.
- **Expected:** `to e-02` / `→ e-02` zachowuje się jak `to E-02`: te same reguły pokrycia i pomijania, a w komunikacie ID epiku wielkimi literami (`E-02`).

## Acceptance criteria

- [ ] AC1: Given linia `- Opuść listę to e-02; przejął T-002.` w tasku E-01 i T-002 w epiku E-02 (`in-progress`), when `node scripts/backlog-check.mjs`, then brak ostrzeżenia o przekazaniu. — verified by: test w `scripts/test/backlog-check.test.mjs`, czerwony przed zmianą
- [ ] AC2: Given `w e-01` w tasku E-01 (własny epik) albo `to e-02` przy E-02 w statusie `todo`, then brak ostrzeżenia. — verified by: jak AC1
- [ ] AC3: Given niepokryte `to e-02`, then jedno ostrzeżenie z `E-02` wielkimi literami (także gdy w tej samej linii jest `to E-02` i `do e-02`). — verified by: jak AC1
- [ ] AC4: No regression in: 14 testów T-099 w `scripts/test/backlog-check.test.mjs`; `node scripts/backlog-check.mjs` na repo bez ostrzeżeń; `--write-index`, `--summary`, `--board`.

## TDD plan

**Seam:** CLI `scripts/backlog-check.mjs --root <fikstura>`, jak testy T-099.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `to e-02` z odbiorcą T-002 w linii → brak ostrzeżenia | unit | node:test | AC1 |
| 2 | `w e-01` we własnym epiku i `to e-02` przy E-02 `todo` → brak ostrzeżenia | unit | node:test | AC2 |
| 3 | niepokryte `to e-02` → ostrzeżenie z `E-02`; `to E-02` i `do e-02` w jednej linii → jedno ostrzeżenie | unit | node:test | AC3 |

**Run:** `node --test scripts/test/backlog-check.test.mjs` (w CI: job `infra`)

## QA plan

- **Regression:** `node scripts/backlog-check.mjs`, `--write-index --board`, `--summary --epic E-02`.
- **Edge cases:** `→e-02` bez spacji; mieszane `E-02` / `e-02` w jednej linii; nieistniejący epik `e-09` (komunikat z `E-09`).
- **Platforms:** Node 18+, Windows i Linux (CI).

## Root cause

T-099 dodał flagę `i` do wzorca, żeby łapać „To E-02” i „W E-02” na początku zdania, ale nie znormalizował przechwyconego ID epiku. Testy T-099 używały tylko wielkich liter w ID, więc niedopasowanie nie wyszło.

## Evidence

## Prevention

Test z małymi literami w `scripts/test/backlog-check.test.mjs` (AC1–AC3).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
