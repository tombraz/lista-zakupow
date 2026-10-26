---
id: SC-06
title: Lista
requirements: [F-05, F-07, F-08, F-09, F-10, F-14, F-15]
journeys: [J-02, J-03, J-05]
platforms: [web]
design:
---

# SC-06 Lista

## Purpose

Główny ekran aplikacji: domownik dodaje, edytuje, usuwa i odhacza pozycje, widzi, kto co dodał i kupił, a zmiany innych osób pojawiają się na bieżąco. Właściciel stąd zmienia nazwę listy i ją usuwa.

## Layout

Kierunek B z polem dodawania na dole: `prototypes/directions.html?variant=B`, ramka „SC-06 Lista” (w prototypie pole jest jeszcze na górze — obowiązuje ta specyfikacja i `core-flow.html`).
1. AppBar: „Wstecz” → SC-05, nazwa listy, ikony „Uczestnicy” → SC-07 i „Więcej opcji” (menu).
2. OfflineBanner (gdy brak połączenia).
3. Linia stanu pod paskiem: „N do kupienia” (region `polite`).
4. Pozycje nieodhaczone (ItemRow), najnowsze na górze.
5. CollapsibleSection „Kupione (N)”, domyślnie zwinięta; po rozwinięciu odhaczone pozycje (ostatnio odhaczone na górze) i „Usuń wszystkie kupione”.
6. AddBar przyklejony do dołu: „Co kupić?” + „Dodaj”; po wpisaniu nazwy pojawia się „Ilość / notatka (opcjonalnie)”.

Menu „Więcej opcji”: właściciel — „Zmień nazwę listy”, „Usuń listę”; uczestnik — „Opuść listę” (→ jak na SC-07).

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| AppBar | z „Wstecz”, 2 ikony | |
| ItemRow | nieodhaczona, odhaczona | |
| Avatar | 32 px | osoba, która dodała (nieodhaczone) lub odhaczyła (kupione) |
| CollapsibleSection | | „Kupione (N)” |
| AddBar | | |
| BottomSheet | edycja pozycji | |
| ConfirmDialog | usuń listę, usuń kupione | |
| InlineAlert | ostrzeżenie, błąd | duplikat, limit, błąd zapisu |
| OfflineBanner | | |
| EmptyState | | lista bez pozycji |
| Loading | szkielet wierszy | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | „Lista jest pusta. Dopisz pierwszą rzecz w polu na dole.”; fokus na polu dodawania | Brak pozycji |
| Empty — wszystko kupione | Nad sekcją „Kupione”: „Wszystko kupione.” | Brak nieodhaczonych |
| Loading | Szkielet 5 wierszy; AddBar nieaktywny | Wejście |
| Error — wczytanie | „Nie udało się wczytać listy.” + „Spróbuj ponownie” | Błąd serwera |
| Error — duplikat | Ostrzeżenie nad polem: „„Mleko” jest już na liście. Pozycja nie została dodana.” albo dla odhaczonej: „„Banany” są już na liście jako kupione. Odznacz tę pozycję w sekcji „Kupione”, żeby kupić ponownie.” + przycisk „Pokaż” (rozwija „Kupione” i przewija do pozycji). Wpisany tekst zostaje | F-09 |
| Error — limit pozycji | Ostrzeżenie: „Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje.”; AddBar nieaktywny | F-07 |
| Error — długość | Pod polem: „Nazwa może mieć najwyżej 100 znaków” / „Notatka może mieć najwyżej 200 znaków” | F-07 |
| Error — zapis | Błąd: „Nie udało się zapisać zmiany. Spróbuj ponownie.”; pozycja wraca do stanu sprzed zmiany | Błąd serwera |
| Saving | Checkbox / przycisk z wskaźnikiem; zmiana nie jest pokazana jako zapisana do potwierdzenia | Każda zmiana (F-15) |
| Offline | OfflineBanner „Brak połączenia. Zmiany nie są zapisywane.”; AddBar, checkboxy, edycja nieaktywne; lista w ostatnim znanym stanie; po powrocie połączenia — aktualny stan | F-15 |
| Live update | Zmiana innej osoby pojawia się w ≤ 5 s; zmieniony wiersz krótko podświetlony | F-14 |
| Edycja usuniętej pozycji | W arkuszu: „Ta pozycja została usunięta przez inną osobę.” + „Zamknij” | F-14 (usunięcie wygrywa) |
| Success | Lista z pozycjami | |
| No permission | Komunikat „Nie masz dostępu do tej listy.” + „Wróć do moich list”, bez żadnej treści listy | Obcy adres listy (MC-01) |
| Dostęp odebrany / lista usunięta | Natychmiast: powrót do SC-05 z komunikatem „Lista „<nazwa>” została usunięta albo nie masz już do niej dostępu.” | F-13, F-14, MC-03 |

