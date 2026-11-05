---
id: T-096
title: "Copy SC-09 i SC-03 dla brakujących tekstów; UAT E-02 aktualny"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-03, F-16]
threats: []
screens: [SC-03, SC-09]
related_tasks: [T-054, T-060, T-061, T-080]
---

# T-096 Copy SC-09 i SC-03 dla brakujących tekstów; UAT E-02 aktualny

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, P3 i P6 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - „Usuń niewidoczne lub specjalne znaki.” pod polem „Imię” na SC-09 (`apps/web/src/session/personName.ts:7`, `SC-09-konto/NameForm.tsx:134`) nie ma wpisu w Copy `docs/design/screens/SC-09-konto.md:57-76`. SC-02, SC-05 i SC-06 ten wpis mają.
  - „Hasło może mieć najwyżej 128 znaków” na SC-03, krok 2 (`apps/web/src/screens/SC-03-reset-hasla/messages.ts:24`) nie ma wpisu w `SC-03-reset-hasla.md:61-78`.
  - `docs/backlog/E-02-konto-i-uczestnicy/UAT.md:31` podaje T-070–T-072, T-074 i T-076–T-082 jako `todo` (wszystkie są `done`), a `:3` odsyła do przeglądu z werdyktem `fail` z 2026-11-02.
- **Expected:** każdy tekst widoczny dla użytkownika ma wpis w tabeli Copy swojego ekranu (cel T-080); UAT pokazuje stan na dziś.

## Acceptance criteria

- [x] AC1: Copy SC-09 ma `name.invalid.hiddenChars` (lub klucz zgodny z SC-02) z dopiskiem „zatwierdzone <data>, T-060”; Copy SC-03 ma tekst limitu 128 znaków. Teksty zatwierdza właściciel przed wpisem. — verified by: przegląd QA (porównanie `messages.ts` z tabelami Copy SC-03 i SC-09)
- [x] AC2: `UAT.md` podaje aktualne statusy poprawek i odsyła do najnowszego przeglądu (`E-02-2026-11-04-1.md`) oraz otwartych zadań z niego. — verified by: przegląd QA
- [x] AC3: No regression in: teksty w kodzie bez zmian (zmienia się tylko dokumentacja).

## TDD plan

Zadanie dokumentacyjne, bez testu automatycznego.

## QA plan

- **Regression:** brak zmian w kodzie (`git diff --stat` tylko w `docs/`).
- **Edge cases:** inne teksty SC-03 i SC-09 z `messages.ts` bez wpisu w Copy — wymienić w Evidence.
- **Platforms:** —

## Root cause

Tabele Copy prowadzi się ręcznie, a teksty ekranu żyją w `messages.ts` i we wspólnych modułach (`session/personName.ts`, `errorText.ts`). Tekst znaków ukrytych zatwierdzono w T-060 dla SC-02, SC-05 i SC-06. SC-09 dostał go dopiero w T-061 przez wspólne `NAME_ERROR_TEXTS`, a T-080 przepisał do Copy tylko ekrany wymienione w T-060. Limit 128 znaków hasła wszedł do SC-03 w T-054 razem z błędami pola skopiowanymi z SC-02 (`messages.ts:20`), bez wpisu w specyfikacji. `UAT.md` powstał 2026-11-03 i nikt go nie odświeżył ani po rundzie 1 poprawek, ani po przeglądzie 2026-11-04. Nic tego nie wychwyciło, bo żaden test ani `design-check` nie porównuje tekstów z kodu z tabelami Copy, a zmiana statusu zadania nie przypomina o `UAT.md`.

## Evidence

Teksty zatwierdzone przez właściciela 2026-11-05 (w tej sesji): oba wpisy z AC1 oraz dopisanie błędu wylogowania SC-09.

Zmiany:
- `SC-09-konto.md`, Copy: `name.invalid.hiddenChars` (tekst zatwierdzony 2026-11-01 w T-060, ten sam co SC-02) i `logout.error` „Nie udało się wylogować. Spróbuj ponownie.” (zatwierdzone 2026-11-05). States: „Error — imię” uzupełnione o tekst znaków ukrytych; nowy wiersz „Error — wylogowanie”.
- `SC-03-reset-hasla.md`, Copy: `step2.password.tooLong` „Hasło może mieć najwyżej 128 znaków”.
- `UAT.md`: odsyła do przeglądu `E-02-2026-11-04-1.md` (runda 2, `fail`), podaje statusy poprawek z rundy 1 (wszystkie `done` poza T-084) i zadania z rundy 2 (T-094, T-095 `done`; T-097–T-099 i T-090–T-093 `todo`).
- `apps/web/src/screens/SC-09-konto/messages.ts:28`: tylko komentarz („tekst agenta; tabela „Copy” go nie ma” → odwołanie do `logout.error`), bo po dopisaniu do Copy byłby nieprawdziwy. Teksty bez zmian (AC3).

Edge cases: przegląd pozostałych tekstów z `messages.ts` SC-03 i SC-09, które nie mają wiersza w tabeli Copy, choć są w specyfikacji ekranu (Layout albo States):
- SC-03: „E-mail” (Layout 3), „Nowe hasło” i „Co najmniej 8 znaków.” (Layout krok 2), „Hasło musi mieć co najmniej 8 znaków” (States „Error — walidacja”), „Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.” (States „Error — limit”).
- SC-09: „Wstecz” (Layout 1), „Anuluj” (ConfirmDialog, Accessibility), „Wpisz imię” i „Imię może mieć najwyżej 30 znaków” (States „Error — imię”), „Nie udało się zapisać. Spróbuj ponownie.” (States „Error — zapis”).
- Wspólny `network` z `errorText.ts` („Brak połączenia. Sprawdź internet i spróbuj ponownie.”) nie ma wpisu w Copy żadnego ekranu.

