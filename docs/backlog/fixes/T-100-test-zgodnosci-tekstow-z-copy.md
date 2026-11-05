---
id: T-100
title: "Test zgodności tekstów ekranów web z tabelami Copy; uzupełnienie Copy SC-01–SC-09"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: []
threats: []
screens: [SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09]
related_tasks: [T-060, T-061, T-080, T-096]
---

# T-100 Test zgodności tekstów ekranów web z tabelami Copy; uzupełnienie Copy SC-01–SC-09

## Report

Źródło: sekcja „Prevention” w `docs/backlog/fixes/T-096-copy-sc-09-sc-03-i-uat.md`, decyzja właściciela z 2026-11-05. Zgłoszenie zmiany przez `/plan-backlog` 2026-11-05. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** tabele Copy w `docs/design/screens/SC-xx-*.md` prowadzi się ręcznie. Teksty ekranu są w `apps/web/src/screens/SC-xx-*/messages.ts` i we wspólnych modułach (np. `errorText.ts`, `session/personName.ts`, `lists/listName.ts`). Nic nie sprawdza, czy są zgodne, więc T-096 znalazł luki dopiero w przeglądzie. Szacunkowy skan z planowania (2026-11-05) pokazał luki na wszystkich ekranach, nie tylko 11 tekstów z Evidence T-096. Na SC-06 brakuje około 19 tekstów, na SC-02 około 10, na SC-07 około 9.
- **Expected:** tabela Copy jest pełnym rejestrem tekstów ekranu (decyzja właściciela 2026-11-05, pkt 1). Test w `apps/web` robi się czerwony, gdy jakiś tekst ekranu nie ma wiersza w Copy.

Stos potwierdzony 2026-11-05: Vitest w `apps/web`; teksty wyciąga parser pakietu `typescript` (jest już w głównym `package.json`). Nowych zależności nie ma.

## Acceptance criteria

- [ ] AC1: Given każdy ekran web SC-01–SC-09, when `pnpm --filter web test`, then test sprawdza, że każdy literał tekstowy (string i szablon) z `SC-xx/messages.ts` ma wiersz w tabeli Copy specyfikacji tego ekranu. Ścieżki importów, klucze obiektów i komentarze nie są tekstami. — verified by: test #1, #2
- [ ] AC2: Given tekst ze wspólnego modułu (np. `HIDDEN_CHARACTERS_TEXT`, `NAME_ERROR_TEXTS`, wspólny `network` z `errorText.ts`), then musi mieć wiersz w Copy każdego ekranu, który go używa. Ekran używa modułu, jeśli importuje go którykolwiek plik w katalogu ekranu, bezpośrednio albo przez inny wspólny moduł. Test sam ustala listę wspólnych modułów z importów, a nie z ręcznej listy. Moduł z tekstami, którego test nie rozpoznaje, jest błędem testu, a nie cichym pominięciem. — verified by: test #3, #4
- [ ] AC3: Given tekst z parametrem (np. `` `${String(owned)} Twoich list zniknie…` ``), then test porównuje go z szablonem w Copy, w którym parametr to `{nazwa}` (np. `{n}`), niezależnie od nazwy zmiennej w kodzie. Stałe tekstowe (np. `NAME_MAX_LENGTH`) test rozwija do wartości, zanim porówna. Opis sposobu jest w nagłówku testu. — verified by: test #5
- [ ] AC4 (negatywny): Given tekst bez wiersza w Copy (fikstura albo tymczasowo usunięty wiersz), then test jest czerwony, a komunikat podaje ekran, plik źródłowy i brakujący tekst. Komunikat wymienia wszystkie braki, nie tylko pierwszy. Given wiersz Copy różniący się od kodu choćby jednym znakiem (np. kropka na końcu), then test też jest czerwony. — verified by: test #2, #6
- [ ] AC5: Test jest czerwony na obecnym repo (przed uzupełnieniem Copy), a pełną listę braków zapisuje się w Evidence. Potem wiersze są dopisane i test jest zielony:
  - teksty opisane w Layout albo States swojego ekranu (w tym 11 tekstów z Evidence T-096) dopisuje się bez ponownego zatwierdzania, z dopiskiem „z Layout/States, T-100”;
  - teksty bez żadnego opisu w specyfikacji ekranu (np. SC-01 „Nie udało się zalogować. Spróbuj ponownie.”, SC-07 „Nie udało się unieważnić linku. Spróbuj ponownie.”, SC-08 „Coś poszło nie tak. Spróbuj ponownie.”) implementer zbiera w jedną listę i przedstawia właścicielowi przed wpisem. Dopisek: „zatwierdzone <data>, T-100”. Bez zatwierdzenia zadanie ma status `blocked`.
  — verified by: przebieg testu przed i po (Evidence), przegląd QA
