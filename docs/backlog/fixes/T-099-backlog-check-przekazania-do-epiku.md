---
id: T-099
title: "backlog-check: praca przekazana „to E-xx” musi mieć task albo wpis w epiku"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given task z frazą przekazania do epiku E-xx (np. „to E-02”, „w E-02”, „→ E-02”; wzorzec opisany w nagłówku skryptu) i epik E-xx, a linia przekazania nie wymienia taska ani story epiku E-xx i „Out of scope” E-xx nie wymienia taska źródłowego, when `node scripts/backlog-check.mjs`, then ostrzeżenie z plikiem, linią i epikiem docelowym. — verified by: test skryptu na fiksturze (`scripts/test/`), czerwony przed zmianą
- [x] AC2: Given przekazanie pokryte (linia przekazania wymienia task epiku E-xx — także fix task na gałęzi `epic/E-xx-…` — albo story E-xx, np. „to E-02 (F-13), przejął T-094”), then brak ostrzeżenia. Samo ID źródła w `related_tasks` lub treści taska E-xx nie pokrywa przekazania. — verified by: jak AC1
- [x] AC3: Na obecnym repo ostrzeżenie wskazuje `T-005-moje-listy.md:175`, dopóki ta linia nie wymieni odbiorcy (T-094); po dopisaniu brak ostrzeżenia; inne znalezione przekazania wymienione w Evidence. — verified by: uruchomienie na repo

> Zmiana kryteriów AC1–AC3 (decyzja właściciela 2026-11-06, `/implement-task T-099`): pierwotna reguła „task E-xx ma ID źródła w `related_tasks` albo w treści” nie wykryłaby P1 z T-005:175 — T-086 (`related_tasks: [T-005, …]`), T-058 i T-070 wymieniają T-005 z innych powodów, więc jeden duży task źródłowy „pokrywał” wszystkie swoje przekazania. Pokrycie liczone jest per linia przekazania.
- [x] AC4: Ostrzeżenie, nie błąd (kod wyjścia 0), żeby nie blokować `/build-epic`; opis w `docs/architecture/pipeline.md` lub tam, gdzie opisano `backlog-check`. No regression in: `--write-index`, `--summary`, `--board`.

## TDD plan

**Seam:** CLI `scripts/backlog-check.mjs --root <fikstura>`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | niepokryte przekazanie → ostrzeżenie z plikiem i linią | unit | node:test / Vitest (jak istniejące `scripts/test/`) | AC1 |
| 2 | pokryte przekazanie → brak ostrzeżenia | unit | jak wyżej | AC2 |
| 3 | „Out of scope” epiku docelowego wymienia źródło → brak ostrzeżenia; ID źródła poza tą sekcją nie pokrywa (dodany w trakcie) | unit | jak wyżej | AC1 |
| 4 | fraza z własnym epikiem taska → brak ostrzeżenia (dodany w trakcie) | unit | jak wyżej | AC1 |
| 5 | epik docelowy w statusie `todo` → brak ostrzeżenia (dodany w trakcie; decyzja z QA plan) | unit | jak wyżej | AC1 |
| 6 | fraza w bloku kodu / `kodzie` → brak ostrzeżenia (dodany w trakcie) | unit | jak wyżej | AC1 |
| 7 | fix task: epik z gałęzi `epic/E-xx` w treści — jako odbiorca i jako źródło (dodany w trakcie) | unit | jak wyżej | AC2 |

**Run:** `node --test scripts/test/backlog-check.test.mjs` (w CI: job `infra`)

## QA plan

- **Regression:** `node scripts/backlog-check.mjs`, `--write-index`, `--summary --epic E-02`.
- **Edge cases:** przekazanie do epiku, który jeszcze nie ma tasków (E-03, E-04) — ostrzeżenie tylko gdy epik ma status inny niż `todo`, albo opisana decyzja; fraza w bloku kodu.
- **Platforms:** Node 18+, Windows i Linux (CI).

## Root cause

`backlog-check` sprawdzał tylko frontmatter i zależności; nic nie czytało notatek tasków, więc przekazanie „„Opuść listę” to E-02” z T-005 (E-01) nie miało odbiorcy i nikt tego nie zauważył aż do przeglądu E-02 (P1).

## Evidence

Zmiana: sekcja „Handoffs” w `scripts/backlog-check.mjs` (opis reguły w komentarzu sekcji, odnośnik w nagłówku skryptu); test `scripts/test/backlog-check.test.mjs` (`node:test`, każdy test buduje backlog-fiksturę w katalogu tymczasowym i uruchamia CLI z `--root`); krok w jobie `infra` w `.github/workflows/ci.yml`.

**Reguła (po decyzji właściciela 2026-11-06, wyżej przy AC):** fraza `to|w|we|do E-xx` (słowo przed ID epiku) albo `→|-> E-xx`, poza blokami kodu i `kodem w linii`. Pokryta, gdy ta sama linia wymienia task E-xx (fix task należy do epiku, którego gałąź `epic/E-xx-…` wymienia jego treść) albo story E-xx, albo gdy „## Out of scope” E-xx wymienia task źródłowy. Pomijane: własny epik taska; epik docelowy w statusie `todo` (decyzja na edge case z QA plan: nieplanowany epik nie ma jeszcze tasków-odbiorców — ostrzeżenia pojawią się, gdy epik wystartuje). Jedno ostrzeżenie na linię i epik.

**Testy (red → green), `node --test scripts/test/backlog-check.test.mjs` — 14/14 pass:**

