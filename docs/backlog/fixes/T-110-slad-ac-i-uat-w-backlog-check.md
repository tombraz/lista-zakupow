---
id: T-110
title: "`backlog-check`: zadanie `done` z nieodhaczonym AC i statusy w `UAT.md` niezgodne z plikami zadań"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [infra]
requirements: []
threats: []
screens: []
related_tasks: [T-099, T-102, T-105]
---

# T-110 `backlog-check`: zadanie `done` z nieodhaczonym AC i statusy w `UAT.md` niezgodne z plikami zadań

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-09-1.md`, P1 i P2 (minor). Ta klasa powtarza się trzeci raz: P7 i P6 z przeglądu 2, P3 i P2 z przeglądu 3. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - T-103 (5 AC), T-104 (3), T-106 (4) i T-108 (3) mają `status: done` i QA `pass`, a wszystkie AC są nieodhaczone (`- [ ]`). T-105 i T-107 mają je odhaczone.
  - `docs/backlog/E-02-konto-i-uczestnicy/UAT.md:33` podaje T-106 jako `todo` (jest `done`) i nie wymienia T-107 ani T-108.
  - `UAT.md:3` wskazuje rundę 3 jako ostatni przegląd.
  - T-105 AC5 i AC6 poprawiły to ręcznie, ale nic nie pilnuje, żeby tak zostało.
- **Expected:** stan zadań w plikach jest spójny: zadanie `done` ma odhaczone AC, a `UAT.md` podaje statusy zgodne z plikami zadań. Źródło: T-105 AC5, AC6.
- **Steps to reproduce:**
  1. `grep -c '^- \[ \]' docs/backlog/fixes/T-103-*.md` → 5 przy `status: done`.
  2. `pnpm backlog-check` → OK.
- **Environment:** lokalnie, commit `f0eb4d6`.
- **Evidence:** `docs/reviews/E-02-2026-11-09-1.md`, P1, P2.

## Acceptance criteria

- [ ] AC1: Given plik zadania ze `status: done` i co najmniej jednym `- [ ]` w sekcji „Acceptance criteria”, when uruchamia się `backlog-check`, then kończy się błędem, który wskazuje plik i liczbę nieodhaczonych AC. — verified by: test w `scripts/test/backlog-check.test.mjs` (fikstura)
- [ ] AC2: Given `UAT.md` epiku, który przy ID zadania podaje status (`T-NNN … \`todo\``) różny od `status:` w pliku tego zadania, when uruchamia się `backlog-check`, then kończy się błędem, który wskazuje linię `UAT.md`, ID i oba statusy. — verified by: test w `scripts/test/backlog-check.test.mjs`
- [ ] AC3: Given repo po zmianie, then AC w T-103, T-104, T-106 i T-108 są odhaczone (po sprawdzeniu, że ich QA `pass` je potwierdza). `UAT.md` E-02 podaje statusy T-103–T-112 i wskazuje `docs/reviews/E-02-2026-11-09-1.md` jako ostatni przegląd. `pnpm backlog-check` jest zielony. — verified by: `pnpm backlog-check`
- [ ] AC4: No regression in: T-099, T-102 (kontrola przekazań do epiku), `pnpm workflow-check`.

## TDD plan

**Seam:** `node scripts/backlog-check.mjs` uruchamiany na fiksturze katalogu backlogu.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `done` z `- [ ] AC1` → błąd z plikiem | unit | node:test | AC1 |
| 2 | `done` z odhaczonymi AC → OK; `todo` z nieodhaczonymi → OK | unit | node:test | AC1 |
| 3 | `UAT.md` z `T-106 … \`todo\`` przy pliku `done` → błąd | unit | node:test | AC2 |

**Run:** `node --test scripts/test/backlog-check.test.mjs`

## QA plan

- **Regression:** `pnpm backlog-check` na całym repo (E-01, E-02, fixes), `--write` dla `index.md`.
- **Edge cases:** AC w podsekcji albo z wcięciem, `- [x]` z wielkim `X`, zadanie bez sekcji AC, status w `UAT.md` w innym zapisie (bez backticków), ID wymienione w `UAT.md` bez statusu (nie jest błędem).
- **Platforms:** Windows i CI (Linux).

## Root cause

Żaden krok przepływu nie odhacza AC przy werdykcie `pass`, a `backlog-check` nie porównuje AC ze statusem ani `UAT.md` z plikami. Dlatego poprawki ręczne (T-105 AC5, AC6) wystarczają tylko do następnego zadania.

## Evidence

Reproducing tests (`scripts/test/backlog-check.test.mjs`, `node --test`), red przed zmianą:

- „done z nieodhaczonym AC → błąd z plikiem i liczbą nieodhaczonych AC (T-110 AC1)”: `0 !== 1` (wyjście „OK: no errors”).
- „UAT.md podaje status inny niż plik zadania → błąd z linią, ID i oboma statusami (T-110 AC2)”: `0 !== 1`.
- „UAT.md: status dla kilku ID i zakresu, zapis „(todo)” bez backticków → każde ID sprawdzone (T-110 AC2)”: `0 !== 2`.
- Dwa testy przypadków poprawnych (odhaczone AC i `[X]`, `todo`/`in-qa` z nieodhaczonymi, brak sekcji AC; ID bez statusu, `;`, ID w `kodzie`) zielone przed i po zmianie.

Po zmianie: 23/23 (`node --test scripts/test/*.test.mjs`). Pierwszy przebieg na repo: błąd `UAT.md:33` (T-106 `todo` przy `done`) i 38 zadań `done` z nieodhaczonymi AC (nie 4 z raportu: także T-013–T-044, T-055, T-072–T-089, T-109). Każde z 38 ma ostatnią rundę QA `Verdict: pass`, a w rundach QA nie ma uwagi o niezweryfikowanym AC, więc AC odhaczono w sekcji „Acceptance criteria” (poza nią bez zmian). `UAT.md`: runda 4 jako ostatni przegląd, statusy T-103–T-112 (T-110 jak T-105 w rundzie 3: odesłanie do pliku zadania, bo status zmienia QA).

Statyczne: `pnpm backlog-check` OK, `--write-index` OK, `pnpm workflow-check` OK, `pnpm format:check`, `pnpm lint`, `pnpm typecheck` zielone, `pnpm test` 1265 testów, 0 błędów. Kod aplikacji bez zmian (build nie dotyczy).

Przyczyna w przepływie: `/qa-task` przy `Pass` ustawiał tylko `status: done`; krok „Pass” w `.claude/skills/qa-task/SKILL.md` każe teraz odhaczyć zweryfikowane AC i poprawić status w `UAT.md`.

## Prevention

Kontrola w `backlog-check` zaakceptowana przez właściciela 2026-11-09 (przegląd E-02 runda 4).

<!-- QA rounds are appended below by /qa-task -->
