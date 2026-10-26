---
id: SC-03
title: Reset hasła
requirements: [F-03]
journeys: [J-01]
platforms: [web]
design:
---

# SC-03 Reset hasła

## Purpose

Domownik, który zapomniał hasła, prosi o link resetu (krok 1), a po kliknięciu linku z maila ustawia nowe hasło (krok 2).

## Layout

Jak SC-01. Dwa widoki pod jednym ekranem:

**Krok 1 — prośba o link**
1. `h1` „Reset hasła”.
2. Tekst: „Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.”
3. Pole „E-mail”.
4. Przycisk główny „Wyślij link”.
5. Link „Wróć do logowania” → SC-01.

**Krok 2 — nowe hasło (wejście z linku w mailu)**
1. `h1` „Ustaw nowe hasło”.
2. Pole „Nowe hasło” z opisem „Co najmniej 8 znaków.” i „Pokaż”.
3. Przycisk główny „Zapisz hasło”.

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| TextField | standardowe | e-mail, `autocomplete="email"` |
| PasswordField | nowe hasło | `autocomplete="new-password"` |
| Button | główny | |
| InlineAlert | sukces, błąd | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | Krok 1: puste pole (albo e-mail z SC-01) | Wejście |
| Loading | Przycisk z wskaźnikiem, nieaktywny | Wysłanie |
| Success — krok 1 | Sukces: „Jeśli konto z adresem {e-mail} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę.” — taki sam bez względu na to, czy konto istnieje | Wysłanie (F-03) |
| Error — limit | Błąd: „Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.” | MC-04 |
| Error — link nieważny | Krok 2 zamiast formularza: „Ten link wygasł albo został już użyty.” + przycisk „Wyślij nowy link” (→ krok 1) | Link użyty lub starszy niż 1 h |
| Error — walidacja | Pod polem: „Hasło musi mieć co najmniej 8 znaków” | Krok 2 |
| Error — sieć | „Brak połączenia. Sprawdź internet i spróbuj ponownie.” | Brak sieci |
| Success — krok 2 | Przejście do SC-01 z komunikatem „Hasło zmienione. Zaloguj się nowym hasłem.” | Hasło zapisane |
| No permission | — (publiczny) | |

## Interactions

- Krok 1 „Wyślij link” → komunikat sukcesu; pole i przycisk zostają (można wysłać ponownie, z limitem).
- Link z maila → krok 2.
- Krok 2 „Zapisz hasło” → SC-01 z komunikatem sukcesu.

## Copy

| Key | Text |
| --- | --- |
| step1.title | Reset hasła |
| step1.intro | Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła. |
| step1.submit | Wyślij link |
| step1.sent | Jeśli konto z adresem {e-mail} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę. |
| back | Wróć do logowania |
| step2.title | Ustaw nowe hasło |
| step2.submit | Zapisz hasło |
| step2.invalid | Ten link wygasł albo został już użyty. |
| step2.resend | Wyślij nowy link |
| mail.subject | Reset hasła — Wspólna lista zakupów |
| mail.body | Ktoś poprosił o reset hasła do Twojego konta. Kliknij link, żeby ustawić nowe hasło (ważny 1 godzinę): {link}. Jeśli to nie Ty, zignoruj tę wiadomość. |

## Accessibility

- Komunikat sukcesu kroku 1 ogłaszany (`role="status"`), fokus zostaje na przycisku.
- Krok 2: fokus startowy na polu hasła; menedżer haseł może wygenerować hasło.
- Sprawdzone z tabelą „Design”: etykiety, błędy z opisem, brak testu poznawczego.
