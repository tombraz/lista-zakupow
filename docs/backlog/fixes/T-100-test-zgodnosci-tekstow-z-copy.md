---
id: T-100
title: "Test zgodności tekstów ekranów web z tabelami Copy; uzupełnienie Copy SC-01–SC-09"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given każdy ekran web SC-01–SC-09, when `pnpm --filter web test`, then test sprawdza, że każdy literał tekstowy (string i szablon) z `SC-xx/messages.ts` ma wiersz w tabeli Copy specyfikacji tego ekranu. Ścieżki importów, klucze obiektów i komentarze nie są tekstami. — verified by: test #1, #2
- [x] AC2: Given tekst ze wspólnego modułu (np. `HIDDEN_CHARACTERS_TEXT`, `NAME_ERROR_TEXTS`, wspólny `network` z `errorText.ts`), then musi mieć wiersz w Copy każdego ekranu, który go używa. Ekran używa modułu, jeśli importuje go którykolwiek plik w katalogu ekranu, bezpośrednio albo przez inny wspólny moduł. Test sam ustala listę wspólnych modułów z importów, a nie z ręcznej listy. Moduł z tekstami, którego test nie rozpoznaje, jest błędem testu, a nie cichym pominięciem. — verified by: test #3, #4
- [x] AC3: Given tekst z parametrem (np. `` `${String(owned)} Twoich list zniknie…` ``), then test porównuje go z szablonem w Copy, w którym parametr to `{nazwa}` (np. `{n}`), niezależnie od nazwy zmiennej w kodzie. Stałe tekstowe (np. `NAME_MAX_LENGTH`) test rozwija do wartości, zanim porówna. Opis sposobu jest w nagłówku testu. — verified by: test #5
- [x] AC4 (negatywny): Given tekst bez wiersza w Copy (fikstura albo tymczasowo usunięty wiersz), then test jest czerwony, a komunikat podaje ekran, plik źródłowy i brakujący tekst. Komunikat wymienia wszystkie braki, nie tylko pierwszy. Given wiersz Copy różniący się od kodu choćby jednym znakiem (np. kropka na końcu), then test też jest czerwony. — verified by: test #2, #6
- [x] AC5: Test jest czerwony na obecnym repo (przed uzupełnieniem Copy), a pełną listę braków zapisuje się w Evidence. Potem wiersze są dopisane i test jest zielony:
  - teksty opisane w Layout albo States swojego ekranu (w tym 11 tekstów z Evidence T-096) dopisuje się bez ponownego zatwierdzania, z dopiskiem „z Layout/States, T-100”;
  - teksty bez żadnego opisu w specyfikacji ekranu (np. SC-01 „Nie udało się zalogować. Spróbuj ponownie.”, SC-07 „Nie udało się unieważnić linku. Spróbuj ponownie.”, SC-08 „Coś poszło nie tak. Spróbuj ponownie.”) implementer zbiera w jedną listę i przedstawia właścicielowi przed wpisem. Dopisek: „zatwierdzone <data>, T-100”. Bez zatwierdzenia zadanie ma status `blocked`.
  — verified by: przebieg testu przed i po (Evidence), przegląd QA
