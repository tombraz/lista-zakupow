# 0004 Blokada duplikatu pozycji: znormalizowany klucz z unikalnym indeksem w bazie

- Status: przyjęty (2026-10-26, razem z `docs/architecture/`)
- Data: 2026-10-26

## Kontekst

F-09: nie można dodać ani zmienić nazwy pozycji na nazwę innej pozycji listy (także odhaczonej), bez rozróżniania wielkości liter, także gdy dwie osoby dodają to samo jednocześnie (F-14). Polskie znaki (Ł/ł, Ż/ż) muszą się porównywać poprawnie.

## Decyzja

Kolumna `item.name_key` = nazwa po `trim`, normalizacji NFC i `toLocaleLowerCase('pl-PL')`, liczona jedną funkcją w `packages/shared`; `UNIQUE (list_id, name_key)`. Naruszenie indeksu → 409 `duplicate_item`. Klient sprawdza duplikat lokalnie tą samą funkcją dla szybkiej informacji, ale rozstrzyga baza.

## Rozważane alternatywy

- **`lower(name)` w indeksie funkcyjnym:** wynik zależy od collation bazy i ustawień hostingu; ryzyko różnic dla polskich znaków między lokalną bazą a produkcją.
- **Collation ICU niedeterministyczna:** poprawna, ale mniej znana i z ograniczeniami (np. `LIKE`); trudniejsza w Drizzle.
- **Sprawdzenie tylko w kodzie (`SELECT` przed `INSERT`):** wyścig przy równoczesnym dodaniu.

## Konsekwencje

- Zmiana reguły normalizacji wymaga migracji przeliczającej `name_key`.
- Zmiana nazwy pozycji na tę samą z inną wielkością liter przechodzi (ten sam wiersz), zgodnie z F-09.