## Interactions

- Checkbox → odhacz / odznacz; po zapisie pozycja przenosi się do „Kupione” (lub z powrotem), podpis zmienia się na „kupił(a) <imię>” / „dodał(a) <imię>”.
- Nazwa pozycji → BottomSheet „Edytuj pozycję” (nazwa, ilość/notatka, „Zapisz”, „Usuń pozycję”, „Anuluj”). Zmiana nazwy na nazwę innej pozycji → ostrzeżenie duplikatu w arkuszu (F-09).
- „Usuń pozycję” w arkuszu → usunięcie od razu, bez dodatkowego potwierdzenia (pojedyncza pozycja łatwo dopisać ponownie).
- AddBar „Dodaj” / Enter → sprawdzenie duplikatu → pozycja na górze nieodhaczonych; pola czyszczone, fokus zostaje w polu nazwy.
- „Kupione (N)” → zwija / rozwija.
- „Usuń wszystkie kupione” → ConfirmDialog „Usunąć N kupionych pozycji?” → usunięcie.
- „Więcej opcji” → „Zmień nazwę listy” (arkusz z polem nazwy) / „Usuń listę” (ConfirmDialog „Usunąć listę „<nazwa>”? Zniknie też u {n} uczestników.”) → SC-05.
- „Uczestnicy” → SC-07.

## Copy

| Key | Text |
| --- | --- |
| toBuy | {n} do kupienia |
| addedBy | dodał(a) {imię} |
| boughtBy | kupił(a) {imię} |
| deletedUser | usunięty użytkownik |
| add.label | Co kupić? |
| add.note.label | Ilość / notatka (opcjonalnie) |
| add.submit | Dodaj (nazwa dostępna: „Dodaj pozycję”) |
| bought | Kupione ({n}) |
| clearBought | Usuń wszystkie kupione |
| clearBought.confirm | Usunąć {n} kupionych pozycji? |
| check / uncheck | Odhacz {nazwa} / Odznacz {nazwa} |
| edit.title | Edytuj pozycję |
| edit.save | Zapisz |
| edit.delete | Usuń pozycję |
| dup.open | „{nazwa}” jest już na liście. Pozycja nie została dodana. |
| dup.bought | „{nazwa}” jest już na liście jako kupione. Odznacz tę pozycję w sekcji „Kupione”, żeby kupić ponownie. |
| dup.show | Pokaż |
| dup.rename | Na liście jest już pozycja „{nazwa}”. Wybierz inną nazwę. |
| limit | Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje. |
| empty | Lista jest pusta. Dopisz pierwszą rzecz w polu na dole. |
| allBought | Wszystko kupione. |
| menu.rename | Zmień nazwę listy |
| menu.delete | Usuń listę |
| menu.leave | Opuść listę |
| delete.confirm | Usunąć listę „{nazwa}”? Zniknie też u {n} uczestników. |
| noAccess | Nie masz dostępu do tej listy. |
| saveError | Nie udało się zapisać zmiany. Spróbuj ponownie. |

Uwaga: forma „dodał(a)” to kompromis — aplikacja nie zna rodzaju gramatycznego użytkownika (BRD go nie zbiera).

## Accessibility

- `h1` = nazwa listy. Pozycje w dwóch listach (`ul`) z nagłówkami „Do kupienia” (wizualnie ukryty) i „Kupione”.
- Po odhaczeniu fokus przechodzi na checkbox następnej nieodhaczonej pozycji (albo poprzedniej, gdy to była ostatnia); ogłoszenie `polite`: „Odhaczono <nazwa>”.
- Po dodaniu fokus zostaje w polu nazwy; ogłoszenie „Dodano <nazwa>”. Ostrzeżenie duplikatu `role="alert"`.
- Po usunięciu w arkuszu fokus na następnej pozycji.
- Zmiany innych osób nie przenoszą fokusu; aktualizuje się tylko region „N do kupienia”.
- AddBar przyklejony: lista ma dolny margines równy wysokości paska, element z fokusem przewijany nad pasek (2.4.11).
- Brak przeciągania i przesuwania; wszystkie akcje przyciskami. Cele ≥ 48 px, wiersz ≥ 60 px.
- Podświetlenie zmiany i przeniesienie wyłączone przy „ogranicz ruch”.
- Sprawdzone z tabelą „Design”.