- [x] AC6: Brak furtek. Test nie ma listy wyjątków, pominiętych ekranów ani `skip`. Jeśli jakiś tekst naprawdę nie powinien trafić do Copy (np. tekst techniczny niewidoczny dla użytkownika), decyduje właściciel, a decyzja trafia do Evidence. — verified by: przegląd QA
- [x] AC7: Zasada „Copy jest pełnym rejestrem tekstów ekranu; test zgodności w `apps/web`” jest opisana tam, gdzie projekt opisuje Copy albo testy web (`docs/architecture/layers/web.md` albo `testing-strategy.md`, wybór w Evidence). Opis mówi, że aplikacja mobilna (E-04) dołączy do tej kontroli. — verified by: przegląd QA
- [x] AC8: No regression in: teksty w kodzie bez zmian (zmienia się dokumentacja i dochodzi test). `pnpm test`, `pnpm lint`, `pnpm typecheck` zielone.

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
| 7 | fikstura: ścieżki importów, typy, klucze, indeksy, porównywane kody, argumenty `new` i komentarze to nie teksty (dodany w trakcie) | unit | Vitest | AC1, AC6 |
| 8 | fikstura: komórka Copy z dopiskiem, klucz `a / b`, `\|` w treści; bez częściowego dopasowania (dodany w trakcie, krawędź z planu QA) | unit | Vitest | AC4 |
| 9 | fikstura: w module wspólnym liczą się literały wyglądające na tekst, nie klucze pól (dodany w trakcie) | unit | Vitest | AC2 |
| 10 | fikstura: nierozpoznany import i ekran bez specyfikacji → błąd testu (dodany w trakcie) | unit | Vitest | AC2, AC6 |
| 11 | fikstura: CRLF i LF w specyfikacji dają ten sam wynik (dodany w trakcie, krawędź z planu QA) | unit | Vitest | QA plan |
| 12 | fikstura: komunikat z wszystkimi brakami (ekran · plik · tekst) (dodany w trakcie) | unit | Vitest | AC4 |

**Run:** `pnpm vitest run --project web apps/web/src/screens/copyRegister.test.ts` (cały zestaw: `pnpm test`). Pakiet `@lista/web` nie ma skryptu `test`, więc `pnpm --filter web test` z AC1 nie istnieje. Testy web uruchamia root `vitest` (projekt `web`).

## QA plan

- **Regression:** `git diff --stat` dotyczy tylko `docs/` i nowego testu (z fiksturami). Żaden `messages.ts` nie zmienia tekstów.
- **Edge cases:** usunąć tymczasowo jeden wiersz Copy na dowolnym ekranie → czerwony z czytelnym komunikatem. Dodać nowy tekst do `errorText.ts` → czerwony na każdym ekranie, który go używa. Komórka Copy z dopiskiem w nawiasie (np. „(zatwierdzone …)”) albo z `|` w treści: dopisek nie psuje dopasowania, a tekst z kodu nie może pasować tylko częściowo. Ten sam tekst dwa razy w jednym `messages.ts`: wystarczy jeden wiersz Copy. Teksty wpisane bezpośrednio w JSX (`.tsx`, np. `components/ListCard`, `lists/LeaveListDialog`) są poza zakresem testu. Wymienić je w Evidence jako kandydatów dla właściciela.
- **Platforms:** Windows (lokalnie) i Linux (CI); końce linii CRLF/LF w plikach `.md` nie zmieniają wyniku.
- **Accessibility:** nie dotyczy (bez zmian w UI); teksty komunikatów dla czytników ekranu też podlegają testowi, jeśli są w `messages.ts`.

## Root cause

Zob. „Root cause” w T-096: brak porównania tekstów z kodu z tabelami Copy.

## Evidence

Zbudowano 2026-11-05 (`/implement-task T-100`). Pliki: `apps/web/test/copyRegister.ts` (`findCopyGaps`, `formatCopyGaps`) i `apps/web/src/screens/copyRegister.test.ts`. Sposób porównania opisuje nagłówek testu. Teksty w kodzie bez zmian: `git diff --stat -- apps/` pusty, doszły tylko dwa nowe pliki.

### Testy (red → green)

Numery jak w TDD plan. Wszystkie w `copyRegister.test.ts`, wszystkie teraz przechodzą (12/12).

