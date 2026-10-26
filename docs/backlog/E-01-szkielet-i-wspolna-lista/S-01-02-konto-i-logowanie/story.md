---
id: S-01-02
epic: E-01
title: Konto i logowanie (web)
status: todo           # todo | in-progress | done
requirements: [F-01, F-02]
screens: [SC-01, SC-02, SC-04]
---

# S-01-02 Konto i logowanie (web)

**As** domownik, **I want** założyć konto i logować się e-mailem i hasłem na telefonie i komputerze, **so that** moje listy są tylko moje i dostępne z każdego urządzenia.

## Acceptance criteria (business)

- [ ] Given osoba bez konta, when poda imię, poprawny e-mail i hasło, zaakceptuje regulamin i politykę prywatności oraz potwierdzi wiek 16+, then konto zostaje założone i osoba jest zalogowana.
- [ ] Given e-mail użyty już przez inne konto, when ktoś próbuje założyć konto z tym e-mailem, then rejestracja się nie udaje z czytelnym komunikatem.
- [ ] Given brak zgód, hasło < 8 znaków albo imię puste lub > 30 znaków, when osoba próbuje założyć konto, then konto nie powstaje, a komunikat mówi, co poprawić.
- [ ] Given istniejące konto, when domownik poda poprawny e-mail i hasło, then jest zalogowany i widzi swoje listy.
- [ ] Given błędny e-mail lub hasło, when domownik próbuje się zalogować, then komunikat nie zdradza, czy konto istnieje.
- [ ] Given zalogowany domownik, when się wyloguje, then nie ma dostępu do list do ponownego zalogowania.
- [ ] Given wiele nieudanych prób logowania lub rejestracji, when ktoś próbuje dalej, then kolejne próby są ograniczane (MC-04, MC-05).

## Tasks

- T-004 Rejestracja, logowanie i wylogowanie (web)

## Notes

- Część F-01 „z linku zaproszenia od razu widzi listę” — T-008 (S-01-05).
- Regulamin i polityka prywatności (SC-04) dostępne przed rejestracją; treść krótka, po polsku.
- TH-12 (wyliczanie kont przez rejestrację) zaakceptowane — komunikat „e-mail już użyty” jest wymagany przez BRD.
