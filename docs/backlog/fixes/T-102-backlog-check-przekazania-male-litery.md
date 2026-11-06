---
id: T-102
title: "backlog-check: przekazanie z małymi literami (`to e-02`) liczone jak `to E-02`"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given linia `- Opuść listę to e-02; przejął T-002.` w tasku E-01 i T-002 w epiku E-02 (`in-progress`), when `node scripts/backlog-check.mjs`, then brak ostrzeżenia o przekazaniu. — verified by: test w `scripts/test/backlog-check.test.mjs`, czerwony przed zmianą
- [x] AC2: Given `w e-01` w tasku E-01 (własny epik) albo `to e-02` przy E-02 w statusie `todo`, then brak ostrzeżenia. — verified by: jak AC1
- [x] AC3: Given niepokryte `to e-02`, then jedno ostrzeżenie z `E-02` wielkimi literami (także gdy w tej samej linii jest `to E-02` i `do e-02`). — verified by: jak AC1
- [x] AC4: No regression in: 14 testów T-099 w `scripts/test/backlog-check.test.mjs`; `node scripts/backlog-check.mjs` na repo bez ostrzeżeń; `--write-index`, `--summary`, `--board`.

## TDD plan

**Seam:** CLI `scripts/backlog-check.mjs --root <fikstura>`, jak testy T-099.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `to e-02` z odbiorcą T-002 w linii → brak ostrzeżenia | unit | node:test | AC1 |
| 2 | `w e-01` we własnym epiku i `to e-02` przy E-02 `todo` → brak ostrzeżenia | unit | node:test | AC2 |
| 3 | `niepokryte `to e-02` → ostrzeżenie z `E-02`; `to E-02` i `do e-02` w jednej linii → jedno ostrzeżenie` | unit | node:test | AC3 |

**Run:** `node --test scripts/test/backlog-check.test.mjs` (w CI: job `infra`)

## QA plan

- **Regression:** `node scripts/backlog-check.mjs`, `--write-index --board`, `--summary --epic E-02`.
- **Edge cases:** `→e-02` bez spacji; mieszane `E-02` / `e-02` w jednej linii; nieistniejący epik `e-09` (komunikat z `E-09`).
- **Platforms:** Node 18+, Windows i Linux (CI).

## Root cause

T-099 dodał flagę `i` do wzorca, żeby łapać „To E-02” i „W E-02” na początku zdania, ale nie znormalizował przechwyconego ID epiku. Testy T-099 używały tylko wielkich liter w ID, więc niedopasowanie nie wyszło.

## Evidence

Zmiana: `scripts/backlog-check.mjs`, sekcja „Handoffs” — przechwycone ID epiku normalizowane `toUpperCase()` przed porównaniami (`reported`, własny epik, status `todo`, `received`) i w komunikacie; komentarz sekcji mówi, że wielkość liter nie ma znaczenia.

**TDD** (`node --test scripts/test/backlog-check.test.mjs`, seam: CLI z `--root`, jak T-099):

| # | Test | Red (przed zmianą) | Teraz |
| --- | --- | --- | --- |
| 1 | `„to e-02” z odbiorcą T-002 w linii → brak ostrzeżenia (T-102 AC1)` | `deepStrictEqual`: oczekiwano `[]`, jest `WARN … hands work over to e-02 ("to e-02") but names no e-02 task …` | pass |
| 2 | `„w e-01” we własnym epiku i „to e-02” przy E-02 w statusie todo → brak ostrzeżenia (T-102 AC2)` | oczekiwano `[]`, jest `WARN … hands work over to e-01 ("w e-01") …` | pass |
| 3 | `niepokryte „to e-02” → jedno ostrzeżenie z E-02, także z „to E-02” i „do e-02” w linii (T-102 AC3)` | `doesNotMatch`/`match`: komunikat `hands work over to e-02 … names no e-02 task` zamiast `E-02` | pass |

Uwaga dla QA: test 1 był czerwony przed jakąkolwiek zmianą produkcyjną. Jedna linia poprawki (green testu 1) naprawiła też zachowania z testów 2 i 3, więc ich czerwień pokazałem, cofając na chwilę poprawkę (`target = m[1] ?? m[2]`) — wszystkie trzy testy padały na asercjach pokazanych wyżej — i przywracając ją. Wszystkie 17 testów przechodzi.

**Kryteria akceptacji:**

- AC1: test 1.
- AC2: test 2 (oba przypadki: własny epik i epik w `todo`).
- AC3: test 3 (pojedyncze `to e-02` oraz linia z `to E-02; do e-02` → jedno ostrzeżenie z `E-02`).
- AC4: 14 testów T-099 przechodzi (17/17 łącznie); `node scripts/backlog-check.mjs` → `OK: no errors`, brak ostrzeżeń o przekazaniu; `--summary --epic E-02` → `"ok":true`; `--write-index --board` przechodzi przy przekazaniu do QA. `pnpm check` (format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check, workflow-check, 1242 testy vitest, mobile) — exit 0.
- Przypadki brzegowe z planu QA, sprawdzone ręcznie na fiksturze tymczasowej: `→e-02` bez spacji → `hands work over to E-02 ("→e-02")`; `to E-02 i to e-02` → jedno ostrzeżenie; `to e-09` (nieistniejący epik) → komunikat z `E-09`. Fragment w cudzysłowie (`"to e-02"`) pokazuje tekst w oryginalnej formie.

Przewodniki warstw: bez zmian.

## Prevention

Test z małymi literami w `scripts/test/backlog-check.test.mjs` (AC1–AC3).

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-06)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | test quality | Brak błędów. Testy gryzą: po cofnięciu `toUpperCase()` padają wszystkie 3 nowe testy (14/17 pass), 14 testów T-099 dalej przechodzi; po przywróceniu 17/17. | spot-check QA, `git status` czysty po przywróceniu | — |
| 2 | note | exploratory | Przypadki brzegowe z planu QA działają: `→e-02` → `E-02`; `to E-02 i to e-02` → jedno ostrzeżenie; `to e-09` → `E-09`; `To e-02 przejmie T-002` → brak; `` `to e-02` `` w backtickach → brak; `-> e-02` → `E-02`; `to e-02x` → brak; `we e-02, T-002` → brak. | fikstury tymczasowe, CLI `--root` | — |

Reprodukcja: `node --test scripts/test/backlog-check.test.mjs` → 17/17 pass; `pnpm check` → exit 0 (format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check, workflow-check, vitest, mobile jest); `node scripts/backlog-check.mjs` → `OK: no errors`, brak ostrzeżeń o przekazaniu; `--summary --epic E-02` → `"ok":true`.

Kryteria: AC1 pass, AC2 pass (oba przypadki), AC3 pass (komunikat z `E-02`, jedno ostrzeżenie przy mieszanej wielkości liter), AC4 pass.

Code review: zmiana minimalna (jedna linia + komentarz sekcji), bez zmian zakresu; znormalizowany target trafia do wszystkich porównań (`reported`, własny epik, `todo`, `received`) i do komunikatu. Root cause wyjaśnia, czemu testy T-099 nie złapały błędu (tylko wielkie litery w fiksturach). Red evidence opisana i potwierdzona spot-checkiem QA.
