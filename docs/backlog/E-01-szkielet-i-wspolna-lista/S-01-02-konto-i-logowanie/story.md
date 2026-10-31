---
id: S-01-02
epic: E-01
title: Konto i logowanie (web)
status: done           # todo | in-progress | done
requirements: [F-01, F-02]
screens: [SC-01, SC-02, SC-04]
---

# S-01-02 Konto i logowanie (web)

**As** domownik, **I want** założyć konto i logować się e-mailem i hasłem na telefonie i komputerze, **so that** moje listy są tylko moje i dostępne z każdego urządzenia.

## Acceptance criteria (business)

- [x] Given osoba bez konta, when poda imię, poprawny e-mail i hasło, zaakceptuje regulamin i politykę prywatności oraz potwierdzi wiek 16+, then konto zostaje założone i osoba jest zalogowana.
- [x] Given e-mail użyty już przez inne konto, when ktoś próbuje założyć konto z tym e-mailem, then rejestracja się nie udaje z czytelnym komunikatem.
- [x] Given brak zgód, hasło < 8 znaków albo imię puste lub > 30 znaków, when osoba próbuje założyć konto, then konto nie powstaje, a komunikat mówi, co poprawić.
- [x] Given istniejące konto, when domownik poda poprawny e-mail i hasło, then jest zalogowany i widzi swoje listy.
- [x] Given błędny e-mail lub hasło, when domownik próbuje się zalogować, then komunikat nie zdradza, czy konto istnieje.
- [x] Given zalogowany domownik, when się wyloguje, then nie ma dostępu do list do ponownego zalogowania.
- [x] Given wiele nieudanych prób logowania lub rejestracji, when ktoś próbuje dalej, then kolejne próby są ograniczane (MC-04, MC-05).

## Tasks

- T-004 Rejestracja, logowanie i wylogowanie (web)

## Notes

- Część F-01 „z linku zaproszenia od razu widzi listę” — T-008 (S-01-05).
- Regulamin i polityka prywatności (SC-04) dostępne przed rejestracją; treść krótka, po polsku.
- TH-12 (wyliczanie kont przez rejestrację) zaakceptowane — komunikat „e-mail już użyty” jest wymagany przez BRD.

## Story acceptance (2026-10-27)

Sprawdzone end-to-end po QA round 2 T-004 (zbudowana aplikacja, przeglądarka i API): rejestracja z kompletem zgód → zalogowany na „Moje listy”; zajęty e-mail → komunikat pod polem; błędy walidacji → konto nie powstaje, podsumowanie „Popraw N pól”; logowanie → „Moje listy” (treść list przychodzi w T-005); zła para e-mail/hasło → ten sam komunikat dla nieistniejącego konta; wylogowanie → `/listy` prowadzi na SC-01; limity logowania (per IP i per konto, także równolegle) i rejestracji → 429. Telefon (320–390 px) i komputer.
