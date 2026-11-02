---
id: T-065
title: Zapytania miar sukcesu (metrics.sql)
epic: E-02
story: S-02-05
status: in-qa           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: S                # S | M (L must be split)
layers: [db]
requirements: [N-02]
threats: []
screens: []
---

# T-065 Zapytania miar sukcesu (metrics.sql)

## Goal

Właściciel uruchamia `apps/api/scripts/metrics.sql` na bazie i dostaje dwie miary z BRD §10 policzone z danych aplikacji, tydzień po tygodniu: liczbę aktywnych uczestników wspólnych list i liczbę dni z co najmniej 3 odhaczeniami na wspólnej liście. Bez danych osobowych w wyniku.

## Demo

`psql "$DATABASE_URL" -f apps/api/scripts/metrics.sql` na bazie z danymi seed → dwie tabele: `tydzień | aktywni_domownicy` i `tydzień | dni_wspólnych_zakupów`, wartości zgodne z danymi.

## Context

- BRD §10: „Domownicy regularnie używający wspólnej listy ≥ 2 — liczba aktywnych uczestników tygodniowo”; „Wspólne zakupy z aplikacją zamiast kartki ≥ 3 w tygodniu — liczba dni z co najmniej 3 odhaczonymi pozycjami na wspólnej liście (przybliżenie)”; trzecia miara ręcznie (`docs/pilot-log.md`).
- Architektura: `architecture.md` „Obserwowalność” (zapytania SQL w `apps/api/scripts/metrics.sql` na tabeli aktywności dziennej, uruchamiane ręcznie po 4 tygodniach), `data-model.md` (`list_daily_activity (list_id, day, user_id, checks)`, retencja 90 dni), moduł `statystyki` (`recordCheck` przy odhaczeniu).
- Depends on: — .

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given dane aktywności, when zapytanie „aktywni domownicy”, then dla każdego tygodnia (poniedziałek–niedziela, `Europe/Warsaw`) liczba różnych `user_id` z aktywnością na listach wspólnych (lista z co najmniej jednym uczestnikiem); definicja „aktywny” i „wspólna” zapisana w komentarzu pliku. — verified by: test integracyjny na danych fabrykowanych
- [x] AC2: Given dane aktywności, when zapytanie „dni wspólnych zakupów”, then dla każdego tygodnia liczba dni, w których na którejś wspólnej liście suma `checks` ≥ 3. — verified by: test integracyjny (granica 2 / 3 odhaczeń, dwie listy tego samego dnia)
- [x] AC3: Given wynik, then zawiera tylko tydzień i liczby (bez imion, e-maili, nazw list, identyfikatorów). Plik działa w `psql` bez modyfikacji i tylko czyta (bez `INSERT`/`UPDATE`/`DELETE`/DDL). — verified by: test uruchamiający plik na bazie + sprawdzenie kolumn
- [x] AC4: Instrukcja uruchomienia (lokalnie i na bazie produkcyjnej tylko do odczytu) w przewodniku db (`docs/architecture/layers/db.md`, „Komendy”). — verified by: przegląd QA

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- plik SQL wykonany na bazie Testcontainers z danymi z fabryk

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | aktywni domownicy tygodniowo (lista wspólna vs prywatna, granica tygodnia) | integration | Vitest + Testcontainers | AC1 |
| 2 | dni z ≥ 3 odhaczeniami (granica 2 / 3) | integration | Vitest + Testcontainers | AC2 |
| 3 | kolumny wyniku bez danych osobowych; plik tylko czyta | integration | Vitest + Testcontainers | AC3 |

**Run:** `pnpm vitest run --project api metrics`

**Mocks:** brak. Baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** tydzień przełomu roku; lista, która przestała być wspólna (uczestnik wyszedł) — liczona wg stanu dziś czy z dnia aktywności? (zapisać decyzję w komentarzu); użytkownik usunięty (aktywność kaskadowo usunięta — wpływ na miarę opisany).
- **Platforms / devices:** `psql` lokalnie; Neon SQL Editor.
- **Security / privacy:** wynik bez danych osobowych; uruchomienie na produkcji rolą tylko do odczytu (opisane).
- **Regression:** `recordCheck` (T-007), sprzątanie aktywności po 90 dniach (T-064).

## Implementation notes

- „Wspólna lista” w danych: `list_member` dziś istnieje dla listy. Aktywność rejestrowana tylko przy odhaczeniu (moduł `statystyki`) — jeśli „aktywny” ma obejmować też dodawanie pozycji, to zmiana `recordCheck` i decyzja właściciela; nie poszerzaj zakresu bez pytania.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Wznowienie po odpowiedzi właściciela (Docker działa). Pliki: `apps/api/scripts/metrics.sql`, `apps/api/test/metrics.test.ts`; przewodnik db (Gdzie jest kod + Komendy).

