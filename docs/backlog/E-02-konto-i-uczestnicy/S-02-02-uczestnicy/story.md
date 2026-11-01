---
id: S-02-02
epic: E-02
title: "Uczestnicy listy: podgląd, usunięcie, opuszczenie (web)"
status: in-progress           # todo | in-progress | done
requirements: [F-13]
screens: [SC-07, SC-06, SC-05]
---

# S-02-02 Uczestnicy listy: podgląd, usunięcie, opuszczenie (web)

**As** właściciel albo uczestnik wspólnej listy, **I want** widzieć, kto ma do niej dostęp, a jako właściciel usuwać osoby (jako uczestnik — odejść), **so that** wiem, kto widzi nasze zakupy, i mogę ten dostęp kontrolować.

## Acceptance criteria (business)

- [ ] Given udostępniona lista, when właściciel lub uczestnik otworzy SC-07, then widzi imiona właściciela i wszystkich uczestników („Na liście (N z 20)”).
- [ ] Given właściciel na SC-07, when patrzy na uczestnika, then widzi także jego e-mail; uczestnik nie widzi e-maili innych osób.
- [ ] Given właściciel usuwa uczestnika, który ma otwartą listę, then ten natychmiast traci dostęp: nie dostaje dalszych zmian, nie może niczego zmienić i wraca na SC-05 z komunikatem (MC-03).
- [ ] Given uczestnik potwierdzi „Opuść listę”, then lista znika z jego SC-05, a zmiany na niej przestają do niego docierać.
- [ ] Given pozycje dodane przez usuniętego lub odchodzącego uczestnika, then zostają na liście z jego imieniem.
- [ ] Given właściciel, then nie może opuścić własnej listy (może ją usunąć, F-05).

## Tasks

- T-056 Na żywo: subskrypcja nie wyprzedza odebrania dostępu; sesja sprawdzana przy subskrypcji i okresowo
- T-057 Uczestnicy na SC-07: podgląd, e-maile tylko dla właściciela
- T-058 Usunięcie uczestnika przez właściciela
- T-059 Opuszczenie listy przez uczestnika

## Notes

- Wyścig `subscribe` ↔ `revoke` i połączenie żyjące po wygaśnięciu sesji (QA T-009, znane ograniczenie UAT E-01) zamykamy przed usuwaniem uczestników (T-056).
- E-01 zostawił na SC-07 sekcję „Zaproszenia” i wiersz właściciela; ta historia dodaje resztę sekcji „Na liście”.
