---
id: S-02-05
epic: E-02
title: Sprzątanie danych i miary sukcesu
status: done           # todo | in-progress | done
requirements: [N-02]
screens: []
---

# S-02-05 Sprzątanie danych i miary sukcesu

**As** właściciel produktu, **I want** żeby aplikacja sama usuwała dane, których już nie potrzebuje, i żebym po 4 tygodniach mógł policzyć miary sukcesu z jej danych, **so that** trzymamy tylko to, co obiecuje inwentarz danych, a o pilotażu decydujemy na podstawie liczb, bez zewnętrznej analityki.

## Acceptance criteria (business)

- [x] Given dane po terminie z inwentarza (`data-model.md`): wygasłe sesje, linki zaproszeń 30 dni po wygaśnięciu, aktywność starsza niż 90 dni, wygasłe tokeny resetu i liczniki limitów, when mija doba, then aplikacja je usuwa; reszta danych zostaje.
- [x] Given 4 tygodnie danych, when właściciel uruchomi zapytania miar, then dostaje liczbę aktywnych uczestników tygodniowo i liczbę dni z co najmniej 3 odhaczeniami na wspólnej liście (BRD §10).

## Tasks

- T-064 Codzienne sprzątanie danych w procesie API
- T-065 Zapytania miar sukcesu (`metrics.sql`)

## Notes

- Trzecia miara (zgubione zmiany, opóźnienia > 5 s) jest notowana ręcznie w `docs/pilot-log.md` — poza kodem.
- Sprzątanie bez osobnej infrastruktury cron (`data-model.md`).

## Story acceptance (2026-11-02)

Wszystkie taski `done` (T-064, T-065). Kryterium 1: T-064 QA pass, `cleanup.retention.test.ts` 9/9 zielone w tym przebiegu. Kryterium 2: `metrics.sql` uruchomiony w psql na lokalnej bazie z danymi z kilku tygodni → tabele `tydzień | aktywni_domownicy` i `tydzień | dni_wspólnych_zakupów` zgodne z danymi (T-065 QA round 1). Story: done.