1. `every text of screens SC-01–SC-09 has a row in its Copy table`. Red na repo przed uzupełnieniem Copy: `AssertionError: expected 'Teksty bez wiersza w tabeli Copy spec…' to be 'Teksty bez wiersza w tabeli Copy spec…'`, 95 braków (lista niżej). Green po dopisaniu wierszy. Test sprawdza też, że znalazł katalogi SC-01…SC-09 (pusty skan nie przejdzie).
2. `reports every text of messages.ts without a Copy row, with screen and file`. Red (stub zwracał `[]`): `AssertionError: expected [] to deeply equal [ { screen: 'SC-01', …(2) }, …(1) ]`. Green.
3. `texts of a shared module are required on each screen that imports them, and only there`. Red: `AssertionError: expected [] to deeply equal [ { screen: 'SC-01', …(2) }, …(1) ]`. Green.
4. `texts of a shared module imported indirectly (module → module → screen) are required`. Przeszedł od razu, bo przejście grafu importów powstało w kroku green testu #3. Sprawdzone, że gryzie: po wyłączeniu podążania za referencjami deklaracji #3 i #4 są czerwone, po przywróceniu zielone.
5. `a template parameter matches any {name} in Copy; package constants are expanded`. Red: `AssertionError: expected [] to deeply equal [ Array(1) ]`. Green.
6. `a Copy row differing by one character (final full stop) does not match`. Przeszedł od razu: dokładne porównanie było już minimalną implementacją z #2. Pinuje zachowanie.
7. `import paths, object keys, types, index keys, compared codes and `new` arguments are not texts`. Red: `expected [ { screen: 'SC-01', …(2) }, …(6) ] to deeply equal []`, potem `[ … "" … ]` (pusty literał). Po decyzji właściciela (grupa C) red: `expected [ { screen: 'SC-01', …(2) }, …(2) ] to deeply equal []` (`"pl-PL"`, `"numeric"`, `"long"`). Green.
8. `reads Copy cells: note in brackets, `a / b` keys, escaped pipe; no partial match`. Red: `expected [ …(7) ] to deeply equal [ 'i', 'Kupione' ]`. Green.
9. `in a shared module only literals that look like interface text count (not field keys)`. Red: `expected [ 'name', 'Wpisz nazwę listy' ] to deeply equal [ 'Wpisz nazwę listy' ]` (`focusField("name")` w `lists/listName.ts`). Green.
10. `an import or a screen the test cannot resolve is an error, not a silent skip`. Przeszedł od razu: `throw` w `resolve` i `specOf` powstał w kroku green testu #3.
11. `CRLF line endings in the spec give the same result as LF`. Przeszedł od razu: parser dzieli linie po `\r?\n` od testu #2. Na Windows test #1 czyta kopie robocze z CRLF (`git ls-files --eol`: `w/crlf`), w CI LF.
12. `formats all gaps in one message: screen, source file and missing text`. Red: `AssertionError: expected '' to be 'Teksty bez wiersza w tabeli Copy spec…'`. Green.

### Pełna lista braków przed uzupełnieniem Copy (AC5)

Test #1 z ostatecznymi regułami: 95 braków. Wcześniejsze przebiegi w trakcie budowy dały 101 braków (z kluczem pola „name” z `lists/listName.ts`, test #9) i 99 (z argumentami `new`, test #7).

