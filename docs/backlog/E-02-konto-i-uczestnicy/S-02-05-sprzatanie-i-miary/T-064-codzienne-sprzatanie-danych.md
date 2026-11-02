---
id: T-064
title: Codzienne sprzątanie danych w procesie API
epic: E-02
story: S-02-05
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given wiersze po terminie i w terminie w `session` (`expires_at` < teraz), `invitation` (`expires_at` < teraz − 30 dni; użyte i unieważnione liczone od `expires_at`), `list_daily_activity` (`day` < dziś − 90 dni), `verification` (`expires_at` < teraz), `rate_limit` i `sign_in_failure` (okno minęło), when sprzątanie się wykona (zegar), then usunięte są dokładnie wiersze po terminie. — verified by: test integracyjny na każdą tabelę (granice ± 1 s / 1 dzień)
- [x] AC2: Given API działa, when mija 24 h od ostatniego sprzątania, then sprzątanie uruchamia się samo; given API startuje, a ostatnie sprzątanie było ponad 24 h temu (albo nigdy), then uruchamia się wkrótce po starcie; dwa sprzątania nie działają naraz. — verified by: test z podstawionym zegarem / harmonogramem
- [x] AC3: Given błąd bazy w trakcie sprzątania, then błąd jest zalogowany, proces API działa dalej, a następna próba odbywa się w kolejnym cyklu; sprzątanie nie blokuje obsługi żądań (usuwanie partiami, np. po 1000 wierszy). — verified by: test integracyjny
- [x] SEC1 (TH-27): Given tabela `sign_in_failure` z wierszami po oknie 15 min, when sprzątanie, then usunięte; liczba wierszy tabel pisanych przed logowaniem nie rośnie bez granic w czasie. — verified by: test integracyjny
- [x] SEC2 (TH-21): Given sprzątanie, when loguje wynik, then tylko nazwy tabel i liczby wierszy (bez identyfikatorów użytkowników, e-maili, tokenów). — verified by: test logów

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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

**Zbudowane.** `apps/api/src/cleanup/` (`purgeExpiredData`, `cleanUpIfDue`, `scheduleCleanup`), `src/db/retention.ts` (usuwanie partiami po 1000 wierszy), reguły terminów w modułach-właścicielach tabel (`konta/infra/retention.ts`, `zaproszenia/infra/retention.ts`, `statystyki/infra/retention.ts`, eksport z `index.ts`), tabela znacznika `cleanup_run` (migracja `0008_sprzatanie.sql`, jeden wiersz, `CHECK (id = 1)`), podłączenie tylko w `src/server.ts` (nie w `buildApp` — aplikacje innych testów nie sprzątają). `summarize` przeniesione z `http/api-error.ts` do `logging.ts` jako `errorSummary` (wspólne dla handlera błędów i sprzątania; bez zmiany zachowania).

**Testy (plan TDD).** `pnpm vitest run --project api cleanup` → 4 pliki, 22 testy zielone.

