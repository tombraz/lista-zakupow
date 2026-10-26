---
id: SC-04
title: Regulamin i polityka prywatności
requirements: [F-01]
journeys: [J-01]
platforms: [web]
design:
---

# SC-04 Regulamin i polityka prywatności

## Purpose

Każdy — także przed rejestracją — może przeczytać regulamin i politykę prywatności (F-01, N-02).

## Layout

Jasne tło, kolumna `content-max`.
1. `h1` „Regulamin i polityka prywatności”.
2. Spis treści: dwa linki do sekcji „Regulamin” i „Polityka prywatności” (`h2`).
3. Treść obu dokumentów (tekst `body`, nagłówki `h2`/`h3`).
4. Link „Wróć” (do poprzedniej strony; jeśli otwarta w nowej karcie — do SC-01).

Treść dokumentów dostarcza właściciel projektu; nie jest częścią designu. Polityka prywatności musi co najmniej opisywać: jakie dane zbieramy (imię, e-mail, treść list — BRD §8b), kto je widzi, brak zewnętrznej analityki, usunięcie konta (F-04), kopie zapasowe 7 dni (N-03).

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| — | tekst | Brak komponentów interaktywnych poza linkami |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | — (treść statyczna) | |
| Loading | — (strona statyczna) | |
| Error | — | |
| Success | Treść dokumentów | Wejście |
| No permission | — (publiczny) | |

## Interactions

- Link w spisie treści → przewinięcie do sekcji.
- „Wróć” → poprzednia strona.

## Copy

| Key | Text |
| --- | --- |
| title | Regulamin i polityka prywatności |
| toc.terms | Regulamin |
| toc.privacy | Polityka prywatności |
| back | Wróć |

## Accessibility

- Struktura nagłówków `h1` → `h2` → `h3`; linki spisu treści przenoszą fokus do sekcji.
- Tekst zawija się przy 320 px i 200% powiększenia.
- Sprawdzone z tabelą „Design”: nagłówki opisowe, przeformatowanie.
