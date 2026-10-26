---
id: E-01
title: Szkielet i pierwsza wspólna lista
status: in-progress    # todo | in-progress | in-uat | done
approved: 2026-10-26    # date the user approved this epic's tasks (set by /plan-backlog)
change:                # brownfield only: the change ID this epic implements (C-NN)
branch: epic/E-01-szkielet-i-wspolna-lista # set by /build-epic: epic/E-xx-<slug> (epic-branch workflow)
pr:                    # set by /build-epic: link to the draft pull request
requirements: [F-01, F-02, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-14, N-01, N-02, N-04, N-05, N-06]
---

# E-01 Szkielet i pierwsza wspólna lista

## Goal

Domownik zakłada konto w przeglądarce, tworzy listę, dopisuje i odhacza pozycje (bez duplikatów, z informacją kto dodał i kto kupił), wysyła drugiej osobie link zaproszenia, a obie osoby widzą swoje zmiany na bieżąco. Całość działa na staging za CI z bramkami jakości i bezpieczeństwa; aplikacja mobilna istnieje jako szkielet połączony z API.

To epik pilotażu procesu (`docs/PILOT.md`): MVP z BRD jest dostarczane w czterech epikach (decyzja właściciela 2026-10-26, `docs/product/decisions.md`).

## Requirements covered

- F-01 Rejestracja konta (bez części zależnej od resetu hasła)
- F-02 Logowanie i wylogowanie
- F-05 Tworzenie, zmiana nazwy i usuwanie listy
- F-06 Przegląd list i pusty stan
- F-07 Dodawanie, edycja i usuwanie pozycji
- F-08 Odhaczanie pozycji i usuwanie odhaczonych
- F-09 Blokada duplikatu
- F-10 Kto dodał i kto odhaczył
- F-11 Link zaproszenia (tworzenie, unieważnianie)
- F-12 Przyjęcie zaproszenia
- F-14 Zmiany na bieżąco
- N-01 (web na telefonie i komputerze; mobile jako szkielet), N-02, N-04, N-05, N-06 — w kryteriach akceptacji tasków

## Stories

- S-01-01 Szkielet techniczny i staging
- S-01-02 Konto i logowanie (web)
- S-01-03 Moje listy (web)
- S-01-04 Pozycje i zakupy (web)
- S-01-05 Udostępnienie listy linkiem (web)
- S-01-06 Wspólne zakupy na żywo (web)

## Technology

As in docs/architecture/tech-stack.md, confirmed 2026-10-26.

## Done when

- Dwie osoby z osobnymi kontami w dwóch przeglądarkach (telefon i komputer) pracują na jednej liście na staging: dodanie, odhaczenie i usunięcie pozycji widać u drugiej osoby w ≤ 5 s.
- Druga osoba dołączyła przez link zaproszenia; ponowne użycie linku pokazuje „Ten link nie działa”.
- Trzecie konto nie widzi tej listy ani przez podmieniony adres, ani przez WebSocket.
- PR epiku ma zielony `ci-ok`; celowo zepsuty test daje czerwony `ci-ok`.
- Aplikacja mobilna (Android, emulator) uruchamia się i pokazuje stan API; flow Maestro przechodzi w CI.

## UAT

<Written by /qa-task in UAT.md when all stories are done; the epic is done after the user confirms it.>

## Out of scope for this epic

- Reset hasła, usunięcie konta, zmiana imienia, uczestnicy (podgląd, usuwanie, opuszczanie), pasek „brak połączenia” — E-02.
- Produkcja, monitoring, kopie — E-03.
- Ekrany aplikacji mobilnej — E-04.