| # | Plik / testy | Red (przed implementacją) | Teraz |
| --- | --- | --- | --- |
| 1 | `test/cleanup.retention.test.ts` (9): sesja ±1 s, zaproszenie 30 dni ±1 s (także użyte i unieważnione), dzień aktywności 90/91, dzień Warszawa vs UTC, `verification` ±1 s, `rate_limit` 1 h ±1 s, `sign_in_failure` 15 min ±1 s, ograniczona liczba wierszy przez 5 dni, reszta danych zostaje | stub bez działania: 8 × `AssertionError` (np. `expected [ 'expired', 'valid' ] to deeply equal [ 'valid' ]`, `expected { failures: '250', limits: '600' } to deeply equal { failures: '15', limits: '60' }`); „keeps all other data” to strażnik — przechodzi także na stubie | zielone |
| 2 | `test/cleanup.schedule.test.ts` (7): pierwsze sprzątanie wkrótce po starcie (nie przed 10 s), co 24 h (nie po 24 h − 1 s), nadrobienie raz po 3 dniach uśpienia, czekanie, gdy ostatnie 1 h temu (start po +23 h), dwa procesy API → jedno sprzątanie, zatrzymanie przy zamknięciu, opóźnienie startu ≤ 1 min | stub harmonogramu: 5 × `AssertionError: expected +0 to be 1` | zielone |
| 3 | `test/cleanup.failure.test.ts` (4): błąd tabeli w logu (poziom 50, `table`), pozostałe sprzątnięte, `/health` 200; nieudana tabela ponowiona po 24 h; błąd bazy przed sprzątaniem (brak `cleanup_run`) → log, następny cykl sprząta; 2500 wierszy → 3 zapytania `DELETE` | pierwszy test red: `expected [] to deeply equal [ ObjectContaining{…} ]`. Trzy pozostałe przeszły od razu (partie i ponowne planowanie powstały przy teście 2); sprawdzone mutacją, potem przywrócone: bez `LIMIT` → `expected 2 to be 3`; bez planowania po błędzie → `expected [] to have a length of 1`; interwał 48 h → `expected 1 to be +0` | zielone |
| 4 | `test/cleanup.logs.test.ts` (2): wpis `cleanup` ma tylko pola pino + `deleted` = `{ tabela: liczba }`; w żadnej linii logu nie ma identyfikatora i e-maila osoby, id listy, IP, tokenu sesji / resetu / zaproszenia, klucza konta ani user agenta; `cleanup_failed` ma tylko `table` i `err` = typ / stos / przyczyna (typ / kod / stos), bez SQL | pierwszy przebieg red na moim oczekiwaniu kształtu `err` (`expected [ 'cause', 'stack', 'type' ] to deeply equal [ 'code', … ]`) — asercja poprawiona do rzeczywistego kształtu `errorSummary`. Mutacja: log surowego wyniku / surowego błędu → `expected [ Array(8) ] to deeply equal [ Array(7) ]` i `expected [ 'message', 'params', 'query', … ]`; przywrócone | zielone |

**Kryteria akceptacji.**

- AC1: test 1, każda tabela, granice ± 1 s / 1 dzień. Zaproszenie: `expires_at < teraz − 30 dni` niezależnie od `used_at` / `revoked_at`. Aktywność: `day < dziś(Europe/Warsaw) − 90`, więc 90. dzień wstecz zostaje (moduł `statystyki` też liczy dzień w Warszawie). `rate_limit`: wiersz nie zapisuje swojego okna, więc wygasa po najdłuższym oknie limitów trzymanych w tej tabeli (1 h, `signUpPerIp`) — ta sama reguła, którą Better Auth sprząta tę tabelę; sama granica (dokładnie 15 min / 1 h) zostaje, jak w `SignInFailures` (`<`).
- AC2: test 2. Znacznik `cleanup_run.started_at` w bazie: nadrabianie po Fly auto-stop bez stanu w pamięci i tylko jedno sprzątanie niezależnie od długości uśpienia. Wykluczenie: jedno atomowe `INSERT … ON CONFLICT DO UPDATE … WHERE started_at <= teraz − 24 h RETURNING`; w procesie sprawdzenia nie nakładają się (następny timer dopiero po końcu sprawdzenia).
- AC3: test 3. Każda tabela osobno (błąd jednej nie zatrzymuje innych), zapytania autocommit po ≤ 1000 wierszy (`ctid = ANY (ARRAY(SELECT ctid … LIMIT 1000)) AND <warunek>`; warunek powtórzony, więc wiersz odnowiony w międzyczasie, np. sesja, jest sprawdzany ponownie). Błędy łapie harmonogram; następne sprawdzenie po 24 h.
- SEC1 (TH-27): test 1 „sign-in failure counters…” i „keeps the number of pre-sign-in rows bounded over time” (5 dni nowych wierszy `sign_in_failure` / `rate_limit` → zostają tylko wiersze z otwartego okna).
- SEC2 (TH-21): test 4.

