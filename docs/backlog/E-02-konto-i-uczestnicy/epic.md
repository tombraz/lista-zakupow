---
id: E-02
title: Konto i zarządzanie udostępnianiem (web)
status: todo           # todo | in-progress | in-uat | done
approved:              # date the user approved this epic's tasks (set by /plan-backlog)
change:                # brownfield only: the change ID this epic implements (C-NN)
branch:                # set by /build-epic: epic/E-xx-<slug> (epic-branch workflow)
pr:                    # set by /build-epic: link to the draft pull request
requirements: [F-03, F-04, F-13, F-15, F-16, N-02]
---

# E-02 Konto i zarządzanie udostępnianiem (web)

## Goal

Domownik odzyskuje dostęp do konta resetem hasła, zmienia imię i usuwa konto; właściciel widzi uczestników i usuwa ich ze skutkiem natychmiastowym, uczestnik opuszcza listę; bez sieci aplikacja wyraźnie to pokazuje. Dane są sprzątane, a miary sukcesu dają się policzyć.

## Requirements covered

- F-03 Reset hasła
- F-04 Usunięcie konta
- F-13 Uczestnicy listy
- F-15 Brak połączenia
- F-16 Zmiana imienia
- N-02 Prywatność (sprzątanie danych, usunięcie konta)

## Stories

Zarys; taski planowane, gdy E-02 stanie się następny (krok 1 `/plan-backlog` od nowa).

- S-02-01 Reset hasła mailem (F-03, SC-01, SC-03; TH-10, TH-11; Brevo na staging)
  - SC-03 pod trasą `/reset-hasla` (już linkują tam SC-02 „zresetuj hasło” i SC-01). Każdy link do SC-03 (SC-01, komunikat o zajętym e-mailu na SC-02) przenosi wpisany e-mail i kontekst zaproszenia jak `EntryLink` (WCAG 3.3.7; T-028). Do tego czasu `/reset-hasla` nie istnieje.
- S-02-02 Uczestnicy: podgląd, usunięcie, opuszczenie listy (F-13, SC-07; TH-04, TH-19)
- S-02-03 Konto: zmiana imienia i usunięcie konta (F-04, F-16, SC-09; TH-17, TH-18)
- S-02-04 Brak połączenia (F-15, pasek na SC-05–SC-09)
- S-02-05 Sprzątanie danych i miary sukcesu (N-02, BRD §10: codzienne sprzątanie wg `data-model.md`, `apps/api/scripts/metrics.sql`)

## Technology

<Do potwierdzenia przy planowaniu tasków E-02.>

## Done when

- Mail resetu dochodzi na staging; link działa raz i wygasa po 1 h.
- Usunięty uczestnik z otwartą listą natychmiast traci dostęp (MC-03).
- Usunięcie konta działa zgodnie z F-04; logowanie na usunięte konto się nie udaje.
- Tryb samolotowy pokazuje „Brak połączenia” i blokuje zapisy; po powrocie lista jest aktualna.

## UAT

<Written by /qa-task in UAT.md when all stories are done; the epic is done after the user confirms it.>

## Out of scope for this epic

- Aplikacja mobilna (E-04), produkcja (E-03).
