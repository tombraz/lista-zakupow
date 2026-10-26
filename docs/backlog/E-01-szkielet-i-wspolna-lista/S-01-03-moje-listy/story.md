---
id: S-01-03
epic: E-01
title: Moje listy (web)
status: todo           # todo | in-progress | done
requirements: [F-05, F-06]
screens: [SC-05, SC-06]
---

# S-01-03 Moje listy (web)

**As** domownik, **I want** widzieć wszystkie swoje listy, tworzyć nowe, zmieniać ich nazwy i usuwać je, **so that** mam osobne listy na różne zakupy, a niepotrzebne nie zaśmiecają widoku.

## Acceptance criteria (business)

- [ ] Given domownik bez list, when otworzy aplikację, then widzi zdanie wyjaśnienia i przycisk „Utwórz pierwszą listę”.
- [ ] Given zalogowany domownik, when utworzy listę z nazwą, then lista pojawia się wśród jego list, a on jest jej właścicielem.
- [ ] Given domownik ma własne i udostępnione listy, when otworzy aplikację, then widzi wszystkie i wie, które są udostępnione mu przez innych.
- [ ] Given właściciel, when zmieni nazwę albo usunie listę (po potwierdzeniu), then zmiana dotyczy wszystkich uczestników.
- [ ] Given uczestnik, when próbuje zmienić nazwę lub usunąć listę, then nie może tego zrobić.
- [ ] Given nazwa pusta lub > 100 znaków albo 50 własnych list, when domownik próbuje zapisać, then widzi czytelny komunikat.
- [ ] Given domownik bez dostępu do listy, when podmieni jej adres, then nie widzi zawartości (MC-01).

## Tasks

- T-005 Moje listy: tworzenie, przegląd, zmiana nazwy i usunięcie (web)

## Notes

- Kolejność: od ostatnio zmienionej (`data-model.md`).
- „Udostępnione mi” i licznik „N do kupienia” w kartach — dane pojawiają się, gdy powstaną pozycje (T-006) i zaproszenia (T-008); kształt odpowiedzi `GET /api/v1/lists` od początku pełny.
