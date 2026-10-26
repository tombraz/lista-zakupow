# 0006. Hosting: Fly.io (API + web pod jednym adresem), Neon (PostgreSQL), Brevo (mail)

- Status: przyjęty
- Data: 2026-10-26
- Decyduje: Tomasz Brążkiewicz

## Kontekst

Pilotaż testowy dla kilku domowników. Ograniczenia (`docs/architecture/deployment.md`): ≤ 5 €/mies. łącznie, dane osobowe w UE, usługi zarządzane bez łatania systemu, niski lock-in, kopia dzienna przechowywana 7 dni (N-03), alarm mailem. API utrzymuje otwarte połączenia WebSocket na jednej instancji (ADR 0003), więc produkcja nie może usypiać ani zrywać długich połączeń.

**Bez własnej domeny** (decyzja właściciela: projekt testowy). Darmowe adresy dostawców (`*.fly.dev`, `*.workers.dev`) są na liście Public Suffix List, więc web i API pod adresami dwóch dostawców to dwie różne „strony” dla przeglądarki: ciasteczko sesji byłoby ciasteczkiem stron trzecich, które Safari domyślnie blokuje — a domownicy z iPhone'em używają web (ADR 0008). Ciasteczko sesji wymaga, żeby web i API miały ten sam origin (ADR 0002).

## Decyzja

- **API i web:** Fly.io, region `fra`, jeden obraz kontenera. Fastify serwuje API (`/api/v1/*`, WebSocket, `/health*`) i zbudowany SPA (`@fastify/static`, fallback na `index.html` dla pozostałych ścieżek) pod jednym adresem: `lista-prod.fly.dev`, staging `lista-staging.fly.dev`. Produkcja z jedną stale działającą maszyną, staging z automatycznym zatrzymywaniem.
- **Baza:** Neon, Frankfurt; staging na planie Free, produkcja na Launch z oknem przywracania 7 dni (spełnia „kopia dzienna przez 7 dni” jako przywracanie do punktu w czasie).
- **Mail:** Brevo (serwery w UE) z zweryfikowanym adresem nadawcy właściciela, bez własnej domeny. **Monitoring:** UptimeRobot Free.

## Rozważane alternatywy

- **Cloudflare Workers static assets dla web + Fly dla API:** darmowy CDN, ale bez własnej domeny różne „strony” → ciasteczko stron trzecich. Z proxy `/api` i WebSocket przez Worker działałoby, kosztem dodatkowego kodu i drugiego dostawcy. Wybrane pierwotnie przy założeniu własnej domeny.
- **Sesja jako token Bearer w web:** web i API mogą być osobno, ale token dostępny dla JavaScriptu (XSS wykrada sesję) — odrzucone.
- **Northflank Sandbox:** 0 $ i dobre kopie, ale plan darmowy według dostawcy nie jest przeznaczony na produkcję i wymaga karty.
- **Railway Hobby:** 5 $ + nadwyżki, kopie dzienne tylko 6 dni. **Render:** produkcja ponad budżet. **Scaleway Serverless Containers:** limit 60 min na żądanie zrywa WebSocket. **Własny VPS:** łatanie, kopie i monitoring po stronie właściciela.

## Konsekwencje

- Dwóch dostawców infrastruktury (Fly, Neon) + mail i monitoring; jeden artefakt (obraz) zawiera API i web — „build raz” bez konfiguracji per środowisko dla web (adres API względny).
- Bez CORS (ten sam origin); `SameSite=Lax` zostaje. Nagłówki bezpieczeństwa web (CSP, HSTS, `Referrer-Policy`, `frame-ancestors`) ustawia Fastify (`@fastify/helmet`) dla wszystkich odpowiedzi.
- Brak CDN dla plików web — bez znaczenia przy kilku osobach; pliki z hashem w nazwie z długim `Cache-Control`.
- Mail resetu z adresu prywatnego przez Brevo może trafiać do spamu (brak SPF/DKIM własnej domeny); domownicy zostaną uprzedzeni. Czy Brevo wysyła bez własnej domeny — sprawdzić w tasku staging; jeśli nie, wrócić do decyzji.
- Koszt bazy zależy od czasu czuwania; API musi zamykać bezczynne połączenia, a monitoring nie może co 5 min dotykać bazy (`deployment.md`, ryzyka).
- Brak podglądów per PR; security review i UAT na staging.
- Zakup domeny później: web i API dalej pod jednym originem (`app.<domena>` jako certyfikat w Fly), bez zmiany architektury.
