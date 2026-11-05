---
id: SC-02
title: Rejestracja
requirements: [F-01, F-12]
journeys: [J-01, J-04]
platforms: [web]
design:
---

# SC-02 Rejestracja

## Purpose

Osoba bez konta zakłada je: imię, e-mail, hasło, zgody i potwierdzenie wieku. Jeśli przyszła z zaproszenia, po rejestracji od razu widzi udostępnioną listę.

## Layout

Jak SC-01 (jasne tło, kolumna `content-max`).
1. `h1` „Załóż konto”.
2. Komunikat w treści (opcjonalny): kontekst zaproszenia.
3. Pole „Imię” z opisem „Tak zobaczą Cię inni na wspólnych listach.”
4. Pole „E-mail”.
5. Pole „Hasło” z opisem „Co najmniej 8 znaków.” i „Pokaż”.
6. Checkbox zgody: „Akceptuję [regulamin] i [politykę prywatności].” (linki otwierają SC-04 w nowej karcie, formularz zostaje wypełniony).
7. Checkbox zgody: „Mam ukończone 16 lat.”
8. Przycisk główny „Załóż konto”.
9. „Masz już konto?” + link „Zaloguj się” → SC-01.

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| TextField | standardowe | imię (`autocomplete="given-name"`, max 30), e-mail (`autocomplete="email"`) |
| PasswordField | nowe hasło | `autocomplete="new-password"`, min 8 |
| ConsentCheckbox | regulamin+polityka, wiek 16+ | oba wymagane |
| Button | główny | |
| InlineAlert | informacja, błąd | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | Puste pola, niezaznaczone zgody, przycisk aktywny | Wejście |
| Loading | „Załóż konto” z wskaźnikiem, nieaktywny | Wysłanie |
| Error — walidacja | Pod polami: „Wpisz imię”, „Imię może mieć najwyżej 30 znaków”, „Wpisz poprawny adres e-mail”, „Hasło musi mieć co najmniej 8 znaków”; pod zgodami: „Zaakceptuj regulamin i politykę prywatności”, „Potwierdź, że masz ukończone 16 lat”. Nad formularzem podsumowanie „Popraw N pól” | Wysłanie z błędami |
| Error — e-mail zajęty | Pod polem e-mail: „Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.” (z linkami) | F-01 |
| Error — limit | Błąd: „Zbyt wiele prób rejestracji. Spróbuj ponownie później.” | MC-05 |
| Error — sieć | Błąd: „Brak połączenia. Sprawdź internet i spróbuj ponownie.” | Brak sieci |
| Info — zaproszenie | Informacja: „Po założeniu konta dołączysz do listy „<nazwa>”.” | Wejście z SC-08 |
| Success | Zalogowany; przejście do SC-05 albo — z zaproszenia — do SC-08 i od razu do SC-06 udostępnionej listy | Konto założone |
| No permission | — (publiczny); zalogowany jest przekierowany na SC-05 | |

## Interactions

- „Załóż konto” / Enter → walidacja wszystkich pól naraz → konto → SC-05 lub ścieżka zaproszenia (F-12).
- Linki „regulamin” / „politykę prywatności” → SC-04 w nowej karcie.
- E-mail wpisany na SC-01 jest wstępnie wypełniony (3.3.7).

## Copy

| Key | Text |
| --- | --- |
| title | Załóż konto |
| name.label | Imię |
| name.hint | Tak zobaczą Cię inni na wspólnych listach. |
| email.label | E-mail |
| password.label | Hasło |
| password.hint | Co najmniej 8 znaków. |
| consent.terms | Akceptuję regulamin i politykę prywatności. |
| consent.age | Mam ukończone 16 lat. |
| submit | Załóż konto |
| haveAccount | Masz już konto? Zaloguj się |
| invalid.hiddenChars | Usuń niewidoczne lub specjalne znaki. (pod polem: imię; zatwierdzone 2026-11-01, T-060) |
| error.emailTaken | Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło. |
| info.invite | Po założeniu konta dołączysz do listy „{nazwa}”. |
| consent.terms.accept | Akceptuję (część `consent.terms`; z Layout/States, T-100) |
| consent.terms.termsLink | regulamin (link w `consent.terms`; z Layout/States, T-100) |
| consent.terms.and | i (część `consent.terms`; z Layout/States, T-100) |
| consent.terms.privacyLink | politykę prywatności (link w `consent.terms`; z Layout/States, T-100) |
| haveAccount.text | Masz już konto? (część `haveAccount`; z Layout/States, T-100) |
| haveAccount.link | Zaloguj się (link w `haveAccount` i `error.emailTaken`; z Layout/States, T-100) |
| error.emailTaken.text | Konto z tym adresem już istnieje. (część `error.emailTaken`; z Layout/States, T-100) |
| error.emailTaken.or | albo (część `error.emailTaken`; z Layout/States, T-100) |
| error.emailTaken.reset | zresetuj hasło (link w `error.emailTaken`; z Layout/States, T-100) |
| name.required | Wpisz imię (z Layout/States, T-100) |
| name.tooLong | Imię może mieć najwyżej 30 znaków (z Layout/States, T-100) |
| email.invalid | Wpisz poprawny adres e-mail (z Layout/States, T-100) |
| password.tooShort | Hasło musi mieć co najmniej 8 znaków (z Layout/States, T-100) |
| password.tooLong | Hasło może mieć najwyżej 128 znaków (z Copy SC-03 `step2.password.tooLong`, T-100) |
| consent.terms.required | Zaakceptuj regulamin i politykę prywatności (z Layout/States, T-100) |
| consent.age.required | Potwierdź, że masz ukończone 16 lat (z Layout/States, T-100) |
| summary | Popraw {n} {pól} (z Layout/States, T-100) |
| summary.one | pole (forma dla 1 w `summary`; zatwierdzone 2026-11-05, T-100) |
| summary.few | pola (forma dla 2–4 w `summary`; zatwierdzone 2026-11-05, T-100) |
| summary.many | pól (forma dla 5 i więcej w `summary`; z Layout/States, T-100) |
| error.rateLimit | Zbyt wiele prób rejestracji. Spróbuj ponownie później. (z Layout/States, T-100) |
| error.network | Brak połączenia. Sprawdź internet i spróbuj ponownie. (z Layout/States, T-100) |
| error.otherwise | Nie udało się założyć konta. Spróbuj ponownie. (zatwierdzone 2026-11-05, T-100) |

## Accessibility

- Fokus startowy na „Imię”. Po błędach walidacji fokus na podsumowaniu błędów (linki do pól), każdy błąd powiązany z polem (`aria-describedby`).
- Opisy pól („Co najmniej 8 znaków”) widoczne stale, nie tylko po błędzie.
- Checkboxy zgód: cała etykieta klikalna, wysokość ≥ 48.
- Sprawdzone z tabelą „Design”: etykiety, błędy z opisem naprawy, brak testu poznawczego, brak ponownego wpisywania danych.
