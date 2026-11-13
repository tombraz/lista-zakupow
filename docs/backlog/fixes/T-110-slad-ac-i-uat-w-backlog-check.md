---
id: T-110
title: "`backlog-check`: zadanie `done` z nieodhaczonym AC i statusy w `UAT.md` niezgodne z plikami zadań"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given plik zadania ze `status: done` i co najmniej jednym `- [ ]` w sekcji „Acceptance criteria”, when uruchamia się `backlog-check`, then kończy się błędem, który wskazuje plik i liczbę nieodhaczonych AC. — verified by: test w `scripts/test/backlog-check.test.mjs` (fikstura)
- [x] AC2: Given `UAT.md` epiku, który przy ID zadania podaje status (`T-NNN … \`todo\``) różny od `status:` w pliku tego zadania, when uruchamia się `backlog-check`, then kończy się błędem, który wskazuje linię `UAT.md`, ID i oba statusy. — verified by: test w `scripts/test/backlog-check.test.mjs`
- [x] AC3: Given repo po zmianie, then AC w T-103, T-104, T-106 i T-108 są odhaczone (po sprawdzeniu, że ich QA `pass` je potwierdza). `UAT.md` E-02 podaje statusy T-103–T-112 i wskazuje `docs/reviews/E-02-2026-11-09-1.md` jako ostatni przegląd. `pnpm backlog-check` jest zielony. — verified by: `pnpm backlog-check`
- [x] AC4: No regression in: T-099, T-102 (kontrola przekazań do epiku), `pnpm workflow-check`.

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

Po zmianie: 23/23 (`node --test scripts/test/*.test.mjs`). Pierwszy przebieg na repo: błąd `UAT.md:33` (T-106 `todo` przy `done`) i 38 zadań `done` z nieodhaczonymi AC (nie 4 z raportu: także T-013–T-044, T-055, T-072–T-089, T-109). Każde z 38 ma ostatnią rundę QA `Verdict: pass`, więc AC odhaczono w sekcji „Acceptance criteria” (poza nią bez zmian). Korekta po QA runda 1 (minor): dwa AC nie były weryfikowalne w swojej rundzie QA. T-055 AC4/SEC2 zweryfikowało później T-069, a T-021 AC3 (CI Linux) zielony CI na `main` (`c3dbc86`). Oba pliki podają teraz to źródło w sekcji AC. `UAT.md`: runda 4 jako ostatni przegląd, statusy T-103–T-112 (T-110 jak T-105 w rundzie 3: odesłanie do pliku zadania, bo status zmienia QA).

Statyczne: `pnpm backlog-check` OK, `--write-index` OK, `pnpm workflow-check` OK, `pnpm format:check`, `pnpm lint`, `pnpm typecheck` zielone, `pnpm test` 1265 testów, 0 błędów. Kod aplikacji bez zmian (build nie dotyczy).

Przyczyna w przepływie: `/qa-task` przy `Pass` ustawiał tylko `status: done`; krok „Pass” w `.claude/skills/qa-task/SKILL.md` każe teraz odhaczyć zweryfikowane AC i poprawić status w `UAT.md`.

## Prevention

Kontrola w `backlog-check` zaakceptowana przez właściciela 2026-11-09 (przegląd E-02 runda 4). Właściciel 2026-11-09 przyjął też propozycję z QA runda 1: krok „Pass” w `.claude/skills/qa-task/SKILL.md` każe odhaczać zweryfikowane AC, poprawiać status w `UAT.md`, a AC zweryfikowane poza rundą QA odhaczać z linią o źródle. Zmiana w pakiecie skilli (product-skills v4.9) do zgłoszenia u źródła; `scripts/backlog-check.mjs` nie jest nadpisywany przy aktualizacji (`plan-backlog` kopiuje go tylko, gdy go brak). Kontrola `story.md` niepotrzebna: 11 story `done`, żadna z nieodhaczonym polem.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-09)

Verdict: pass

Zakres: commit `39daa7d` (implementacja), `064f6bc` (in-qa). Kod aplikacji bez zmian; zmienione `scripts/backlog-check.mjs`, jego testy, `.claude/skills/qa-task/SKILL.md` i pliki backlogu.