**Testy (red → green), `pnpm vitest run --project api metrics`:**

1. `counts distinct active users per Monday-Sunday week, only on shared lists (AC1)` — red na stubie pliku (oba `SELECT … WHERE false`): `AssertionError: expected [] to deeply equal [ …(3) ]`; zielony po zapytaniu „aktywni domownicy”. Dane: niedziela 2026-11-01 w tygodniu od 2026-10-26, poniedziałek 2026-11-02 nowy tydzień, lista prywatna pominięta, przełom roku 2026-12-31/2027-01-01 = jeden tydzień od 2026-12-28.
2. `counts days per week with at least 3 checks on one shared list (AC2)` — red: `AssertionError: expected [] to deeply equal [ …(3) ]`; zielony po zapytaniu „dni wspólnych zakupów”. Granica 2 (nie) / 3 (tak, suma dwóch osób), 2 + 2 na dwóch listach tego dnia = nie liczy się, dwie listy po 3 tego samego dnia = jeden dzień, lista prywatna z 9 pominięta, tydzień bez dnia ≥ 3 = 0.
3. `returns only week and counts, and the file only reads (AC3)` — przeszedł od razu (zachowanie powstało w testach 1–2). Dowód, że gryzie (każda zmiana cofnięta, potem 3/3 zielone): dopisany `DELETE FROM list_daily_activity;` → `error: cannot execute DELETE in a read-only transaction`; dodana kolumna `min(a.user_id) AS uid` → `AssertionError` na liście kolumn; dopisane `\echo hi` → fail na braku metakomend.

**Kryteria:**

- AC1: test 1; definicje „tydzień”, „wspólna lista” (stan członkostw dziś — decyzja z QA planu zapisana w komentarzu pliku), „aktywny” i skutek usunięcia konta / retencji 90 dni w nagłówku pliku.
- AC2: test 2.
- AC3: test 3 (plik wykonany cały w `BEGIN READ ONLY`, kolumny dokładnie `tydzień` + liczba, bez metakomend i sterowania transakcją). Ręcznie: `psql -v ON_ERROR_STOP=1 -f -` w kontenerze `lista-zakupow-postgres-1` (`pnpm services:up` + migracje) na danych fabrykowanych w transakcji wycofanej → `2026-11-02 | 2` i `2026-11-02 | 1`; ten sam plik z `PGOPTIONS='-c default_transaction_read_only=on'` → dwie tabele, bez błędu.
- AC4: wiersz „miary sukcesu” w `docs/architecture/layers/db.md` → „Komendy” (lokalnie, bez lokalnego psql przez `docker exec`, produkcja rolą tylko do odczytu Neon / `default_transaction_read_only` / Neon SQL Editor) — do przeglądu QA.

**Weryfikacja całości:** `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, testy: 142 pliki / 937 testów, mobile) — exit 0; `pnpm build` — exit 0.

**Decyzje dla QA:** tydzień bez aktywności na wspólnej liście nie ma wiersza (obie miary); tydzień z aktywnością, ale bez dnia ≥ 3, ma 0 w mierze 2. Filtr „lista wspólna” (`EXISTS list_member`) powtórzony w obu zapytaniach — widok byłby DDL, a plik ma tylko czytać.

## Open question

**Co się nie udało (FAILED, środowisko):** demon Dockera nie działa (`docker info`: brak `npipe:////./pipe/dockerDesktopLinuxEngine`), a cały plan TDD tego taska to testy integracyjne Vitest + Testcontainers. Bez Dockera nie da się zobaczyć ani czerwonego, ani zielonego testu, więc nie napisano jeszcze ani testu, ani `apps/api/scripts/metrics.sql`. Agent nie ma uprawnień do uruchomienia Docker Desktop.

**Pytanie:** czy uruchomisz Docker Desktop (i zostawisz go włączonego na czas pętli), żeby można było wznowić T-065?

**Rekomendacja:** uruchomić Docker Desktop i dopisać `Answer:` — kolejny przebieg zaczyna od testu 1 planu.

**Alternatywa:** dać agentowi uprawnienie do startu Docker Desktop (reguła w ustawieniach Claude Code), żeby pętla sama podnosiła demona.

**Ustalenia na wznowienie (niezależne od środowiska):** `list_daily_activity.day` jest już datą w `Europe/Warsaw` (zapis w `statystyki`), więc tydzień = `date_trunc('week', day)::date` (poniedziałek; przełom roku nie dzieli tygodnia). „Wspólna” = lista, która **dziś** ma wiersz `list_member` (historii członkostw nie ma) — do zapisania w komentarzu pliku. Test uruchamia plik jednym zapytaniem `pg` w transakcji `BEGIN READ ONLY` (dowód „tylko czyta”); plik bez metakomend psql.

Answer: Docker działa (uruchomiony przez właściciela) — wznów TDD z testami Testcontainers.
