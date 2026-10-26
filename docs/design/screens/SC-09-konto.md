---
id: SC-09
title: Konto
requirements: [F-02, F-04, F-16]
journeys: [J-01]
platforms: [web]
design:
---

# SC-09 Konto

## Purpose

Domownik widzi swój e-mail, zmienia imię widoczne dla innych, wylogowuje się i może trwale usunąć konto.

## Layout

1. AppBar: „Wstecz” → SC-05, tytuł „Konto”.
2. OfflineBanner (gdy brak połączenia).
3. Sekcja „Twoje dane”: e-mail (tekst, nieedytowalny), pole „Imię” z opisem „Tak zobaczą Cię inni na wspólnych listach.” + przycisk drugorzędny „Zapisz imię”.
4. Przycisk drugorzędny „Wyloguj się”.
5. Link „Regulamin i polityka prywatności” → SC-04.
6. Sekcja „Usuń konto” (oddzielona): opis skutków + przycisk niebezpieczny „Usuń konto”.

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| AppBar | z „Wstecz” | |
| TextField | standardowe | imię, max 30, `autocomplete="given-name"` |
| Button | drugorzędny, niebezpieczny-tekstowy | |
| ConfirmDialog | usuń konto | |
| Toast | | „Imię zmienione” |
| InlineAlert | błąd | |
| OfflineBanner | | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | — (zawsze są dane konta) | |
| Loading | Wskaźnik w przycisku „Zapisz imię” / w oknie usuwania | Zapis |
| Error — imię | Pod polem: „Wpisz imię” / „Imię może mieć najwyżej 30 znaków” | F-16 |
| Error — zapis | „Nie udało się zapisać. Spróbuj ponownie.” | Błąd serwera |
| Offline | OfflineBanner; „Zapisz imię” i „Usuń konto” nieaktywne; „Wyloguj się” działa | F-15 |
| Success — imię | Toast „Imię zmienione” | F-16 |
| Success — wylogowanie | SC-01 | F-02 |
| Success — usunięcie | SC-01 z komunikatem „Konto zostało usunięte.” | F-04 |
| No permission | Niezalogowany → SC-01 | |

## Interactions

- „Zapisz imię” → zapis → Toast; nowe imię widoczne u innych w ≤ 5 s.
- „Wyloguj się” → bez potwierdzenia → SC-01.
- „Usuń konto” → ConfirmDialog (zob. Copy) → usunięcie → SC-01. Wystarczy potwierdzenie przyciskiem (F-04); bez przepisywania słowa, które byłoby zbędnym testem poznawczym.

## Copy

| Key | Text |
| --- | --- |
| title | Konto |
| section.data | Twoje dane |
| email.label | E-mail |
| name.label | Imię |
| name.hint | Tak zobaczą Cię inni na wspólnych listach. |
| name.save | Zapisz imię |
| name.saved | Imię zmienione |
| logout | Wyloguj się |
| legal | Regulamin i polityka prywatności |
| delete.section | Usuń konto |
| delete.body | Usunięcie konta jest trwałe. Twoje listy zostaną usunięte także u uczestników. Z cudzych list zostaniesz wypisany(-a), a dodane przez Ciebie pozycje zostaną z podpisem „usunięty użytkownik”. |
| delete.cta | Usuń konto |
| delete.confirm.title | Usunąć konto na zawsze? |
| delete.confirm.body | {n} Twoich list zniknie, także u ich uczestników. Tego nie da się cofnąć. |
| delete.confirm.cta | Usuń konto |
| deleted | Konto zostało usunięte. |

## Accessibility

- `h1` „Konto”, `h2` „Twoje dane”, „Usuń konto”.
- ConfirmDialog: fokus startowy na „Anuluj”.
- Sprawdzone z tabelą „Design”.
