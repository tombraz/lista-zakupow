---
id: SC-07
title: Uczestnicy i zaproszenia
requirements: [F-11, F-13]
journeys: [J-04]
platforms: [web]
design:
---

# SC-07 Uczestnicy i zaproszenia

## Purpose

Właściciel i uczestnicy widzą, kto ma dostęp do listy. Właściciel zaprasza nowe osoby linkiem, unieważnia niewykorzystane linki i usuwa uczestników. Uczestnik może opuścić listę.

## Layout

Kierunek B: `prototypes/directions.html?variant=B`, ramka „SC-07 Uczestnicy i zaproszenia”.
1. AppBar: „Wstecz” → SC-06, tytuł „Uczestnicy”.
2. OfflineBanner (gdy brak połączenia).
3. Sekcja „Na liście (N z 20)”: wiersze osób — awatar, imię, pod spodem „właściciel” / „Ty” / e-mail (e-mail tylko w widoku właściciela), „Usuń” (tylko właściciel, przy uczestnikach).
4. **Właściciel:** sekcja „Zaproszenia”: aktywne linki (InviteLinkBox: „Link jednorazowy, ważny do <data>”, link, „Kopiuj”, „Unieważnij”), pod nimi przycisk główny „Utwórz link zaproszenia” i jedno zdanie: „Link działa dla jednej osoby przez 7 dni. Wyślij go SMS-em lub komunikatorem.”
5. **Uczestnik:** przycisk niebezpieczny-tekstowy „Opuść listę”.

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| AppBar | z „Wstecz” | |
| Avatar | 32 px | |
| Button | główny, niebezpieczny-tekstowy | |
| InviteLinkBox | | jedno pole na każdy aktywny link |
| ConfirmDialog | usuń uczestnika, opuść listę | |
| Toast | | „Link skopiowany” |
| InlineAlert | ostrzeżenie, błąd | |
| OfflineBanner | | |
| Loading | szkielet wierszy | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | Właściciel bez uczestników: tylko jego wiersz + „Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi.” | Lista nieudostępniona |
| Loading | Szkielet 3 wierszy | Wejście |
| Error — wczytanie | „Nie udało się wczytać uczestników.” + „Spróbuj ponownie” | Błąd serwera |
| Error — limit | Ostrzeżenie: „Lista ma 20 uczestników — to limit. Usuń kogoś, żeby zaprosić nową osobę.”; „Utwórz link zaproszenia” nieaktywny | F-12 |
| Error — kopiowanie | Gdy schowek niedostępny: link zaznaczony w polu + „Skopiuj link ręcznie.” | Brak uprawnień przeglądarki |
| Offline | OfflineBanner; przyciski nieaktywne | F-15 |
| Success | Lista osób i (właściciel) aktywnych linków; nowy link pojawia się na górze sekcji „Zaproszenia” | |
| No permission | Jak SC-06 (MC-01); odebranie dostępu w trakcie → SC-05 z komunikatem (MC-03) | |

## Interactions

- „Utwórz link zaproszenia” → nowy InviteLinkBox, fokus na „Kopiuj”.
- „Kopiuj” → link w schowku, Toast „Link skopiowany”.
- „Unieważnij” → link znika od razu (bez potwierdzenia — można utworzyć nowy), komunikat `polite` „Link unieważniony”.
- „Usuń” przy uczestniku → ConfirmDialog „Usunąć {imię} z listy? Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną.” → usunięcie (F-13).
- „Opuść listę” → ConfirmDialog „Opuścić listę „<nazwa>”? Żeby wrócić, potrzebujesz nowego zaproszenia.” → SC-05.
- Nowy uczestnik dołącza → pojawia się w ≤ 5 s; wykorzystany link znika z sekcji „Zaproszenia”.

## Copy

| Key | Text |
| --- | --- |
| title | Uczestnicy |
| members | Na liście ({n} z 20) |
| owner | właściciel |
| you | Ty |
| remove | Usuń (nazwa dostępna: „Usuń {imię} z listy”) |
| remove.confirm | Usunąć {imię} z listy? Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną. (złożony z części; T-111) |
| remove.error | Nie udało się usunąć. Spróbuj ponownie. (w ConfirmDialog; zatwierdzone 2026-11-01, T-058) |
| invites | Zaproszenia |
| invite.create | Utwórz link zaproszenia |
| invite.hint | Link działa dla jednej osoby przez 7 dni. Wyślij go SMS-em lub komunikatorem. |
| invite.validUntil | Link jednorazowy, ważny do {data} |
| invite.copy | Kopiuj |
| invite.copied | Link skopiowany |
| invite.revoke | Unieważnij |
| invite.revoked | Link unieważniony |
| leave | Opuść listę |
| leave.confirm | Opuścić listę „{nazwa}”? Żeby wrócić, potrzebujesz nowego zaproszenia. (złożony z części; T-111) |
| leave.error | Nie udało się opuścić listy. Spróbuj ponownie. (zatwierdzone 2026-11-04, T-080) |
| leave.confirm.question | Opuścić listę „{nazwa}”? (część `leave.confirm`; T-103) |
| leave.confirm.consequence | Żeby wrócić, potrzebujesz nowego zaproszenia. (część `leave.confirm`; T-103) |
| leave.confirm.cta | Opuść (przycisk akcji w oknie; zatwierdzone 2026-11-06, T-103) |
| empty | Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi. |
| limit | Lista ma 20 uczestników — to limit. Usuń kogoś, żeby zaprosić nową osobę. |
| back | Wstecz (z Layout/States, T-100) |
| loadError | Nie udało się wczytać uczestników. (z Layout/States, T-100) |
| noAccess | Nie masz dostępu do tej listy. (z States: jak SC-06, T-100) |
| backToLists | Wróć do moich list (z States: jak SC-06, T-100) |
| remove.label | Usuń {imię} z listy (nazwa dostępna; z Copy `remove`, T-100) |
| remove.confirm.question | Usunąć {imię} z listy? (część `remove.confirm`; z Interactions, T-100) |
| remove.confirm.consequence | Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną. (część `remove.confirm`; z Interactions, T-100) |
| cancel | Anuluj (z design-system ConfirmDialog, T-100) |
| invite.copyManually | Skopiuj link ręcznie. (z Layout/States, T-100) |
| invite.rateLimit | Utworzono zbyt wiele linków. Spróbuj ponownie za godzinę. (zatwierdzone 2026-11-05, T-100) |
| invite.createError | Nie udało się utworzyć linku. Spróbuj ponownie. (zatwierdzone 2026-11-05, T-100) |
| invite.revokeError | Nie udało się unieważnić linku. Spróbuj ponownie. (zatwierdzone 2026-11-05, T-100) |
| error.network | Brak połączenia. Sprawdź internet i spróbuj ponownie. (z States SC-01, T-100) |

## Accessibility

- `h1` „Uczestnicy”, `h2` „Na liście”, „Zaproszenia”.
- Po usunięciu uczestnika fokus na następnym wierszu (albo na nagłówku sekcji); po unieważnieniu linku — na „Utwórz link zaproszenia”, a przy pełnej liście (przycisk nieaktywny) na ostrzeżeniu o limicie (T-025).
- Toast i komunikaty `role="status"`; nic nie znika z akcją, której nie da się powtórzyć.
- Nazwy dostępne przycisków „Usuń” zawierają imię.
- Sprawdzone z tabelą „Design”.
