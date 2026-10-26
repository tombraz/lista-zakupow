---
id: SC-01
title: Logowanie
requirements: [F-02]
journeys: [J-01, J-04]
platforms: [web]
design:
---

# SC-01 Logowanie

## Purpose

Domownik loguje się e-mailem i hasłem na telefonie lub komputerze. Stąd trafia do rejestracji albo do resetu hasła.

## Layout

Jasne tło (`bg.default`), kolumna o szerokości `content-max`, wyśrodkowana, margines boczny 16.
1. Nazwa aplikacji „Wspólna lista zakupów” (tekst, `title-lg`) — nagłówek `h1`: „Zaloguj się”.
2. Komunikat w treści (opcjonalny): kontekst zaproszenia albo błąd logowania.
3. Pole „E-mail”, pole „Hasło” (z „Pokaż”).
4. Przycisk główny „Zaloguj się” (pełna szerokość).
5. Link „Nie pamiętasz hasła?” → SC-03.
6. Separator, tekst „Nie masz konta?” + przycisk drugorzędny „Załóż konto” → SC-02.
7. Stopka: link „Regulamin i polityka prywatności” → SC-04.

Wygląd wg kierunku B: `prototypes/directions.html?variant=B` (styl przycisków i pól).

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| TextField | standardowe | e-mail, `autocomplete="email"`, `type="email"` |
| PasswordField | bieżące hasło | `autocomplete="current-password"` |
| Button | główny, drugorzędny | |
| InlineAlert | informacja, błąd | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | Puste pola, przycisk aktywny | Wejście na ekran |
| Loading | Przycisk „Zaloguj się” z wskaźnikiem, nieaktywny | Wysłanie formularza |
| Error | Błąd: „Nieprawidłowy e-mail lub hasło.” (bez wskazania, które); pole hasła wyczyszczone, e-mail zostaje | Złe dane (F-02) |
| Error — limit prób | Błąd: „Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut albo zresetuj hasło.” | Ograniczenie prób (MC-04) |
| Error — walidacja | Pod polem: „Wpisz adres e-mail” / „Wpisz hasło” | Puste pole przy wysłaniu |
| Error — sieć | Błąd: „Brak połączenia. Sprawdź internet i spróbuj ponownie.” | Brak sieci |
| Info — zaproszenie | Informacja: „Zaloguj się, żeby dołączyć do listy „<nazwa>”.” | Wejście z SC-08 |
| Info — po resecie | Sukces: „Hasło zmienione. Zaloguj się nowym hasłem.” | Powrót z SC-03 |
| Success | Przejście do SC-05 (albo z powrotem do SC-08, jeśli przyszedł z zaproszenia) | Poprawne dane |
| No permission | — (ekran publiczny); zalogowany domownik jest od razu przekierowany na SC-05 | |

## Interactions

- „Zaloguj się” / Enter → walidacja, logowanie → SC-05 albo powrót do adresu, z którego przyszedł (np. SC-08).
- „Nie pamiętasz hasła?” → SC-03 (krok 1) z wpisanym już e-mailem.
- „Załóż konto” → SC-02 (z zachowanym kontekstem zaproszenia i wpisanym e-mailem).
- „Pokaż” → przełącza widoczność hasła.

## Copy

| Key | Text |
| --- | --- |
| title | Zaloguj się |
| email.label | E-mail |
| password.label | Hasło |
| password.show / hide | Pokaż / Ukryj |
| submit | Zaloguj się |
| forgot | Nie pamiętasz hasła? |
| noAccount | Nie masz konta? |
| register | Załóż konto |
| error.credentials | Nieprawidłowy e-mail lub hasło. |
| error.rateLimit | Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut albo zresetuj hasło. |
| info.invite | Zaloguj się, żeby dołączyć do listy „{nazwa}”. |
| legal | Regulamin i polityka prywatności |

## Accessibility

- Fokus startowy na polu „E-mail”. Po błędzie logowania fokus na komunikacie błędu (`role="alert"`), potem kolejno pola.
- Etykiety widoczne nad polami; menedżer haseł i wklejanie działają (3.3.8); brak CAPTCHA.
- Cele ≥ 48 px; brak elementów przyklejonych.
- Sprawdzone z tabelą „Design” w `references/accessibility.md`: kontrast, etykiety, błędy z opisem, uwierzytelnianie bez testu poznawczego.