**Demo (lokalnie, 2026-11-02).** `pnpm services:up`, `db:migrate`, wiersz `sign_in_failure` sprzed 1 h i świeży, brak wiersza `cleanup_run`, potem `node dist/server.js`. Po ~10 s: `{"level":30,…,"event":"cleanup","deleted":{"session":0,"verification":42,"rate_limit":183,"sign_in_failure":1,"invitation":0,"list_daily_activity":0},"msg":"cleanup"}`; świeży wiersz został, `cleanup_run.started_at` ustawione. Osobnej komendy deweloperskiej nie ma: wyzwalaczem jest start API bez znacznika (albo ze znacznikiem starszym niż 24 h).

**Pełne sprawdzenia.** `pnpm test` → 141 plików, 934 testy zielone. Przechodzą: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd 0 klonów, depcruise bez naruszeń), `pnpm build`, `drizzle-kit check`, `node scripts/backlog-check.mjs`. `--project api --sequence.shuffle.files` z seedami 4242 i 99: 98 plików zielonych. Z `--sequence.shuffle` (losowana też kolejność testów w pliku) pada `test/database.test.ts` „starts the next test with empty tables”: test zależy od kolejności testów we własnym pliku. Jest starszy niż ten task i ten task go nie dotyka. `migrate-slow-database.test.ts` padł raz w jednym przebiegu losowym, przy powtórzeniu przeszedł (też nie dotknięty).

**Przewodniki warstw (Step 8b).** W sekcjach „Gdzie jest kod” w `layers/backend.md` i `layers/db.md`: `src/cleanup/`, `db/retention.ts`, reguły terminów, `errorSummary`, `cleanup_run` i `0008_sprzatanie`.

**Propozycje dla właściciela (dokumentów architektury ten task nie edytował).** `data-model.md`: dopisać tabelę techniczną `cleanup_run` (jeden wiersz, początek ostatniego sprzątania), a w wierszu inwentarza „tokeny resetu, liczniki limitów” — że `rate_limit` jest usuwany po najdłuższym oknie (1 h). `architecture.md`: codzienne sprzątanie w `apps/api/src/cleanup/` poza modułami; każdy moduł podaje regułę terminu swoich tabel.

## QA round 1 (2026-11-02)

Verdict: pass

