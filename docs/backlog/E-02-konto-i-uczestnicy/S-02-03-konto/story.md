---
id: S-02-03
epic: E-02
title: "Konto: zmiana imienia i usunięcie konta (web)"
status: done           # todo | in-progress | done
requirements: [F-04, F-16, N-02]
screens: [SC-09, SC-01]
---

# S-02-03 Konto: zmiana imienia i usunięcie konta (web)

**As** domownik, **I want** zmienić imię, pod którym widzą mnie inni, i móc trwale usunąć konto, **so that** inni mnie rozpoznają, a moje dane nie zostają w aplikacji, gdy z niej rezygnuję.

## Acceptance criteria (business)

- [x] Given zalogowany domownik, when zmieni imię na poprawne (1–30 znaków), then nowe imię widać przy jego pozycjach i na listach uczestników u wszystkich (≤ 5 s u osób z otwartą listą).
- [x] Given puste imię lub dłuższe niż 30 znaków, when domownik próbuje je zapisać, then zmiana się nie udaje z czytelnym komunikatem.
- [x] Given imię, nazwa listy lub pozycji ze znakami niewidocznymi, sterującymi albo odwracającymi kierunek tekstu, when ktoś próbuje je zapisać, then zapis się nie udaje; „Mleko” z dopisanym niewidocznym znakiem to duplikat „Mleko” (TH-29).
- [x] Given domownik jest właścicielem list, when usunie konto (po wyraźnym potwierdzeniu), then jego listy znikają, a ich uczestnicy tracą do nich dostęp.
- [x] Given domownik jest uczestnikiem cudzych list, when usunie konto, then zostaje z nich wypisany, a dodane przez niego pozycje zostają z podpisem „usunięty użytkownik”.
- [x] Given konto usunięte, when ktoś spróbuje się na nie zalogować, then logowanie się nie udaje; otwarte sesje i połączenia na żywo tego konta przestają działać.

## Tasks

- T-060 Tekst widoczny dla innych bez znaków sterujących i bidi; duplikat po NFKC
- T-061 Zmiana imienia (SC-09)
- T-062 Usunięcie konta (SC-09)

## Notes

- TH-29 (przegląd bezpieczeństwa E-01, #7 rundy 1): jedna reguła w `packages/shared/src/api/text.ts` dla imienia, nazw list i pozycji oraz notatek; normalizacja duplikatu z migracją istniejących danych.
- Eksport danych poza zakresem (BRD §11).

## Story acceptance (2026-11-02, QA after T-062)

All tasks done (T-060, T-061, T-062). Verified end to end:

- Name change 1–30 characters visible live to others, invalid names refused with a message: E2E `j01-zmiana-imienia.spec.ts` (telefon + komputer, green in this run) and T-061 QA.
- Invisible / control / bidi characters refused, „Mleko” + invisible character is a duplicate: T-060 QA (TH-29); full suite green.
- Owner deletes the account after confirmation → own lists disappear for participants (Tomek on SC-06 → SC-05 with the deletion message); participant's items on others' lists stay as „usunięty użytkownik”; sign-in with the deleted account fails with „Nieprawidłowy e-mail lub hasło.”: E2E `j01-usuniecie-konta.spec.ts` (both projects green).
- Open sessions and live connections of the deleted account stop working: T-062 SEC1 / SEC2 integration tests.

Result: pass.
