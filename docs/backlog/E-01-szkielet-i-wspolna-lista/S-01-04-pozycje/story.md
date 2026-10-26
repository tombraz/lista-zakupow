---
id: S-01-04
epic: E-01
title: Pozycje i zakupy (web)
status: todo           # todo | in-progress | done
requirements: [F-07, F-08, F-09, F-10]
screens: [SC-06]
---

# S-01-04 Pozycje i zakupy (web)

**As** domownik, **I want** dopisywać, poprawiać i odhaczać pozycje, bez dubli i z informacją kto co dodał i kupił, **so that** w sklepie wiem, co jeszcze trzeba kupić, i nikt nie kupuje drugi raz tego samego.

## Acceptance criteria (business)

- [ ] Given domownik z dostępem do listy, when doda pozycję z nazwą (i opcjonalnie ilością/notatką), then pozycja jest na liście jako nieodhaczona, podpisana jego imieniem.
- [ ] Given pozycja „Mleko” (nieodhaczona lub odhaczona), when ktoś dodaje „mleko” albo zmienia nazwę innej pozycji na „mleko”, then widzi ostrzeżenie i zmiana nie jest zapisana.
- [ ] Given pozycja na liście, when domownik ją edytuje lub usuwa, then zmiana jest zapisana dla wszystkich z dostępem.
- [ ] Given nieodhaczona pozycja, when domownik ją odhaczy, then jest przekreślona w sekcji „Kupione” z podpisem, kto ją kupił; odznaczenie przywraca ją do „do kupienia”.
- [ ] Given odhaczone pozycje, when domownik wybierze „Usuń wszystkie kupione” i potwierdzi, then odhaczone znikają, nieodhaczone zostają.
- [ ] Given nazwa pusta lub > 100 znaków, notatka > 200 znaków albo 500 pozycji, when domownik próbuje zapisać, then widzi czytelny komunikat.

## Tasks

- T-006 Pozycje: dodawanie, edycja, usuwanie i blokada duplikatu (web)
- T-007 Odhaczanie, „kto kupił” i usuwanie kupionych (web)

## Notes

- Porównanie duplikatu: `normalizeItemName` z `packages/shared` (trim, NFC, `toLocaleLowerCase('pl-PL')`); „Mleko owsiane” nie jest duplikatem „Mleko”.
- Bez optymistycznych aktualizacji: zmiana widoczna jako zapisana dopiero po odpowiedzi API (F-15).
- Odhaczenie zapisuje aktywność dzienną (`list_daily_activity`) — instrumentacja miar sukcesu z BRD §10.
