---
id: S-02-04
epic: E-02
title: Brak połączenia (web)
status: in-progress           # todo | in-progress | done
requirements: [F-15]
screens: [SC-05, SC-06, SC-07, SC-09]
---

# S-02-04 Brak połączenia (web)

**As** domownik w sklepie ze słabym zasięgiem, **I want** wyraźnie widzieć, że nie mam połączenia, i nie widzieć zmian jako zapisanych, gdy nie są, **so that** nie myślę, że druga osoba widzi moje odhaczenia, kiedy ich nie widzi.

## Acceptance criteria (business)

- [ ] Given domownik traci połączenie z otwartą aplikacją, then widzi pasek „Brak połączenia. Zmiany nie są zapisywane.” (SC-05, SC-06, SC-07, SC-09).
- [ ] Given brak połączenia, when domownik próbuje dodać, edytować lub odhaczyć pozycję (albo utworzyć listę, zmienić dane), then akcje zapisu są nieaktywne i aplikacja nie pokazuje zmiany jako zapisanej.
- [ ] Given połączenie wraca, when domownik ma otwartą listę, then pasek znika, a lista pokazuje aktualny stan, także zmiany innych z czasu przerwy.

## Tasks

- T-063 Pasek „Brak połączenia”, blokada zapisów i aktualny stan po powrocie

## Notes

- Tryb offline z kolejką zmian poza zakresem (BRD §11). Bez optymistycznych aktualizacji (`architecture.md`).
- Wykrywanie: ping co 25 s, brak ponga przez 10 s = zerwane połączenie (`architecture.md`, „Zmiany na żywo”). Stan Offline przycisków dodawanych później (SC-07 „Usuń”, „Opuść listę”; SC-09 „Zapisz imię”, „Usuń konto”) obejmują taski, które je dodają.