Nie dopisałem ich, bo są opisane w specyfikacji ekranu, a AC1 dotyczy tekstów bez żadnego opisu. Jedynym tekstem bez opisu był błąd wylogowania SC-09 i ten został dopisany.

## Prevention

Co by temu zapobiegło: automatyczne sprawdzenie, że każdy tekst z `messages.ts` ekranu (i ze wspólnych modułów, których ekran używa) występuje w jego specyfikacji (`docs/design/screens/SC-xx-*.md`). Propozycja dla właściciela (2026-11-05), czeka na decyzję:

1. Reguła w `design-check` (albo test Vitest w `apps/web`): dla każdego `SC-xx/messages.ts` stałe teksty muszą wystąpić w tabeli Copy albo w Layout/States tego ekranu; wynik pokazuje brakujący tekst i ekran. Do ustalenia: czy wymagać wiersza w Copy (pełny rejestr), czy wystarczy Layout/States. Większa zmiana niż ta poprawka, więc jako zadanie przez `/plan-backlog`.
2. Ręczne odświeżanie `UAT.md` zostaje. `/qa-task E-02` i tak aktualizuje go przed UAT.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-05)

Verdict: pass

Zakres: commit `991973c`. Reprodukcja: `pnpm typecheck` zielony, `pnpm lint` 0 ostrzeżeń, `prettier --check` zmienionych plików zielony, `pnpm test` 1224 testów, 0 błędów (JUnit). Testy SC-03 i SC-09: 6 plików, 48 testów zielonych.

Kryteria:

- AC1 — pass. `SC-09-konto.md` Copy: `name.invalid.hiddenChars` = „Usuń niewidoczne lub specjalne znaki.” z dopiskiem „zatwierdzone 2026-11-01, T-060”, identyczne z `HIDDEN_CHARACTERS_TEXT` (`apps/web/src/errorText.ts:20`, użyte w `session/personName.ts:7`) i z wpisem SC-02 (`invalid.hiddenChars`). `SC-03-reset-hasla.md` Copy: `step2.password.tooLong` = „Hasło może mieć najwyżej 128 znaków”, zgodne z `SC-03-reset-hasla/messages.ts:24`. Dodatkowo `logout.error` i wiersz States „Error — wylogowanie” zgodne z `SC-09-konto/messages.ts:30`. Zatwierdzenie tekstów przez właściciela podaje Evidence (sesja 2026-11-05); QA nie może go potwierdzić niezależnie.
- AC2 — pass. `UAT.md:3` odsyła do `docs/reviews/E-02-2026-11-04-1.md` (runda 2, `Verdict: fail` — sprawdzone). Statusy w „Znane ograniczenia” sprawdzone w plikach zadań: T-070–T-072, T-074, T-076–T-083, T-085–T-087, T-089, T-094, T-095 `done`; T-084, T-090–T-093, T-097–T-099 `todo`. PR #14 `MERGED`, PR #15 otwarty (`gh pr list`). Lista zadań naprawczych rundy 2 zgadza się z sekcją zadań przeglądu.
- AC3 — pass. Jedyna zmiana w `apps/` to komentarz w `SC-09-konto/messages.ts:28`; teksty bez zmian, testy zielone.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Zakres | QA plan mówi „`git diff --stat` tylko w `docs/`”, a commit zmienia komentarz w `apps/web/src/screens/SC-09-konto/messages.ts:28`. Zmiana uzasadniona (stary komentarz byłby nieprawdziwy), bez wpływu na zachowanie. | `git show 991973c --stat` | Akceptowalne; odnotowane dla śledzalności. |
| 2 | note | Copy | Teksty opisane tylko w Layout/States, bez wiersza Copy: SC-03 („E-mail”, „Nowe hasło”, „Co najmniej 8 znaków.”, „Hasło musi mieć co najmniej 8 znaków”, „Zbyt wiele próśb o reset…”), SC-09 („Wstecz”, „Anuluj”, „Wpisz imię”, „Imię może mieć najwyżej 30 znaków”, „Nie udało się zapisać…”), wspólny `network` z `errorText.ts` bez wpisu na żadnym ekranie. Wymienione w Evidence, poza AC1. | Evidence T-096; `SC-03-reset-hasla/messages.ts`; `SC-09-konto/messages.ts` | Decyzja właściciela, czy Copy ma być pełnym rejestrem tekstów. |
| 3 | note | Śledzalność | AC tego zadania są nieodhaczone (ta sama klasa co P7 przeglądu 2026-11-04). | sekcja „Acceptance criteria” | Odhaczanie AC przy przejściu do `done` albo reguła w `backlog-check`. |
| 4 | note | Zapobieganie | Sekcja „Prevention” pusta; Root cause wskazuje brak testu porównującego teksty z kodu z tabelami Copy. | sekcja „Prevention” | Rozważyć test/skrypt porównujący `messages.ts` z tabelami Copy. |

Root cause (wymóg dla `kind: fix`): wyjaśnia, dlaczego nic nie wychwyciło luk (brak porównania kod–Copy, brak przypomnienia o `UAT.md`). Test odtwarzający nie dotyczy — zadanie dokumentacyjne.