- SC-01 (`screens/SC-01-logowanie/messages.ts`): „Wpisz adres e-mail”, „Wpisz hasło”, „Hasło zmienione. Zaloguj się nowym hasłem.”, „Konto zostało usunięte.”, „Nie udało się zalogować. Spróbuj ponownie.”
- SC-01 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-02 (`screens/SC-02-rejestracja/messages.ts`): „Akceptuję”, „regulamin”, „i”, „politykę prywatności”, „Masz już konto?”, „Zaloguj się”, „Konto z tym adresem już istnieje.”, „albo”, „zresetuj hasło”, „Wpisz poprawny adres e-mail”, „Hasło musi mieć co najmniej 8 znaków”, „Hasło może mieć najwyżej 128 znaków”, „Zaakceptuj regulamin i politykę prywatności”, „Potwierdź, że masz ukończone 16 lat”, „Zbyt wiele prób rejestracji. Spróbuj ponownie później.”, „Nie udało się założyć konta. Spróbuj ponownie.”, „pole”, „pola”, „pól”, „Popraw {…} {…}”
- SC-02 (`session/personName.ts`): „Wpisz imię”, „Imię może mieć najwyżej 30 znaków”
- SC-02 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-03 (`screens/SC-03-reset-hasla/messages.ts`): „E-mail”, „Nowe hasło”, „Co najmniej 8 znaków.”, „Hasło musi mieć co najmniej 8 znaków”, „Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.”
- SC-03 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-04 (`screens/SC-04-regulamin/messages.ts`): „Spis treści”
- SC-05 (`screens/SC-05-moje-listy/messages.ts`): „Konto”, „udostępniona przez {…}”, „Nie udało się wczytać list.”, „Nowa lista: {…}”, „Nie udało się utworzyć listy. Spróbuj ponownie.”
- SC-05 (`lists/listName.ts`): „Nazwa listy może mieć najwyżej 100 znaków”, „Wpisz nazwę listy”
- SC-05 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-06 (`screens/SC-06-lista/messages.ts`): „Wstecz”, „Nie udało się wczytać listy.”, „Wróć do moich list”, „Więcej opcji”, „Uczestnicy”, „Dołączyłeś(-aś) do listy „{…}”.”, „Nazwa listy”, „Usunąć listę „{…}”?”, „Anuluj”, „Do kupienia”, „Dodaj pozycję”, „Dodano {…}”, „Edytuj {…}”, „Odhaczono {…}”, „Kupione”, „Tego nie można cofnąć.”, „Usuń kupione”, „Nazwa”, „Ta pozycja została usunięta przez inną osobę.”, „Zamknij”, „Nazwa może mieć najwyżej 100 znaków”, „Wpisz nazwę pozycji”, „Notatka może mieć najwyżej 200 znaków”, „uczestnika”, „uczestników”, „Zniknie też u {…} {…}.”
- SC-06 (`lists/listName.ts`): „Nazwa listy może mieć najwyżej 100 znaków”, „Wpisz nazwę listy”
- SC-06 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-07 (`screens/SC-07-uczestnicy/messages.ts`): „Wstecz”, „Nie udało się wczytać uczestników.”, „Nie masz dostępu do tej listy.”, „Wróć do moich list”, „Skopiuj link ręcznie.”, „Usuń {…} z listy”, „Usunąć {…} z listy?”, „Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną.”, „Anuluj”, „Utworzono zbyt wiele linków. Spróbuj ponownie za godzinę.”, „Nie udało się utworzyć linku. Spróbuj ponownie.”, „Nie udało się unieważnić linku. Spróbuj ponownie.”
- SC-07 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-08 (`screens/SC-08-zaproszenie/messages.ts`): „Zbyt wiele prób. Spróbuj ponownie za minutę.”, „Coś poszło nie tak. Spróbuj ponownie.”
- SC-08 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”
- SC-09 (`screens/SC-09-konto/messages.ts`): „Wstecz”, „Anuluj”, „Nie udało się zapisać. Spróbuj ponownie.”
- SC-09 (`session/personName.ts`): „Wpisz imię”, „Imię może mieć najwyżej 30 znaków”
- SC-09 (`errorText.ts`): „Brak połączenia. Sprawdź internet i spróbuj ponownie.”

### Decyzje właściciela (2026-11-05, w tej sesji)

- **Grupa A, zatwierdzone wszystkie w obecnym brzmieniu** (dopisek „zatwierdzone 2026-11-05, T-100”). To teksty bez opisu w specyfikacji ekranu: SC-01 „Nie udało się zalogować. Spróbuj ponownie.”; SC-02 „Nie udało się założyć konta. Spróbuj ponownie.”, formy „pole” i „pola” w `summary`; SC-05 „Nie udało się utworzyć listy. Spróbuj ponownie.”; SC-06 „Wpisz nazwę pozycji”, „Tego nie można cofnąć.”, „Usuń kupione”, „uczestnika”; SC-07 „Utworzono zbyt wiele linków. Spróbuj ponownie za godzinę.”, „Nie udało się utworzyć linku. Spróbuj ponownie.”, „Nie udało się unieważnić linku. Spróbuj ponownie.”; SC-08 „Zbyt wiele prób. Spróbuj ponownie za minutę.”, „Coś poszło nie tak. Spróbuj ponownie.”
- **Grupa B, bez nowego zatwierdzenia.** Teksty zatwierdzone już w Copy/States innego ekranu dopisano z dopiskiem źródła, np. „z Copy SC-09 `deleted`, T-100”, „z States SC-01, T-100”: SC-01 „Konto zostało usunięte.”; SC-02 „Hasło może mieć najwyżej 128 znaków”; SC-05/06/07/09 „Brak połączenia…”; SC-06 „Dołączyłeś(-aś)…”, „Nazwa listy”, „Wpisz nazwę listy”, „Nazwa listy może mieć najwyżej 100 znaków”.
- **Grupa C (AC6).** Argumenty wyrażeń `new …(…)`, także w obiekcie opcji, to nie tekst. Dotyczy `"pl-PL"`, `"numeric"`, `"long"` w `new Intl.PluralRules` / `new Intl.DateTimeFormat` (SC-02, SC-07). To reguła składniowa w `isConstructorArgument`, nie lista wyjątków.
- Pozostałe teksty są opisane w specyfikacji ekranu. Dopiski podają sekcję: „z Layout/States, T-100”, a przy opisie w innej sekcji „z Interactions, T-100” albo „z Accessibility, T-100”. Teksty opisane w specyfikacji komponentu w `design-system.md` mają „z design-system ItemRow / ListCard / ConfirmDialog, T-100” („Edytuj <nazwa>”, „udostępniona przez <imię>”, „Anuluj” w ConfirmDialog na SC-07). Teksty złożone w JSX z kilku literałów (SC-02 „Akceptuję [regulamin] i [politykę prywatności].”, „Masz już konto? Zaloguj się”, „Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.”; SC-06 `delete.confirm`; SC-07 `remove.confirm`) mają wiersz dla każdego literału, z dopiskiem „część `<klucz>`”. Wiersz całego zdania zostaje.