**Odtworzenie.** `pnpm install --frozen-lockfile` (bez zmian w plikach śledzonych). `pnpm vitest run --project api cleanup` → 4 pliki, 22 testy zielone. `pnpm test` → 141 plików, 934 testy zielone. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd, depcruise: 0 naruszeń), `drizzle-kit check` („Everything's fine”) — przechodzą.

**Kryteria akceptacji.**

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | `cleanup.retention.test.ts`: każda tabela z granicą ± 1 s / 1 dzień, wartości oczekiwane jako literały; zaproszenia użyte / unieważnione liczone od `expires_at`; dzień aktywności w `Europe/Warsaw` (test 23:30 UTC). Mutacje: 30 → 0 dni dla zaproszeń i dzień UTC zamiast Warszawy — oba testy czerwone. |
| AC2 | pass | `cleanup.schedule.test.ts` (timery i zegar podstawione, baza prawdziwa): start po 10 s, co 24 h, jedno nadrobienie po 3 dniach, czekanie po niedawnym przebiegu, dwa procesy → jeden przebieg, zatrzymanie przy zamknięciu. Mutacja: `setWhere` zawsze prawdziwe → 2 testy czerwone. Na żywo: drugi start API z niedawnym `cleanup_run` → 0 wpisów `cleanup`. |
| AC3 | pass | `cleanup.failure.test.ts`: brak tabeli → `cleanup_failed` (poziom 50, `table`), pozostałe tabele sprzątnięte, `/health` 200, ponowienie po 24 h; błąd przed sprzątaniem (brak `cleanup_run`) → log i następny cykl; 2500 wierszy → 3 zapytania `DELETE` (partie po 1000). |
| SEC1 (TH-27) | pass | test „sign-in failure counters…” i „keeps the number of pre-sign-in rows bounded” (5 dni nowych wierszy → zostają tylko wiersze otwartego okna: 15 / 60). Na żywo (lokalna baza, `node dist/server.js`): wiersze `sign_in_failure` sprzed 1 h i `rate_limit` sprzed 2 h usunięte po ~10 s, świeże zostały. |
| SEC2 (TH-21) | pass | `cleanup.logs.test.ts`: dokładny zbiór kluczy wpisu `cleanup` i `cleanup_failed`, wyszukanie znaczników (id, e-mail, IP, tokeny, user agent, klucz konta) we wszystkich liniach logu, brak `DELETE` / SQL. Na żywo: `{"event":"cleanup","deleted":{"session":0,"verification":0,"rate_limit":1,"sign_in_failure":1,"invitation":0,"list_daily_activity":0}}` — tylko nazwy tabel i liczby. |

**Jakość testów.** Testy na uzgodnionych granicach (`purgeExpiredData` na Testcontainers, `scheduleCleanup` z podstawionym zegarem), bez mocków własnych modułów; oczekiwania to literały. Dowody red w Evidence dla każdego testu planu; dla testów zielonych od razu (AC3) — mutacje opisane, ja potwierdziłem trzy własne (wyżej). Po spot-checku pliki przywrócone, `git status` czysty.

**Przegląd kodu.** Reguły terminów w modułach-właścicielach tabel (`konta`, `zaproszenia`, `statystyki`) eksportowane przez `index.ts`, zbierane w `src/cleanup/` — kierunek zależności poprawny (depcruise bez naruszeń). Przeniesienie `summarize` → `errorSummary` bez zmiany zachowania (zmiana tylko miejsca). Harmonogram bez nowej zależności, `setTimeout` z `unref`, podłączony tylko w `server.ts`. Zakres zgodny z taskiem.

**Eksploracja.** Strefa czasowa i zmiana czasu: dzień liczony `Intl` w `Europe/Warsaw`, odejmowanie na typie `date` — DST nie wpływa. Staging uśpiony kilka dni → jedno sprzątanie (test + znacznik w bazie). Wszystkie limity w `rate_limit` (Better Auth i reset per e-mail) mają okno ≤ 1 h, więc usuwanie po 1 h od `last_request` nie skraca żadnego okna. Regresja: pełny zestaw testów (T-048 logowanie, zaproszenia, miary) zielony.

**Exploit (lokalnie).** TH-27: zapisy przed logowaniem z datami po oknie → usunięte przez pierwszy przebieg po starcie; brak wzrostu bez granic (test 5-dniowy). TH-21: wynik i błąd w logu bez danych osobowych (test + log na żywo). Dane testowe usunięte z lokalnej bazy po sprawdzeniu.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | docs | `data-model.md` nie opisuje tabeli technicznej `cleanup_run` ani reguły „`rate_limit` usuwany 1 h po `last_request`”; autor zostawił to jako propozycję. | `docs/architecture/data-model.md` „Inwentarz danych osobowych” | właściciel dopisuje tabelę i regułę do modelu danych |
| 2 | note | db | Każda partia `DELETE` przegląda całą tabelę (brak indeksów na `session.expires_at`, `verification.expires_at`, `invitation.expires_at`, `rate_limit.last_request`). Przy skali pilotażu bez znaczenia. | `src/db/retention.ts` | rozważyć indeksy, jeśli tabele urosną |
| 3 | note | backend | Znacznik `cleanup_run` jest zajmowany przed sprzątaniem: proces przerwany w trakcie (wdrożenie, auto-stop) ponawia dopiero po 24 h. Zgodne z AC3 („kolejny cykl”). | `src/cleanup/run.ts` `claimRun` | — |
| 4 | note | dx | Brak komendy deweloperskiej do ręcznego sprzątania; demo działa przez start API bez świeżego znacznika (task dopuszcza obie drogi). | Evidence, demo | — |