**Reprodukcja (Windows, lokalnie):** `node --test scripts/test/*.test.mjs` 23/23; `pnpm backlog-check` OK (exit 0); `--write-index` bez zmian w drzewie; `pnpm workflow-check` OK; `pnpm format:check`, `pnpm lint`, `pnpm typecheck` zielone. `pnpm test`: 1237/1238 — 1 błąd `apps/web/src/live/connection.test.tsx > back online > SC-06: subscribes again…` przy pełnym przebiegu; ten plik osobno 3× zielony (4/4). Zadanie nie dotyka `apps/web`, klasa niestabilności znana (T-083, T-084) — zob. #2.

**Kryteria:**

- AC1 — pass. Test „done z nieodhaczonym AC…” sprawdza kod 1, jedną linię `ERROR` z plikiem i „2 of 3” (AC w podsekcji `###` i z wcięciem liczone; `- [ ]` w „Report” i „Notes” nie). Na repo: `- [x] AC2` → `- [ ]` w T-103 daje `ERROR …T-103…: status done but 1 of 5 acceptance criteria are unchecked`, exit 1. Przypadki OK (`[X]`, `* [x]`, `todo`/`in-qa` z nieodhaczonymi, brak sekcji) — test zielony.
- AC2 — pass. Testy sprawdzają linię, ID i oba statusy, zakres `T-003–T-004`, zapis `(todo)`, ID bez statusu, `;` i ID w `kodzie`. Na repo: T-109 `done`→`todo` w `UAT.md` → `UAT.md:34: T-109 is "todo" here but "done" in …T-109…`; dopisana linia `T-110 (in-qa) T-111 \`done\`` → błąd tylko dla T-111; ID w bloku ``` pominięte.
- AC3 — pass. AC w T-103, T-104, T-106, T-108 odhaczone; diff 38 plików zadań zmienia wyłącznie `- [ ]`→`- [x]` (126 linii, ten sam tekst). `UAT.md:3` wskazuje `docs/reviews/E-02-2026-11-09-1.md` (runda 4); statusy T-103–T-112 zgodne z plikami (T-110 odesłany do pliku zadania). `pnpm backlog-check` zielony.
- AC4 — pass. Testy T-099/T-102 w `backlog-check.test.mjs` zielone, `pnpm workflow-check` OK.

**Jakość testów:** spot-check — wyłączone oba `errors.push` (AC i UAT) w `backlog-check.mjs` → 3 testy czerwone (19/22); przywrócone, `git status` czysty. Red evidence w sekcji Evidence dla 3 testów reprodukujących. Wartości oczekiwane to literały. Root cause wyjaśnia, czemu żaden test tego nie łapał (brak kontroli).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | backlog / Evidence | Evidence twierdzi, że w rundach QA 38 zadań „nie ma uwagi o niezweryfikowanym AC”. Nieprawda dla T-055 (QA round 1: „AC4 — not verifiable”, implementer: „AC4 i SEC2 zostają nieodhaczone celowo”) i T-021 (AC3 „CI Linux nieweryfikowalne”). Odhaczenie jest merytorycznie uzasadnione (AC4 T-055 zweryfikowane w T-069, `deployment.md:68`; sekrety w UAT.md „spełnione”), ale w T-055 brak wpisu, na czym opiera się odhaczenie. | `T-055-…md:119,156`; `T-021-…md:107` | Przy odhaczaniu AC zweryfikowanego poza rundą QA dopisać w zadaniu jedną linię ze źródłem (np. „AC4, SEC2 — zweryfikowane w T-069”). |
| 2 | note | testy | `connection.test.tsx` „back online … SC-06” niestabilny przy pełnym `pnpm test` (1 błąd / 1238), osobno zielony 3×. Niezwiązane z T-110. | przebieg `pnpm test` 2026-11-09 | Dołączyć do T-084 albo osobnej poprawki niestabilnego testu. |
| 3 | note | backlog-check | Kontrola AC obejmuje tylko zadania; story `done` z nieodhaczonymi AC nie jest sprawdzana (poza zakresem AC1). | `backlog-check.mjs:244-253` | Rozważyć rozszerzenie na `story.md`. |