### Kryteria akceptacji

- **AC1:** test #1 (repo) i #2. Wyjątki pozycji (ścieżki importów, klucze, typy, komentarze) w teście #7. Test obejmuje cały `messages.ts` każdego katalogu `screens/SC-xx-*`, a pozostałe pliki katalogu ekranu tylko przez ich importy i literały wyglądające na tekst.
- **AC2:** testy #3, #4, #9, #10. Wspólne moduły test ustala z importów każdego pliku katalogu ekranu (także `.tsx`), bez ręcznej listy. Liczy się importowany symbol i deklaracje, których on używa, także w innych modułach. Dlatego SC-01 (`errorText()`) wymaga „Brak połączenia…”, ale nie `HIDDEN_CHARACTERS_TEXT`. Decyzja implementera: dosłowne „ekran używa modułu” na poziomie całego modułu wymagałoby „Usuń niewidoczne lub specjalne znaki.” w Copy SC-01/03/07/08, które go nie pokazują. Nierozpoznany import względny, `import x from`/`import * as` z pliku względnego, nierozpoznany eksport oraz ekran bez specyfikacji albo bez `## Copy` to błąd testu (`throw`), nie pominięcie. Sprawdzone też ręcznie: dopisanie `rate_limited: "Za dużo żądań."` do `COMMON` w `errorText.ts` dało czerwony test z brakiem na SC-01, 02, 03, 05, 06, 07, 08, 09. SC-04 nie importuje `errorText`. Plik przywrócony.
- **AC3:** test #5 i nagłówek testu. Parametr `${…}` daje `{…}`, a każde `{nazwa}` w Copy też daje `{…}`. Stała z `@lista/shared` (`X`, `X.a.b`, `String(…)`) jest rozwijana przez wartość z modułu pakietu (test #1 przekazuje `import * as shared from "@lista/shared"`).
- **AC4:** testy #2, #6, #8, #12. Ręcznie: po usunięciu wiersza `invite.revokeError` z SC-07 test jest czerwony z `SC-07 · screens/SC-07-uczestnicy/messages.ts · „Nie udało się unieważnić linku. Spróbuj ponownie.”`. Plik przywrócony.
- **AC5:** lista braków wyżej. Wiersze dopisano w `docs/design/screens/SC-01…SC-09`, po czym test #1 jest zielony.
- **AC6:** w teście nie ma listy wyjątków, pominiętych ekranów ani `skip`. Reguły „co nie jest tekstem” są składniowe i opisane w nagłówku testu; regułę `new` zatwierdził właściciel (grupa C).
- **AC7:** wybrano `docs/architecture/layers/web.md`, „Pułapki”: nowy punkt przed punktem o Copy z T-080, bo tam projekt opisuje Copy dla web. Punkt zawiera wzmiankę, że mobile (E-04) dołączy. Dodano też wiersz w „Historia zmian” i `copyRegister.ts` w „Gdzie jest kod” (`apps/web/test/`).
- **AC8:** `pnpm check` (format, lint, typecheck, jscpd, dependency-cruiser, design-check, backlog-check, workflow-check, `pnpm test`: 154 pliki, 1236 testów, mobile 10 testów) kończy się kodem 0. `pnpm build` też. Żaden `messages.ts` się nie zmienił.

