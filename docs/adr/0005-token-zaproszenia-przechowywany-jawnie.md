# 0005 Token zaproszenia przechowywany jawnie w bazie

- Status: przyjęty (2026-10-26, razem z `docs/architecture/`)
- Data: 2026-10-26

## Kontekst

F-11: jednorazowy link ważny 7 dni, unieważnialny. SC-07 pokazuje właścicielowi aktywne linki z przyciskiem „Kopiuj” także po ponownym wejściu na ekran. Typowa praktyka dla tokenów (zapis tylko skrótu) uniemożliwia ponowne pokazanie linku.

## Decyzja

Token 256 bit z CSPRNG (base64url) zapisany jawnie w `invitation.token` (unikalny indeks); zwracany wyłącznie właścicielowi listy. Ochrona: wygasanie 7 dni, jednorazowość, unieważnianie, ograniczony dostęp do bazy i szyfrowane kopie, redakcja tokenu w logach, `Referrer-Policy: no-referrer` (TH-06…TH-08).

## Rozważane alternatywy

- **Tylko skrót SHA-256 tokenu:** bezpieczniejsze przy wycieku bazy, ale link widoczny tylko raz — zmiana designu SC-07 (pokaż raz, potem „utwórz nowy”).
- **Token szyfrowany kluczem serwera:** odczytywalny dla właściciela i bezużyteczny po wycieku samej bazy; dochodzi zarządzanie kluczem i jego rotacja — przesada przy tej skali.

## Konsekwencje

- Wyciek bazy lub kopii ujawnia linki ważne najwyżej 7 dni (ryzyko małe wobec tego, że baza i tak zawiera treść list).
- Przejście na skrót wymaga zmiany SC-07 i migracji (unieważnienie istniejących linków).
