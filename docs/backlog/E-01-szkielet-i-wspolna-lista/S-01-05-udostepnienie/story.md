---
id: S-01-05
epic: E-01
title: Udostępnienie listy linkiem (web)
status: done                # todo | in-progress | done
requirements: [F-11, F-12, F-01]
screens: [SC-07, SC-08, SC-01, SC-02]
---

# S-01-05 Udostępnienie listy linkiem (web)

**As** właściciel listy, **I want** wysłać domownikowi jednorazowy link, przez który dołączy do listy (zakładając konto, jeśli go nie ma), **so that** robimy zakupy z jednej listy zamiast z kartki.

## Acceptance criteria (business)

- [x] Given właściciel listy, when wygeneruje zaproszenie, then dostaje link do skopiowania, ważny 7 dni.
- [x] Given niewykorzystany link, when właściciel go unieważni, then link przestaje działać.
- [x] Given zalogowany domownik z ważnym linkiem, when przyjmie zaproszenie, then staje się uczestnikiem i widzi listę.
- [x] Given osoba bez konta z ważnym linkiem, when się zarejestruje, then od razu widzi udostępnioną listę.
- [x] Given link wykorzystany, wygasły lub unieważniony, when ktoś go otworzy, then nie dostaje dostępu i widzi czytelny komunikat (MC-02).
- [x] Given lista z 20 uczestnikami, właściciel na własnym linku albo uczestnik już na liście, when przyjmuje zaproszenie, then nic się nie zmienia i widzi czytelny komunikat.
- [x] Given uczestnik (nie właściciel), when próbuje wygenerować zaproszenie, then nie może.

## Tasks

- T-008 Link zaproszenia i jego przyjęcie (web)

## Notes

- Link zawsze otwiera web (`architecture.md`, także na telefonie).
- Sekcja „Na liście” na SC-07 (podgląd, usuwanie uczestników, opuszczanie) — E-02 (S-02-02). W E-01 SC-07 pokazuje sekcję „Zaproszenia” właściciela i wiersz właściciela.

## Acceptance (2026-10-29, QA T-008 round 2)

Wszystkie kryteria biznesowe sprawdzone end to end: E2E J-04 (dwa konteksty przeglądarki: link → rejestracja drugiego konta → lista u obu → ponowne użycie linku „Ten link nie działa”, link unieważniony, właściciel na własnym linku, limit, już na liście), integracja (`invitations.*.test`, `sign-up-invitation.test`) i exploity na zbudowanym API z rundy 1 (uczestnik tworzy link → 403 `owner_only`, 21. uczestnik → 409, użyty / unieważniony link → 410 bez treści listy). Wynik: pass. Ręczne testy na urządzeniach mobilnych — w UAT epiki.