- [ ] AC6: Brak furtek. Test nie ma listy wyjątków, pominiętych ekranów ani `skip`. Jeśli jakiś tekst naprawdę nie powinien trafić do Copy (np. tekst techniczny niewidoczny dla użytkownika), decyduje właściciel, a decyzja trafia do Evidence. — verified by: przegląd QA
- [ ] AC7: Zasada „Copy jest pełnym rejestrem tekstów ekranu; test zgodności w `apps/web`” jest opisana tam, gdzie projekt opisuje Copy albo testy web (`docs/architecture/layers/web.md` albo `testing-strategy.md`, wybór w Evidence). Opis mówi, że aplikacja mobilna (E-04) dołączy do tej kontroli. — verified by: przegląd QA
- [ ] AC8: No regression in: teksty w kodzie bez zmian (zmienia się dokumentacja i dochodzi test). `pnpm test`, `pnpm lint`, `pnpm typecheck` zielone.

## TDD plan

**Seam:** pliki źródłowe `apps/web/src/screens/*/messages.ts` i wspólne moduły tekstów (wejście) oraz sekcja `## Copy` w `docs/design/screens/SC-xx-*.md` (wzorzec). Logika ekstrakcji i porównania jest w funkcji, którą testy jednostkowe karmią fiksturami. Test na repo wywołuje ją na prawdziwych plikach.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | na prawdziwym repo: każdy tekst z `messages.ts` każdego ekranu SC-01–SC-09 ma wiersz Copy (czerwony przed uzupełnieniem) | unit (plikowy) | Vitest | AC1, AC5 |
| 2 | fikstura: tekst bez wiersza → błąd z ekranem, plikiem i tekstem; dwa braki → oba w komunikacie | unit | Vitest | AC4 |
| 3 | fikstura: wspólny moduł importowany przez ekran → jego teksty wymagane w Copy tego ekranu i tylko tego | unit | Vitest | AC2 |
| 4 | fikstura: wspólny moduł importowany pośrednio (moduł → moduł → ekran) → teksty wymagane | unit | Vitest | AC2 |
| 5 | fikstura: szablon `${String(x)} …` ↔ `{n} …` pasuje; stała `NAME_MAX_LENGTH` rozwinięta do liczby | unit | Vitest | AC3 |
| 6 | fikstura: różnica jednego znaku między kodem a Copy → błąd | unit | Vitest | AC4 |

**Run:** `pnpm --filter web test` (cały zestaw: `pnpm test`)

## QA plan

- **Regression:** `git diff --stat` dotyczy tylko `docs/` i nowego testu (z fiksturami). Żaden `messages.ts` nie zmienia tekstów.
- **Edge cases:** usunąć tymczasowo jeden wiersz Copy na dowolnym ekranie → czerwony z czytelnym komunikatem. Dodać nowy tekst do `errorText.ts` → czerwony na każdym ekranie, który go używa. Komórka Copy z dopiskiem w nawiasie (np. „(zatwierdzone …)”) albo z `|` w treści: dopisek nie psuje dopasowania, a tekst z kodu nie może pasować tylko częściowo. Ten sam tekst dwa razy w jednym `messages.ts`: wystarczy jeden wiersz Copy. Teksty wpisane bezpośrednio w JSX (`.tsx`, np. `components/ListCard`, `lists/LeaveListDialog`) są poza zakresem testu. Wymienić je w Evidence jako kandydatów dla właściciela.
- **Platforms:** Windows (lokalnie) i Linux (CI); końce linii CRLF/LF w plikach `.md` nie zmieniają wyniku.
- **Accessibility:** nie dotyczy (bez zmian w UI); teksty komunikatów dla czytników ekranu też podlegają testowi, jeśli są w `messages.ts`.

## Root cause

Zob. „Root cause” w T-096: brak porównania tekstów z kodu z tabelami Copy.

## Evidence

## Prevention

To zadanie jest prewencją dla klasy błędów z T-096.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
