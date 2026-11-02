---
id: T-085
title: "Test izolacji bazy testowej niezależny od kolejności testów"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa    # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: []
screens: []
related_tasks: [T-021, T-051, T-070]
---

# T-085 Test izolacji bazy testowej niezależny od kolejności testów

## Report

Źródło: QA T-070 runda 1, uwaga #3; założone na prośbę właściciela 2026-11-02.

- **Actual:** `apps/api/test/database.test.ts` › `starts the next test with empty tables` pada przy `pnpm vitest run --project api --sequence.shuffle --sequence.seed=4242`, także gdy plik jest uruchomiony sam. Test celowo zależy od tego, że `lets a test write data` wykona się przed nim (komentarz w pliku); `--sequence.shuffle` miesza też testy wewnątrz pliku.
- **Expected:** każdy plik testów API przechodzi w losowej kolejności. Źródło: `layers/backend.md`, „Pułapki” (nowy test potwierdzać przebiegiem w losowej kolejności plików dla kilku seedów, QA T-051 runda 2). Test, który pada bez związku ze zmianą, czyni tę kontrolę fałszywym alarmem.
- **Steps to reproduce:**
  1. `pnpm vitest run --project api --sequence.shuffle --sequence.seed=4242 database`
  2. Wynik: 1 failed (`starts the next test with empty tables`).
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy`, `6e32bc1`.
- **Evidence:** Evidence T-070 i QA T-070 runda 1.

## Acceptance criteria

- [x] AC1: Given `database.test.ts`, when uruchamiam go z `--sequence.shuffle` dla kilku seedów (w tym 4242), then wszystkie testy przechodzą, a plik nadal dowodzi, że test zaczyna się od pustych tabel (zapis z jednego testu nie jest widoczny w drugim). — verified by: przebieg z seedami
- [x] AC2: Given harness bazy z zepsutym czyszczeniem (`truncateAllTables` pominięte lokalnie), when uruchamiam plik w dowolnej kolejności, then test izolacji pada. — verified by: kontrola ręczna, czerwony wynik w Evidence, zmiana cofnięta
- [x] AC3: No regression in: pełny zestaw testów API.

## TDD plan

**Seam:** harness testów (`useTestDatabase`) przez prawdziwy PostgreSQL (Testcontainers).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Przebieg `database.test.ts` z `--sequence.shuffle --sequence.seed=4242` (czerwony przed poprawką) | integration | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api --sequence.shuffle --sequence.seed=<n> database`

## QA plan

- **Regression:** pełny zestaw API; inne pliki z testami zależnymi od kolejności w pliku (wyszukać komentarze o kolejności i pary „zapis / następny test”).
- **Edge cases:** seedy, przy których kolejność jest pierwotna i odwrócona.
- **Platforms:** lokalnie / CI.

## Root cause

Test izolacji z T-001 (`bfaf0a7`) to para „zapis w jednym teście, pusta tabela w następnym”: drugi test czytał `isolation_probe`, którą tworzy dopiero pierwszy. Przy odwróconej kolejności (`--sequence.shuffle` miesza też testy w pliku) pada z `relation "isolation_probe" does not exist`, choć harness działa poprawnie. Nie wyszło wcześniej, bo CI uruchamia testy w kolejności z pliku, a losową kolejność sprawdzano ręcznie tylko dla kilku seedów (od QA T-051), przy których akurat była pierwotna.

Inne wystąpienia: wyszukanie w `apps` i `packages` testów odwołujących się do poprzedniego / następnego testu — brak; pełny zestaw (144 pliki) zielony z `--sequence.shuffle` dla seedów 4242 i 3.

## Evidence

Test reprodukujący (czerwony przed poprawką): `pnpm vitest run --project api --sequence.shuffle --sequence.seed=4242 database` (także seed 3) — `database.test.ts › starts the next test with empty tables`: `error: relation "isolation_probe" does not exist`.

Poprawka: dwa jednakowe testy (`starts a test with empty tables (first probe)` / `(second probe)`), każdy tworzy tabelę, jeśli trzeba, zapisuje swój wiersz i oczekuje dokładnie `[{ value }]`; ten, który wykona się drugi, dowodzi czyszczenia — w każdej kolejności.

- Seedy 4242, 3, 1, 2 i kolejność domyślna: 4/4 zielone.
- AC2 (kontrola ręczna, cofnięta): bez `truncateAllTables` w `beforeEach` (`test/database.ts`) — seed 4242: `(first probe)` `expected [ { value: 'second probe' }, …(1) ] to deeply equal [ { value: 'first probe' } ]`; seed 1: `(second probe)` analogicznie.
- `pnpm test` 144 pliki / 1132 testy zielone (kolejność domyślna i `--sequence.shuffle` z seedami 4242 i 3); `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm quality` bez błędów.

## Prevention

Co by zapobiegło: przebieg testów w losowej kolejności w CI zamiast ręcznego sprawdzenia kilku seedów (reguła w `layers/backend.md`, „Pułapki”, od QA T-051). Propozycja dla właściciela (niezastosowana): krok CI `pnpm vitest run --project api --sequence.shuffle` ze stałym seedem zmienianym co jakiś czas albo z seedem wypisywanym w logu, żeby czerwony wynik dało się powtórzyć.
