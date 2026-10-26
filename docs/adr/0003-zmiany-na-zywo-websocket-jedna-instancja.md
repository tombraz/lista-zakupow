# 0003 Zmiany na żywo: WebSocket z API, rozsyłanie w pamięci jednej instancji

- Status: przyjęty (2026-10-26, razem z `docs/architecture/`)
- Data: 2026-10-26

## Kontekst

F-14 / N-06: zmiana innej osoby widoczna przy otwartej liście w ≤ 5 s bez odświeżania. MC-03: utrata dostępu działa natychmiast, także dla otwartych połączeń. Klienci: przeglądarka i React Native. Skala: kilku domowników (pilotaż).

## Decyzja

Jedno połączenie WebSocket na klienta (`/api/v1/live`, `@fastify/websocket`), kanały `list:<id>` i `user:<id>`. Dostęp sprawdzany przy subskrypcji; zdarzenia publikowane po zatwierdzeniu transakcji; `revoke` usuwa subskrypcję w tej samej operacji co odebranie dostępu. Rozsyłanie w pamięci procesu — **API działa jako jedna instancja**. Po ponownym połączeniu klient pobiera pełny stan listy.

## Rozważane alternatywy

- **SSE:** prostsze po stronie serwera, ale w React Native wymaga polyfillu; subskrypcje i tak potrzebują osobnych żądań.
- **Odpytywanie co kilka sekund:** proste, ale opóźnienie blisko limitu 5 s i ruch przy każdej otwartej liście.
- **Postgres LISTEN/NOTIFY albo Redis pub/sub:** potrzebne dopiero przy wielu instancjach API; dziś bez wymagania (YAGNI).
- **Zewnętrzny dostawca realtime (Pusher, Ably):** kolejny podmiot przetwarzający dane (N-02), autoryzacja kanałów poza naszą bazą.

## Konsekwencje

- Hosting musi obsługiwać długotrwałe połączenia WebSocket i jedną stałą instancję (warunek dla `/ci-cd`; wyklucza czyste funkcje serverless dla API).
- Restart API zrywa połączenia; klienci łączą się ponownie i pobierają stan (F-15).
- Przejście na wiele instancji = dodanie LISTEN/NOTIFY za interfejsem `LiveHub` (bez zmian w modułach domenowych).
