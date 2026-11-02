---
id: S-02-05
epic: E-02
title: Sprzątanie danych i miary sukcesu
status: in-progress    # todo | in-progress | done
requirements: [N-02]
screens: []
---

# S-02-05 Sprzątanie danych i miary sukcesu

**As** właściciel produktu, **I want** żeby aplikacja sama usuwała dane, których już nie potrzebuje, i żebym po 4 tygodniach mógł policzyć miary sukcesu z jej danych, **so that** trzymamy tylko to, co obiecuje inwentarz danych, a o pilotażu decydujemy na podstawie liczb, bez zewnętrznej analityki.

## Acceptance criteria (business)

- [ ] Given dane po terminie z inwentarza (`data-model.md`): wygasłe sesje, linki zaproszeń 30 dni po wygaśnięciu, aktywność starsza niż 90 dni, wygasłe tokeny resetu i liczniki limitów, when mija doba, then aplikacja je usuwa; reszta danych zostaje.
- [ ] Given 4 tygodnie danych, when właściciel uruchomi zapytania miar, then dostaje liczbę aktywnych uczestników tygodniowo i liczbę dni z co najmniej 3 odhaczeniami na wspólnej liście (BRD §10).

## Tasks

- T-064 Codzienne sprzątanie danych w procesie API
- T-065 Zapytania miar sukcesu (`metrics.sql`)

## Notes

- Trzecia miara (zgubione zmiany, opóźnienia > 5 s) jest notowana ręcznie w `docs/pilot-log.md` — poza kodem.
- Sprzątanie bez osobnej infrastruktury cron (`data-model.md`).
