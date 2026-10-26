---
id: E-03
title: Produkcja i operacje
status: todo           # todo | in-progress | in-uat | done
approved:              # date the user approved this epic's tasks (set by /plan-backlog)
change:                # brownfield only: the change ID this epic implements (C-NN)
branch:                # set by /build-epic: epic/E-xx-<slug> (epic-branch workflow)
pr:                    # set by /build-epic: link to the draft pull request
requirements: [N-03]
---

# E-03 Produkcja i operacje

## Goal

Domownicy korzystają z aplikacji web na produkcji (`lista-prod.fly.dev`); wdrożenie wymaga akceptacji właściciela, da się je wycofać, a awaria i koszty są zgłaszane mailem. Kopia bazy jest sprawdzona odtworzeniem.

## Requirements covered

- N-03 Dostępność usługi, kopie, alarmy

## Stories

Zarys; taski planowane, gdy E-03 stanie się następny.

- S-03-01 Wdrożenie produkcji z akceptacją, gałęzią-kopią Neon, tagiem wydania i wycofaniem (`pipeline.md`, kandydaci 4 i 7; TH-07, TH-24)
- S-03-02 Monitoring, alerty kosztowe i test odtworzenia kopii (`pipeline.md`, kandydat 6)

## Technology

<Do potwierdzenia przy planowaniu tasków E-03.>

## Done when

- Akceptacja w środowisku `production` wdraża obraz z `main`; smoke test przechodzi; powstaje tag i Release.
- Celowo nieudany smoke test na staging uruchamia wycofanie.
- Wyłączona maszyna daje mail z UptimeRobot; przywrócona gałąź Neon ma te same listy.

## UAT

<Written by /qa-task in UAT.md when all stories are done; the epic is done after the user confirms it.>

## Out of scope for this epic

- Dystrybucja aplikacji mobilnej (E-04).
