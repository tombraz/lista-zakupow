---
id: T-065
title: Zapytania miar sukcesu (metrics.sql)
epic: E-02
story: S-02-05
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given dane aktywności, when zapytanie „aktywni domownicy”, then dla każdego tygodnia (poniedziałek–niedziela, `Europe/Warsaw`) liczba różnych `user_id` z aktywnością na listach wspólnych (lista z co najmniej jednym uczestnikiem); definicja „aktywny” i „wspólna” zapisana w komentarzu pliku. — verified by: test integracyjny na danych fabrykowanych
- [ ] AC2: Given dane aktywności, when zapytanie „dni wspólnych zakupów”, then dla każdego tygodnia liczba dni, w których na którejś wspólnej liście suma `checks` ≥ 3. — verified by: test integracyjny (granica 2 / 3 odhaczeń, dwie listy tego samego dnia)
- [ ] AC3: Given wynik, then zawiera tylko tydzień i liczby (bez imion, e-maili, nazw list, identyfikatorów). Plik działa w `psql` bez modyfikacji i tylko czyta (bez `INSERT`/`UPDATE`/`DELETE`/DDL). — verified by: test uruchamiający plik na bazie + sprawdzenie kolumn
- [ ] AC4: Instrukcja uruchomienia (lokalnie i na bazie produkcyjnej tylko do odczytu) w przewodniku db (`docs/architecture/layers/db.md`, „Komendy”). — verified by: przegląd QA

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
