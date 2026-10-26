---
id: E-04
title: Aplikacja mobilna
status: todo           # todo | in-progress | in-uat | done
approved:              # date the user approved this epic's tasks (set by /plan-backlog)
change:                # brownfield only: the change ID this epic implements (C-NN)
branch:                # set by /build-epic: epic/E-xx-<slug> (epic-branch workflow)
pr:                    # set by /build-epic: link to the draft pull request
requirements: [F-01, F-02, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-13, F-14, F-15, F-16, N-01, N-04]
---

# E-04 Aplikacja mobilna

## Goal

Domownik z Androidem instaluje APK z linku i robi w aplikacji natywnej to samo co w przeglądarce: loguje się, prowadzi listy, odhacza pozycje na żywo, widzi uczestników i zarządza kontem. Linki zaproszenia i resetu hasła otwierają web (`architecture.md`, ADR 0008).

## Requirements covered

- F-01, F-02, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-13, F-14, F-15, F-16 — w aplikacji natywnej (reguły biznesowe już w API)
- N-01 Platformy, N-04 Dostępność (TalkBack, VoiceOver, największy tekst)

## Stories

Zarys; taski planowane, gdy E-04 stanie się następny.

- S-04-01 Logowanie i rejestracja w aplikacji (SC-01, SC-02, SC-04; TH-16 — token w SecureStore)
- S-04-02 Listy i pozycje w aplikacji (SC-05, SC-06)
- S-04-03 Na żywo i brak połączenia w aplikacji (F-14, F-15; WS z tokenem w nagłówku)
- S-04-04 Uczestnicy i konto w aplikacji (SC-07, SC-09; czy tworzenie linków zaproszenia jest też w aplikacji — do ustalenia przy planowaniu)
- S-04-05 Dystrybucja: profile EAS, `mobile.yml`, APK z linku (`pipeline.md`, kandydat 5; TH-23)

## Technology

<Do potwierdzenia przy planowaniu tasków E-04.>

## Done when

- APK z linku działa z API produkcji na telefonie domownika; główny przepływ J-01–J-03 i J-05 przechodzi w Maestro.

## UAT

<Written by /qa-task in UAT.md when all stories are done; the epic is done after the user confirms it.>

## Out of scope for this epic

- Dystrybucja iOS (ADR 0008), deep linki, sklepy z aplikacjami.
