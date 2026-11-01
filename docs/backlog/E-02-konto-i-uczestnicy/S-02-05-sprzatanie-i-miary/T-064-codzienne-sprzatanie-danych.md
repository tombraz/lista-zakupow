---
id: T-064
title: Codzienne sprzątanie danych w procesie API
epic: E-02
story: S-02-05
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: S                # S | M (L must be split)
layers: [backend, db]
requirements: [N-02]
threats: [TH-27, TH-21]
screens: []
---

# T-064 Codzienne sprzątanie danych w procesie API

## Goal

Raz na dobę proces API usuwa dane po terminie z inwentarza `data-model.md`: wygasłe sesje, linki zaproszeń 30 dni po wygaśnięciu, aktywność dzienną starszą niż 90 dni, wygasłe tokeny resetu, wygasłe liczniki limitów (`rate_limit`, `sign_in_failure`, licznik resetu z T-053, jeśli trzymany w bazie). Reszta danych zostaje.

## Demo

Lokalnie: dane testowe z datami w przeszłości → uruchom sprzątanie (start API po upływie doby albo komenda deweloperska) → log `cleanup` z liczbą usuniętych wierszy na tabelę; dane w terminie zostają.

## Context

- BRD: N-02 — prywatność; dane trzymane tylko tak długo, jak opisuje inwentarz.
- Architektura: `data-model.md` „Inwentarz danych osobowych” (terminy) i „Sprzątanie: zadanie w procesie API raz dziennie (bez osobnej infrastruktury cron)”; ADR 0003 (jedna instancja API); Fly auto-stop na staging (maszyna śpi — zadanie musi nadrobić zaległe sprzątanie po starcie); TH-27 (retencja tabel pisanych przed logowaniem).
- Existing code: tabele w `apps/api/src/db/schema.ts`; `sign_in_failure` (okno 15 min, T-048).
- Depends on: — .

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given wiersze po terminie i w terminie w `session` (`expires_at` < teraz), `invitation` (`expires_at` < teraz − 30 dni; użyte i unieważnione liczone od `expires_at`), `list_daily_activity` (`day` < dziś − 90 dni), `verification` (`expires_at` < teraz), `rate_limit` i `sign_in_failure` (okno minęło), when sprzątanie się wykona (zegar), then usunięte są dokładnie wiersze po terminie. — verified by: test integracyjny na każdą tabelę (granice ± 1 s / 1 dzień)
- [ ] AC2: Given API działa, when mija 24 h od ostatniego sprzątania, then sprzątanie uruchamia się samo; given API startuje, a ostatnie sprzątanie było ponad 24 h temu (albo nigdy), then uruchamia się wkrótce po starcie; dwa sprzątania nie działają naraz. — verified by: test z podstawionym zegarem / harmonogramem
- [ ] AC3: Given błąd bazy w trakcie sprzątania, then błąd jest zalogowany, proces API działa dalej, a następna próba odbywa się w kolejnym cyklu; sprzątanie nie blokuje obsługi żądań (usuwanie partiami, np. po 1000 wierszy). — verified by: test integracyjny
- [ ] SEC1 (TH-27): Given tabela `sign_in_failure` z wierszami po oknie 15 min, when sprzątanie, then usunięte; liczba wierszy tabel pisanych przed logowaniem nie rośnie bez granic w czasie. — verified by: test integracyjny
- [ ] SEC2 (TH-21): Given sprzątanie, when loguje wynik, then tylko nazwy tabel i liczby wierszy (bez identyfikatorów użytkowników, e-maili, tokenów). — verified by: test logów

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- funkcja sprzątania modułu (wywołana z zegarem) na bazie Testcontainers
- harmonogram w procesie API (zegar podstawiony)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | każda tabela: po terminie usunięte, w terminie zostaje (granice) | integration | Vitest + Testcontainers | AC1, SEC1 |
| 2 | harmonogram: co 24 h, nadrabianie po starcie, bez równoległych przebiegów | unit | Vitest (zegar) | AC2 |
| 3 | błąd bazy nie zatrzymuje API; usuwanie partiami | integration | Vitest + Testcontainers | AC3 |
| 4 | log wyniku bez danych osobowych | integration | Vitest | SEC2 |

**Run:** `pnpm vitest run --project api cleanup`

**Mocks:** zegar. Baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** strefa czasowa (dni aktywności liczone w `Europe/Warsaw`? — zgodnie z modułem `statystyki`); zmiana czasu letni / zimowy; staging uśpiony kilka dni — jedno sprzątanie po starcie, nie kilka.
- **Platforms / devices:** API lokalnie i na staging (log po wdrożeniu).
- **Security / privacy:** po sprzątaniu w bazie nie ma wygasłych tokenów resetu ani sesji; logi bez danych osobowych.
- **Regression:** logowanie i limit per konto (T-048), zaproszenia aktywne nadal widoczne na SC-07, miary (T-065) na danych z 90 dni.

## Implementation notes

- Znacznik ostatniego sprzątania w bazie (np. jeden wiersz w tabeli technicznej), żeby nadrabianie po uśpieniu działało bez stanu w pamięci; bez nowej zależności harmonogramu (`setInterval` / `setTimeout` z `unref`).
- Kolejność względem T-062: wiersze konta usuwane przy usunięciu konta; to zadanie sprząta tylko wg terminów.

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
