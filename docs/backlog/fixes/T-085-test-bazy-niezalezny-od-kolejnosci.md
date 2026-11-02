---
id: T-085
title: "Test izolacji bazy testowej niezależny od kolejności testów"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done     # todo | in-progress | in-qa | done | blocked
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

Co by zapobiegło: przebieg testów w losowej kolejności w CI zamiast ręcznego sprawdzenia kilku seedów (reguła w `layers/backend.md`, „Pułapki”, od QA T-051). Przyjęte przez właściciela (2026-11-02, po QA runda 1) i zastosowane:

- `.github/workflows/ci.yml`, job `tests`: krok „Testy API w losowej kolejności (seed = numer przebiegu)” — `pnpm vitest run --project api --sequence.shuffle --sequence.seed="$SEED"`, `SEED` = `github.run_number` przez `env` (bez wstawiania wyrażenia w skrypt), seed i komenda do powtórki wypisane w logu; blokujący (przez `ci-ok`). `timeout-minutes` jobu 15 → 20 (drugi przebieg api, lokalnie ~50 s).
- `pipeline.md` (wiersz „CI na PR”) i `layers/backend.md` („Pułapki”, T-051) opisują ten krok.
- Sprawdzenie: `pnpm workflow-check` OK, Prettier OK; komenda kroku lokalnie z `SEED=123`: 101 plików / 429 testów zielone.

## QA round 1 (2026-11-02)

Verdict: pass

Zakres: commit `100f369` (`apps/api/test/database.test.ts`). Zadanie typu fix: bez akceptacji story i epiki.

Weryfikacja własna:

- **Reprodukcja (czerwony przed poprawką):** plik z `100f369^` przy `--sequence.shuffle --sequence.seed=4242` — `× starts the next test with empty tables`, `error: relation "isolation_probe" does not exist`. Potwierdza Root cause.
- **AC1 — pass:** `pnpm vitest run --project api --sequence.shuffle --sequence.seed=<n> database` dla seedów 4242, 3, 1, 2, 7, 99 oraz w kolejności domyślnej: 4/4 zielone. Każda sonda oczekuje dokładnie `[{ value }]`, więc ta wykonana druga dowodzi, że zapis pierwszej nie jest widoczny.
- **AC2 — pass:** spot-check — zakomentowane `await truncateAllTables(pool)` w `beforeEach` (`apps/api/test/database.ts`): seed 4242 i 3 — `× (first probe)` `expected [ { value: 'second probe' }, …(1) ] to deeply equal [ { value: 'first probe' } ]`; seed 1 i kolejność domyślna — `× (second probe)` analogicznie. Zmiana cofnięta (`git checkout`), `git status` czysty.
- **AC3 — pass:** `pnpm test` 144 pliki / 1132 testy zielone; pełny zestaw z `--sequence.shuffle --sequence.seed=555` 144 / 1132 zielone; `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm quality` bez błędów.
- **Regresja z QA planu:** wyszukanie w `apps/**/*.test.{ts,tsx}` odwołań do kolejności / poprzedniego / następnego testu — trafienia (`ListScreen.check.test.tsx:154`, `live.revoke.test.ts:64`, `name-key-migration.test.ts:62`) dotyczą kolejności wewnątrz jednego testu, nie zależności między testami.
- **Root cause:** wyjaśnia, dlaczego istniejące testy tego nie złapały (CI bez losowej kolejności, ręczne seedy akurat w pierwotnej kolejności). Zmiana ograniczona do pliku testu, bez scope creep; helper `writeOneRowAndSeeOnlyIt` ma dwa użycia.
- Bezpieczeństwo: n/a (tylko kod testu, `threats: []`).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | CI / proces | Losowa kolejność testów nadal sprawdzana tylko ręcznie; propozycja z sekcji Prevention (krok CI z `--sequence.shuffle` i seedem w logu) nie jest zastosowana. | Sekcja Prevention; `layers/backend.md` „Pułapki” (T-051) | Decyzja właściciela: krok CI z losową kolejnością i wypisanym seedem. |

## QA round 2 (2026-11-02)

Verdict: pass

Zakres: commit `2e7c8b6` (krok CI z sekcji Prevention, przyjęty przez właściciela po rundzie 1): `.github/workflows/ci.yml`, `docs/architecture/pipeline.md`, `docs/architecture/layers/backend.md`. Kod testu z `100f369` bez zmian od rundy 1. Zadanie typu fix: bez akceptacji story i epiki.

Weryfikacja własna:

- **Krok CI:** job `tests`, po `pnpm test:coverage`; `SEED` z `github.run_number` przez `env` (bez wstawiania wyrażenia w skrypt), seed i komenda do powtórki w logu; job `tests` jest w `needs` `ci-ok`, więc krok blokuje. Upload pokrycia ma `if: !cancelled()`, więc raport zostaje także przy czerwonym kroku; drugi przebieg bez `--coverage` nie czyści `coverage/`.
- **Skrypt kroku lokalnie** (`SEED=1`, `SEED=58`): 101 plików / 429 testów zielone, exit 0.
- **Czy krok łapie test zależny od kolejności (spot-check):** `database.test.ts` z `100f369^`, ten sam skrypt z `SEED=4242`: `× starts the next test with empty tables`, exit 1. Plik przywrócony (`git checkout`), `git status` czysty.
- `pnpm workflow-check` OK, `pnpm format:check` OK, `node scripts/backlog-check.mjs` OK.
- Dokumentacja: `pipeline.md` (etap 2) i `layers/backend.md` („Pułapki”, wpis w historii zmian) zgodne z krokiem.
- Bezpieczeństwo: brak nowych sekretów i uprawnień; `permissions: contents: read` bez zmian; wartość z kontekstu GitHub tylko przez `env`.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | Testy / raporty | Drugi przebieg (`pnpm vitest run --project api …`) używa głównego `vitest.config.ts` i nadpisuje `test-results/vitest-junit.xml` wynikami samego api. W CI plik nie jest wysyłany jako artefakt, więc bez skutku; przy lokalnym powtórzeniu kroku po `pnpm test` porażki pełnego zestawu z pliku znikają (cel T-047). | `vitest.config.ts` (`outputFile.junit`); `ci.yml` bez uploadu `test-results/` dla jobu `tests` | Ewentualnie osobny `--outputFile.junit` dla przebiegu losowego, jeśli JUnit trafi kiedyś do artefaktów. |
