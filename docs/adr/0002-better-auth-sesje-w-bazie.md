# 0002 Uwierzytelnianie: Better Auth z sesjami w PostgreSQL; ciasteczko na web, SecureStore na mobile

- Status: przyjęty (2026-10-26, razem z `docs/architecture/`)
- Data: 2026-10-26

## Kontekst

F-01…F-04: e-mail + hasło, reset hasła linkiem (1 h, jednorazowy), usunięcie konta, to samo konto na web i telefonie. MC-04: ograniczanie prób logowania i resetu. Zasada procesu: żadnej własnej obsługi haseł, tokenów ani kryptografii. MC-03 i wylogowanie wymagają natychmiastowego unieważnienia sesji, także otwartych połączeń na żywo.

## Decyzja

Better Auth w API: e-mail + hasło (scrypt, domyślne parametry), reset hasła, wbudowany rate limit przechowywany w bazie, sesje w tabeli `session` (wygasanie 30 dni bez użycia). Web: ciasteczko `HttpOnly`, `Secure`, `SameSite=Lax`; web i API pod tą samą domeną rejestrowaną; sprawdzanie `Origin`. Mobile: plugin Expo Better Auth z tokenem w `expo-secure-store`. Licznik nieudanych logowań per konto przez hook Better Auth (uzupełnia limit per IP).

## Rozważane alternatywy

- **Clerk / Auth0:** mniej kodu, ale dane kont u dostawcy, koszt po darmowym planie, ekrany i maile trzeba dopasować do designu; kłóci się z „bez dodatkowych podmiotów” (N-02).
- **JWT bez stanu:** trudne natychmiastowe unieważnienie (wylogowanie, usunięcie konta, MC-03).
- **Passport / `@fastify/session` + argon2:** więcej własnego kodu wokół resetu, limitów i sesji.

## Konsekwencje

- Odczyt sesji z bazy przy każdym żądaniu (pomijalne przy skali pilotażu).
- Wymóg tej samej domeny rejestrowanej dla web i API — spełniony jednym originem na Fly (ADR 0006).
- Nazwy tras i opcji Better Auth zależą od wersji; przypięcie wersji i sprawdzenie w dokumentacji w walking skeleton.
- Tabele `user`, `session`, `account`, `verification`, `rate_limit` w kształcie biblioteki, rozszerzone o zgody i potwierdzenie wieku.