| # | Test | Czerwony przed zmianą |
| --- | --- | --- |
| 1 | niepokryte przekazanie → ostrzeżenie z plikiem, linią i epikiem docelowym (AC1) | `actual: 0, expected: 1` (brak ostrzeżenia) |
| 2 | linia wymienia task epiku docelowego → brak ostrzeżenia (AC2) | `actual: [ 'WARN … T-001-a.md:16: hands work over to E-02 …' ], expected: []` |
| 2 | linia wymienia story epiku docelowego → brak ostrzeżenia (AC2) | jak wyżej |
| 2 | ID źródła w `related_tasks` i treści taska E-xx nie pokrywa (AC2) | `actual: 0, expected: 1` (stara reguła pokrywała) |
| 2 | linia wymienia task/story innego epiku → ostrzeżenie (AC1) | strażnik, zielony od początku |
| 3 | „Out of scope” epiku docelowego wymienia źródło → brak ostrzeżenia | `actual: [ 'WARN …' ], expected: []` |
| 3 | ID źródła poza „Out of scope” nie pokrywa | strażnik, zielony od początku |
| 4 | fraza z własnym epikiem (`w E-01` w tasku E-01) → brak ostrzeżenia | ostrzeżenie dla E-01 |
| 5 | epik docelowy `todo` → brak ostrzeżenia | ostrzeżenie dla E-02 |
| 6 | fraza w bloku kodu i w `kodzie` → brak ostrzeżenia | ostrzeżenie dla E-02 |
| 7 | linia wymienia fix task na gałęzi `epic/E-02-…` → brak ostrzeżenia (jak T-094) | ostrzeżenie dla E-02 |
| 7 | fix task z gałęzi innego epiku nie pokrywa | strażnik, zielony od początku |
| 7 | fix task na gałęzi E-02 z frazą „→ E-02” → brak ostrzeżenia (własny epik) | ostrzeżenie dla E-02 |
| 8 | dwie frazy do tego samego epiku w jednej linii → jedno ostrzeżenie (dodany w trakcie; T-004:178 miał „to E-02” i „do E-02”) | `2 !== 1` |

**AC1, AC2:** testy 1–8 wyżej. Test 1 sprawdza też `OK: no errors` przy ostrzeżeniu (CLI przez `execFileSync`, który rzuca przy kodzie ≠ 0).

**AC3 — uruchomienie na repo:** po zmianie skryptu, przed adnotacjami, `node scripts/backlog-check.mjs` (kod 0) zgłosił 5 ostrzeżeń, w tym `docsacklogE-01-…S-01-03-moje-listyT-005-moje-listy.md:175: hands work over to E-02 ("to E-02") but names no E-02 task or story as receiver, and E-02 "Out of scope" does not list T-005`. Pozostałe przekazania do E-02 i ich odbiorcy (sprawdzeni w backlogu, dopisani w tej samej linii źródła):
- `T-005-moje-listy.md:175` „Opuść listę” → T-094 („; przejął T-094.”).
- `T-004-rejestracja-i-logowanie.md:33` zmiana imienia i usunięcie konta → T-061, T-062.
- `T-004-rejestracja-i-logowanie.md:178` SC-03 / „Nie pamiętasz hasła?” (dwie frazy, jedno ostrzeżenie) → T-053 (dodał link na SC-01).
- `T-010-staging.md:94` Brevo → T-055.

Po adnotacjach: `Tasks: 101 … OK: no errors`, bez ostrzeżeń. Przekazania do epików `todo` (dziś pomijane; pokazane na kopii backlogu z E-03 / E-04 przestawionymi na `in-progress`): `T-003-szkielet-mobile.md:31`, `:84` (E-04), `T-010-staging.md:93` (E-03), `T-005-moje-listy.md:171` (E-04), `T-009-zmiany-na-zywo.md:103`, `:181` (E-04), `T-088-alert-mailem-po-bledzie-uniewaznienia-linkow.md:215`, `:237` (E-03). Zgłosi je `backlog-check`, gdy E-03 / E-04 przejdą z `todo`.

**AC4:** ostrzeżenie (`WARN`), kod wyjścia 0 (test 1, uruchomienie na repo). Opis w `docs/architecture/pipeline.md` (tabela „Joby CI per warstwa”, wiersz „zawsze”) i w nagłówku skryptu. Brak regresji: `--summary --epic E-02` → poprawny JSON (`"ok":true`), `--json` kod 0, `--write-index --board` przy przekazaniu do QA (niżej, krok 9).

**Weryfikacja całości:** `pnpm format:check` OK; `pnpm lint` OK; `pnpm typecheck` OK; `pnpm quality` (jscpd, dependency-cruiser) OK; `pnpm design-check` OK; `node scripts/workflow-check.mjs` OK; actionlint 1.7.12 OK (zmieniony `ci.yml`); `pnpm test` 154 pliki / 1242 testy pass; `pnpm test:mobile` 10/10; `pnpm build` OK.

**Przewodnik warstwy (8b, fakty):** `docs/architecture/layers/infra.md` — „Gdzie jest kod” (T-099: test `backlog-check`) i „Komendy” (wiersz `node --test scripts/test/backlog-check.test.mjs`).

**Do uwagi QA:** (1) `scripts/backlog-check.mjs` to skrypt pipeline'u (wyłączony z Prettiera i ESLint) — aktualizacja skilla, która go nadpisze, usunie sekcję „Handoffs”. (2) Słowo „do” bywa czasowe („do E-02 ta ścieżka…”) — wtedy też trzeba wskazać odbiorcę albo wpisać w `kod`; świadomie wolę fałszywy alarm niż przeoczenie. (3) Edycja notatek tasków `done` (T-004, T-005, T-010) to tylko dopisanie odbiorcy w linii przekazania.

## Prevention

To zadanie jest prewencją dla klasy P1.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
