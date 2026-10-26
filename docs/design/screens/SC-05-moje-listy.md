---
id: SC-05
title: Moje listy
requirements: [F-05, F-06, F-14, F-15]
journeys: [J-02, J-04]
platforms: [web]
design:
---

# SC-05 Moje listy

## Purpose

Domownik widzi wszystkie listy, do których ma dostęp — własne i udostępnione mu — otwiera je i tworzy nowe. To ekran startowy po zalogowaniu.

## Layout

Kierunek B: `prototypes/directions.html?variant=B`, ramka „SC-05 Moje listy”.
1. AppBar (bez „Wstecz”): tytuł „Moje listy”, przycisk-ikona „Konto” → SC-09.
2. OfflineBanner (gdy brak połączenia).
3. Karty list (ListCard), sortowane od ostatnio zmienionej: nazwa, „N do kupienia”, „od <imię>” dla list udostępnionych, stos awatarów.
4. Przycisk główny „+ Nowa lista” pod kartami.
5. Formularz nowej listy (po naciśnięciu „+ Nowa lista”): pole „Nazwa listy” + „Utwórz” + „Anuluj” w miejscu przycisku.

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| AppBar | bez „Wstecz”, 1 ikona | |
| ListCard | | |
| Avatar | 28 px w stosie | maks. 4 awatary + „+N” |
| Button | główny | „+ Nowa lista”, „Utwórz” |
| TextField | standardowe | nazwa listy, 1–100 znaków (F-05) |
| EmptyState | | |
| OfflineBanner | | |
| Loading | szkielet kart | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | „Nie masz jeszcze żadnej listy.” + przycisk główny „Utwórz pierwszą listę” | Brak list (F-06) |
| Loading | Trzy szkielety kart | Wejście |
| Error — wczytanie | Błąd: „Nie udało się wczytać list.” + „Spróbuj ponownie” | Błąd serwera |
| Error — limit | Ostrzeżenie: „Masz już 50 list — to limit. Usuń listę, której nie używasz, żeby utworzyć nową.” Przycisk „+ Nowa lista” nieaktywny | 50 własnych list (F-05) |
| Error — nazwa | Pod polem: „Wpisz nazwę listy” / „Nazwa listy może mieć najwyżej 100 znaków” | Pusta nazwa |
| Offline | OfflineBanner; „+ Nowa lista” nieaktywny; karty widoczne w ostatnim znanym stanie | F-15 |
| Success | Karty list; po utworzeniu przejście do SC-06 nowej listy | |
| Info — usunięto dostęp | Informacja: „Lista „<nazwa>” została usunięta albo nie masz już do niej dostępu.” | Powrót z SC-06 po F-13/F-14 |
| No permission | — (każdy zalogowany widzi swoje listy); niezalogowany → SC-01 | |

## Interactions

- Karta → SC-06 tej listy.
- „+ Nowa lista” → formularz w miejscu przycisku, fokus na polu; „Utwórz” / Enter → lista utworzona → SC-06 (pusty stan listy, fokus na polu dodawania).
- „Anuluj” / Esc → formularz znika, fokus wraca na „+ Nowa lista”.
- Zmiany innych osób (nowa udostępniona lista, zmiana nazwy, liczba do kupienia, usunięcie listy) pojawiają się bez odświeżania w ≤ 5 s (F-14).
- „Konto” → SC-09.

## Copy

| Key | Text |
| --- | --- |
| title | Moje listy |
| card.toBuy | {n} do kupienia |
| card.allBought | Wszystko kupione |
| card.sharedBy | od {imię} |
| new | + Nowa lista |
| new.label | Nazwa listy |
| new.placeholder | np. Zakupy na tydzień |
| new.submit | Utwórz |
| cancel | Anuluj |
| empty.text | Nie masz jeszcze żadnej listy. |
| empty.cta | Utwórz pierwszą listę |
| limit | Masz już 50 list — to limit. Usuń listę, której nie używasz, żeby utworzyć nową. |
| removed | Lista „{nazwa}” została usunięta albo nie masz już do niej dostępu. |

## Accessibility

- `h1` „Moje listy” (tytuł w AppBar); karty w liście (`ul`), każda jako jeden link z pełną nazwą dostępną.
- Pojawienie się nowej listy od innej osoby nie przenosi fokusu; ogłoszenie `polite`: „Nowa lista: <nazwa>”.
- Cele ≥ 48 px; brak elementów przyklejonych poza AppBar.
- Sprawdzone z tabelą „Design”.
