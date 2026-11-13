---
id: T-116
title: "backlog-check --write-index: „—” zamiast „undefined” w kolumnach Epic i Story zadań z fixes/"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given zadanie z `fixes/` bez `epic` i `story`, when uruchamia się `backlog-check --write-index`, then jego wiersz w `index.md` ma „—” w kolumnach Epic i Story. — verified by: test w `scripts/test/backlog-check.test.mjs`
- [x] AC2: Given repo po `--write-index`, then żadna komórka tabeli w `index.md` nie jest „undefined” (`grep -c "| undefined" docs/backlog/index.md` → 0; słowo zostaje tylko w tytule i nazwie pliku T-116). — verified by: `grep`, test T-116
- [x] AC3: Given opis kontroli T-110, then mówi, że „Definition of done” nie jest śledzone po `done` (decyzja 2026-11-10). — verified by: odczyt
- [x] AC4: No regression in: `node --test scripts/test/backlog-check.test.mjs`, `node scripts/backlog-check.mjs`.

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

Generator `--write-index` (`scripts/backlog-check.mjs:792`, od `ebca907`, 2026-10-26) wstawiał surowe `${t.epic}` i `${t.story}`; zadania z `docs/backlog/fixes/` (dodane później, `kind: fix`) nie mają tych pól, więc szablon dawał tekst „undefined”. Kolumna „Depends on” miała już zapas `|| "—"`, Epic i Story nie. Testy nie złapały tego, bo `scripts/test/backlog-check.test.mjs` nie sprawdzał wyjścia `--write-index` (tylko komunikaty kontroli), a sam `index.md` jest generowany i nikt go nie czyta w przeglądzie.

Ten sam wzorzec gdzie indziej: brak. Pozostałe użycia `t.epic`/`t.story` są w komunikatach błędów chronionych warunkiem (`if (t.epic && …)`) albo w `--board`, który dla `kind: fix` ma osobną gałąź.

## Evidence

- Test odtwarzający: `--write-index: wiersz zadania z fixes/ ma „—” w kolumnach Epic i Story, bez „undefined” (T-116 AC1, AC2)` w `scripts/test/backlog-check.test.mjs`. Przed poprawką: `AssertionError: + '| [T-002](fixes/T-002-a.md) | Fix T-002 | undefined | undefined | done | — |'  - '| [T-002](fixes/T-002-a.md) | Fix T-002 | — | — | done | — |'`. Po poprawce: pass; wiersz zadania epiku (`E-01 | S-01-01`) bez zmian.
- `node --test scripts/test/*.test.mjs` → 33 pass, 0 fail.
- `node scripts/backlog-check.mjs --write-index`; `grep -c "| undefined" docs/backlog/index.md` → 0 (przed: 88). AC2 doprecyzowane: dosłowne „undefined” zostaje w tytule i nazwie pliku T-116, nie jako wartość pola.
- AC3: zdanie o „Definition of done” w komentarzu kontroli AC (`scripts/backlog-check.mjs`, przy T-110) i w `docs/architecture/layers/infra.md` („Gdzie jest kod”), wiersz T-116 w „Historia zmian”.
- `pnpm check` → exit 0 (156 plików, 1278 testów), `pnpm build` → OK. Jeden wcześniejszy przebieg miał 2 przekroczenia czasu w `apps/web` (`ListScreen.edit.test.tsx`, `ListScreen.test.tsx`, ~1,8 s) — bez związku ze zmianą w `scripts/`; oba pliki osobno 35/35, kolejny pełny przebieg zielony (znana niestabilność, T-047).
- Przypadek brzegowy „epic bez story”: kod daje „—” dla każdego pustego pola osobno (`t.epic || "—"`, `t.story || "—"`).

## Prevention

Co by temu zapobiegło: test wyjścia `--write-index` — brakujący seam, teraz jest (test T-116 w `scripts/test/backlog-check.test.mjs`, uruchamiany w jobie `infra` w CI). Każdy kolejny regres w wierszach indeksu zadań z `fixes/` złamie ten test.

Propozycja dodatkowa (czeka na decyzję właściciela): wpis w „Pułapki” `infra.md` — pola frontmatter, których nie mają zadania z `fixes/` (`epic`, `story`), w szablonach tekstu zawsze z zapasem (`|| "—"`).

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-10)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | testy / dokumentacja | Nagłówek pliku testu nie wymienia nowego testu `--write-index` (T-116); opisuje tylko reguły T-099, T-110, T-117. | `scripts/test/backlog-check.test.mjs:1-5` | Nagłówek wspomina, że plik sprawdza też wyjście `--write-index` („—” w Epic/Story zadań z `fixes/`). |
| 2 | note | testy | Przypadek brzegowy z planu QA „epic bez story” nie ma testu; kod obsługuje każde pole osobno (`t.epic \|\| "—"`, `t.story \|\| "—"`), więc zachowanie jest poprawne z odczytu. | `scripts/backlog-check.mjs:793` | Opcjonalnie wiersz fikstury z `epic`, bez `story`. |
| 3 | note | proces | Sekcja „## Prevention” nadal ma placeholder `<Wypełnia /fix.>`. | plik zadania | Wypełnić albo usunąć przy domknięciu. |

Weryfikacja (uruchomione przez QA):

- AC1: pass — test `--write-index: wiersz zadania z fixes/ …` asertuje dosłowny wiersz `| — | — |` dla zadania z `fixes/` i niezmieniony wiersz zadania epiku. Spot-check: przywrócenie surowego `${t.epic}` → test czerwony (`Fix T-002 | undefined | — |`); przywrócone `git checkout`, `git status` czysty.
- AC2: pass — `node scripts/backlog-check.mjs --write-index`; `grep -c "| undefined" docs/backlog/index.md` → 0; „undefined” tylko w tytule T-116 (linie 20, 141, 332). Regenerowany `index.md` identyczny z commitowanym (brak zmian w `git status`).
- AC3: pass — komentarz przy kontroli AC w `scripts/backlog-check.mjs:248` i `docs/architecture/layers/infra.md:38`, wiersz T-116 w „Historia zmian” (`infra.md:116`).
- AC4: pass — `node --test scripts/test/*.test.mjs` → 33 pass, 0 fail; `node scripts/backlog-check.mjs` → `OK: no errors`; `pnpm check` → exit 0.
- Root cause wyjaśnia, dlaczego testy nie złapały błędu (brak testu wyjścia `--write-index`); test odtwarzający pada bez poprawki (spot-check wyżej). Czerwony komunikat w Evidence obecny.
- Bezpieczeństwo: zmiana tylko w skrypcie deweloperskim, bez danych użytkownika; brak `threats:`.
