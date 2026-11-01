---
id: E-02
title: Konto i zarządzanie udostępnianiem (web)
status: in-progress    # todo | in-progress | in-uat | done
approved: 2026-11-01    # date the user approved this epic's tasks (set by /plan-backlog)
change:                # brownfield only: the change ID this epic implements (C-NN)
branch: epic/E-02-konto-i-uczestnicy
pr: https://github.com/tombraz/lista-zakupow/pull/13
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

- S-02-01 Reset hasła mailem (F-03, SC-01, SC-02, SC-03)
- S-02-02 Uczestnicy: podgląd, usunięcie, opuszczenie listy (F-13, SC-07)
- S-02-03 Konto: zmiana imienia i usunięcie konta (F-04, F-16, SC-09)
- S-02-04 Brak połączenia (F-15, SC-05, SC-06, SC-07, SC-09)
- S-02-05 Sprzątanie danych i miary sukcesu (N-02, BRD §10)

Poprawki spoza epiku planowane razem z nim (`fixes/`, z UAT E-01): T-052 niestabilne CI na `main`, T-066 pusty `h1` SC-06, T-067 „Wszystko kupione” na pustej liście SC-05, T-068 alert CodeQL w pliku testowym.

## Technology

Jak w `docs/architecture/tech-stack.md`, potwierdzone przez właściciela 2026-11-01, plus:

- **Wysyłka maila (2026-11-01):** interfejs `Mailer` w API z dwiema implementacjami przez `fetch`, bez nowych zależności: Brevo HTTP API (staging, produkcja; sekret `BREVO_API_KEY` jak w `deployment.md`) i HTTP send API Mailpita (lokalnie). W testach integracyjnych adapter przechwytujący (`testing-strategy.md`, „Mocki tylko na granicach”).
- **Sprzątanie danych:** zadanie w procesie API raz dziennie, bez osobnej infrastruktury cron (`data-model.md`); bez nowej biblioteki harmonogramu.

## Done when

- Mail resetu dochodzi na staging; link działa raz i wygasa po 1 h.
- Usunięty uczestnik z otwartą listą natychmiast traci dostęp (MC-03).
- Usunięcie konta działa zgodnie z F-04; logowanie na usunięte konto się nie udaje.
- Po resecie hasła, usunięciu konta i wygaśnięciu sesji otwarte połączenie na żywo przestaje dostawać zdarzenia (TH-28).
- Tryb samolotowy pokazuje „Brak połączenia” i blokuje zapisy; po powrocie lista jest aktualna.

## UAT

<Written by /qa-task in UAT.md when all stories are done; the epic is done after the user confirms it.>

## Out of scope for this epic

- Aplikacja mobilna (E-04), produkcja (E-03).

- 2026-11-01: limit prośby o reset hasła per IP 3/min (domyślny Better Auth) zatwierdzony przez właściciela (T-053).