### Teksty poza zakresem testu: kandydaci dla właściciela (JSX i literały w `.tsx`)

`lists/LeaveListDialog.tsx`: „Opuścić listę „{nazwa}”?”, „Żeby wrócić, potrzebujesz nowego zaproszenia.”, „Opuść”, „Anuluj”, „Nie udało się opuścić listy. Spróbuj ponownie.” (SC-06, SC-07). `components/OfflineBanner`: „Brak połączenia. Zmiany nie są zapisywane.”, „Połączenie przywrócone.”. `components/PasswordField`: „Pokaż”, „Ukryj”. `components/LoadError`: „Spróbuj ponownie”. `components/AuthPage`: „Wspólna lista zakupów”, „Regulamin i polityka prywatności”. `components/ListCard`: separator „, ” nazwy dostępnej. `screens/SC-07-uczestnicy/Members.tsx`: „{właściciel} · {Ty}”. `screens/SC-04-regulamin/documents.tsx`: treść regulaminu i polityki. Znaki: „←” (AppBar), „⚠ ✓ ℹ” (InlineAlert), „▴ ▾” (BoughtSection), „?” i „+” (Avatar). Rozszerzenie testu na `.tsx` to osobne zadanie, jeśli właściciel zechce.

### Dla QA

- Heurystyka „wygląda na tekst” (polska litera albo słowo z wielkiej litery i kolejne słowo) działa tylko poza `messages.ts`. Pojedyncze słowo małymi literami bez polskich znaków we wspólnym module `.ts` (np. „albo”) przejdzie niezauważone. W `messages.ts` liczy się każdy literał.
- Reguła dopisku w komórce: ` (…)` na końcu, z `:`, `;` albo `T-NNN`. Nawiasy będące częścią tekstu („Kupione ({n})”, „(opcjonalnie)”, „dodał(a)”) nie spełniają warunku i zostają.
- Step 8b: w „Komendy” warstwy web nie ma skryptu `test` pakietu, a AC1 podaje `pnpm --filter web test`. Właściwa komenda to `pnpm vitest run --project web` (jest w przewodniku).

## Prevention

To zadanie jest prewencją dla klasy błędów z T-096.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-05)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | dokumentacja testu (AC3, AC7) | Nagłówek `copyRegister.test.ts:10-11` mówi, że w module wspólnym „liczy się każdy literał użytej deklaracji”, gdy któryś wygląda na tekst. Kod (`copyRegister.ts:167`) filtruje każdy literał osobno (`literals.filter(looksLikeText)`), co pinuje test #9 (`"name"` odpada, `"Wpisz nazwę listy"` zostaje). Nagłówek pomija też regułę argumentów `new …(…)` (grupa C), a `web.md` twierdzi, że reguły „co nie jest tekstem” są w nagłówku. | odczyt kodu; test #9 | Nagłówek opisuje regułę per literał i wymienia regułę `new`. |
| 2 | note | zasięg testu | Heurystyka `looksLikeText` i reguła `new` mogą przepuścić tekst UI w przyszłości: jedno słowo małymi literami bez polskich znaków we wspólnym `.ts` albo `new Error("…")` pokazany użytkownikowi. Dziś nic takiego nie ma. Sprawdzone: po wyłączeniu filtra test #1 zgłasza tylko literały techniczne (metody HTTP, ścieżki API, klucze zapytań, zdarzenia WebSocket, kody pól). | uruchomienie z `return literals`, plik przywrócony | Do rozważenia przy rozszerzaniu testu. |
| 3 | note | AC1 | `pnpm --filter web test` z AC1 nie istnieje (pakiet `@lista/web` nie ma skryptu `test`). Evidence to odnotowuje. Właściwa komenda: `pnpm vitest run --project web`. | `apps/web/package.json` | Ewentualnie dodać skrypt `test` do `@lista/web`. |
| 4 | note | parser Copy | Wiersz nagłówka i separatora tabeli Copy (`Text`, `---`) też trafiają do zbioru tekstów. Ryzyko fałszywie zielonego wyniku jest pomijalne. | `copyRegister.ts:328-341` | Opcjonalnie pomijać dwa pierwsze wiersze tabeli. |
| 5 | note | zakres | Teksty w JSX (`.tsx`) są poza testem. Lista kandydatów jest w Evidence (np. `LeaveListDialog`, `OfflineBanner`, `PasswordField`, `LoadError`). | Evidence | Osobne zadanie, jeśli właściciel zechce. |

