---
id: S-02-02
epic: E-02
title: "Uczestnicy listy: podgląd, usunięcie, opuszczenie (web)"
status: done                  # todo | in-progress | done
requirements: [F-13]
screens: [SC-07, SC-06, SC-05]
---

# S-02-02 Uczestnicy listy: podgląd, usunięcie, opuszczenie (web)

**As** właściciel albo uczestnik wspólnej listy, **I want** widzieć, kto ma do niej dostęp, a jako właściciel usuwać osoby (jako uczestnik — odejść), **so that** wiem, kto widzi nasze zakupy, i mogę ten dostęp kontrolować.

## Acceptance criteria (business)

- [x] Given udostępniona lista, when właściciel lub uczestnik otworzy SC-07, then widzi imiona właściciela i wszystkich uczestników („Na liście (N z 20)”).
- [x] Given właściciel na SC-07, when patrzy na uczestnika, then widzi także jego e-mail; uczestnik nie widzi e-maili innych osób.
- [x] Given właściciel usuwa uczestnika, który ma otwartą listę, then ten natychmiast traci dostęp: nie dostaje dalszych zmian, nie może niczego zmienić i wraca na SC-05 z komunikatem (MC-03).
- [x] Given uczestnik potwierdzi „Opuść listę”, then lista znika z jego SC-05, a zmiany na niej przestają do niego docierać.
- [x] Given pozycje dodane przez usuniętego lub odchodzącego uczestnika, then zostają na liście z jego imieniem.
- [x] Given właściciel, then nie może opuścić własnej listy (może ją usunąć, F-05).

## Tasks

- T-056 Na żywo: subskrypcja nie wyprzedza odebrania dostępu; sesja sprawdzana przy subskrypcji i okresowo
- T-057 Uczestnicy na SC-07: podgląd, e-maile tylko dla właściciela
- T-058 Usunięcie uczestnika przez właściciela
- T-059 Opuszczenie listy przez uczestnika

## Notes

- Wyścig `subscribe` ↔ `revoke` i połączenie żyjące po wygaśnięciu sesji (QA T-009, znane ograniczenie UAT E-01) zamykamy przed usuwaniem uczestników (T-056).
- E-01 zostawił na SC-07 sekcję „Zaproszenia” i wiersz właściciela; ta historia dodaje resztę sekcji „Na liście”.

## Story acceptance (2026-11-02)

Verified after T-059 (QA round 1) as a user: `e2e/sc07-uczestnicy.spec.ts` (8/8, telefon + komputer) covers the list of people with „Na liście (N z 20)”, e-mails only for the owner, removal of a participant with the list open (SC-05 with MC-03) and leaving (SC-05 without the list, second tab with MC-03). On a local server with three sign-up accounts: after leaving no list event reaches the participant, reads and writes → 404, his items keep his name, the owner gets 403 `owner_cannot_leave`. All criteria pass.