Weryfikacja:

- `pnpm install --frozen-lockfile` i `pnpm check` (format, lint, typecheck, jscpd, dependency-cruiser, design-check, backlog-check, testy) kończą się kodem 0. Web/api/shared: 154 pliki, 1236 testów. Mobile: 10 testów. Testy T-100: 12/12.
- AC1 pass: test #1 obejmuje każdy `messages.ts` SC-01–SC-09 i sprawdza, że znalazł wszystkie 9 katalogów. Wykluczenia (#7) są składniowe.
- AC2 pass: sprawdzone ręcznie. Dopisanie `rate_limited: "Za dużo żądań."` do `COMMON` w `errorText.ts` daje czerwony test na SC-01, 02, 03, 05, 06, 07, 08 i 09 (SC-04 nie importuje). Nierozpoznany import i ekran bez specyfikacji kończą się `throw` (#10).
- AC3 pass: test #5 (`{n}` ↔ `${…}`, rozwinięcie `NAME_MAX_LENGTH`, `LIMITS.items`). Opis w nagłówku jest częściowo nieścisły (finding 1).
- AC4 pass: po usunięciu wiersza `clearBought.confirm.cta` z SC-06 test jest czerwony z `SC-06 · screens/SC-06-lista/messages.ts · „Usuń kupione”`, razem z brakami z `errorText.ts` w jednym komunikacie, czyli wszystkie braki naraz. Test #6 sprawdza różnicę jednego znaku.
- AC5 pass: przywrócenie `docs/design/screens` z `b42a3a4` daje dokładnie 95 braków, tyle co w Evidence. Próbka 22 wierszy z dopiskiem „z Layout/States, T-100”: każdy ma tekst opisany w Layout albo States swojej specyfikacji. Teksty grupy A mają dopisek „zatwierdzone 2026-11-05, T-100”.
- AC6 pass: brak listy wyjątków, `skip` i pominiętych ekranów. Regułę `new` zatwierdził właściciel (grupa C).
- AC7 pass: `docs/architecture/layers/web.md`, „Pułapki”, ze wzmianką o mobile (E-04), wpisem w „Historia zmian” i w „Gdzie jest kod”.
- AC8 pass: `git diff --stat b42a3a4 3acd2ac -- apps/ packages/` pokazuje tylko 2 nowe pliki. Żaden `messages.ts` się nie zmienił.
- Test quality: po wyłączeniu `gaps.push` (`copyRegister.ts:45`) 7 z 12 testów jest czerwonych, w tym wszystkie fikstury braków. Test #1 bez braków zostaje zielony, co jest poprawne. Czerwień udokumentowana dla #1, 2, 3, 5, 7, 8, 9, 12. Dla #4, 6, 10 i 11 Evidence wyjaśnia, dlaczego przeszły od razu, a #4 ma spot-check. Wartości oczekiwane to literały.
- Fix task: Root cause (T-096) wyjaśnia, dlaczego nic tego nie wychwyciło: żaden test nie porównywał tekstów z kodu z Copy. Test #1 jest czerwony bez uzupełnienia Copy (95 braków, odtworzone).
- UI, a11y i zagrożenia nie dotyczą (bez zmian w UI, `threats: []`). `git status` czysty po wszystkich spot-checkach.
