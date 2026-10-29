---
status: approved          # draft | approved
approved: 2026-10-26
---

# Wdrożenie

Ustalane z właścicielem 2026-10-26 (`/ci-cd`). Stos: `tech-stack.md`. Pipeline: `pipeline.md`. Decyzje trudne do odwrócenia: `docs/adr/0006-hosting-fly-neon.md`, `docs/adr/0007-publiczne-repozytorium.md`, `docs/adr/0008-ios-przez-web-w-pilotazu.md`.

## Ograniczenia

| Ograniczenie | Decyzja |
| --- | --- |
| Budżet | ≤ 5 €/mies. łącznie (staging + produkcja). Darmowe plany dozwolone; staging może usypiać, produkcja nie (otwarte połączenia WebSocket, F-14 / N-06) |
| Lokalizacja danych / zgodność | dane osobowe (konta, listy, kopie) przechowywane w UE (BRD §8b, N-02) |
| Obciążenie (start / rok) | kilku domowników, jedna instancja API (ADR 0003); dane rzędu megabajtów. Bez zmiany w ciągu roku pilotażu |
| Zdolność operacyjna | jeden właściciel, bez dyżurów; usługi zarządzane (bez łatania systemu). Przerwa akceptowalna, utrata danych nie (N-03) |
| Tolerancja lock-in | niska: standardowy PostgreSQL i obraz kontenera (OCI), przenośne między dostawcami |
| Kopie zapasowe | raz dziennie, przechowywane 7 dni, przetestowane odtworzenie (N-03) |
| Alarmy | mail do właściciela przy awarii (N-03) |
| Domena | **brak własnej domeny** (projekt testowy). Web i API pod jednym adresem dostawcy (`*.fly.dev`) — warunek ciasteczka sesji first-party (ADR 0006) |
| Mail | tylko mail resetu hasła (F-03), kilka miesięcznie; nadawca: zweryfikowany adres właściciela w Brevo |
| Dystrybucja mobile | Android: APK z EAS internal distribution (bez sklepu). iOS: domownicy z iPhone'em używają web; aplikacja iOS budowana i testowana, nie dystrybuowana (ADR 0008) |
| Repozytorium | publiczne na GitHub (ADR 0007, zmienione przez właściciela 2026-10-26): ochrona `main`, środowiska z akceptacją, CodeQL i secret scanning bez opłat |
| Środowiska | local, staging, produkcja. Podglądy per PR: nie (Fly i Neon nie dają ich za darmo w jednym kroku; security review i UAT na staging) |

## Wybór hostingu

Ceny w USD, tak jak publikują dostawcy; przeliczenie na € niezweryfikowane. Sprawdzone 2026-10-26.

| Komponent | Dostawca / usługa | Region | Szac. koszt mies. (staging / prod, źródło) | ADR |
| --- | --- | --- | --- | --- |
| Backend (API + WebSocket) i web (SPA) | Fly.io, jeden obraz kontenera (Fastify serwuje API i `apps/web/dist`), 1 maszyna shared-cpu-1x 256 MB | `fra` (Frankfurt) | staging: auto-stop, centy / prod: ~2,2 $ (cena US) + ~15% dla UE ≈ 2,5 $ — szacunek z [docs.fly.io/about/pricing](https://docs.fly.io/about/pricing) | 0006 |
| Baza danych | Neon PostgreSQL | `aws-eu-central-1` (Frankfurt) | staging: Free (1 GB, 100 CU-h) / prod: Launch, 0,106 $/CU-h + 0,20 $/GB-mies. za historię przywracania 7 dni ≈ 1–4 $ przy usypianiu bazy — [neon.com/pricing](https://neon.com/pricing) | 0006 |
| Mobile build / dystrybucja | Expo EAS Free: 15 buildów Android + 15 iOS / mies., APK przez link | — | 0 $ — [expo.dev/pricing](https://expo.dev/pricing) | 0008 |
| Pliki | nie potrzebne (BRD §11) | — | — | — |
| Mail | Brevo (API), 300 maili dziennie za darmo, nadawca: zweryfikowany adres właściciela | serwery w UE (OVH FR/DE, Google Cloud BE) | 0 $ — [brevo.com/features/email-api](https://www.brevo.com/features/email-api/) | 0006 |
| Monitoring dostępności | UptimeRobot Free: 50 monitorów, co 5 min, alarm mailem | — | 0 $ — [uptimerobot.com/pricing](https://uptimerobot.com/pricing/) | — |
| Śledzenie błędów | brak zewnętrznego narzędzia (N-02); logi Fly | — | — | — |

**Razem:** staging ≈ 0 $, produkcja ≈ 3,5–6,5 $/mies. (szacunek). Budżet ≤ 5 € jest dotrzymany tylko, jeśli baza produkcyjna usypia (zob. ryzyka).

## Środowiska

| Środowisko | Cel | URL / cel wdrożenia | Wdrażane kiedy | Dane |
| --- | --- | --- | --- | --- |
| local | development | `localhost` (Docker Compose: Postgres + Mailpit; Vite proxy `/api` do API — ten sam origin jak na serwerze) | — | dane seed |
| staging | security review, DAST i UAT epika przed produkcją | `https://lista-staging.fly.dev` (aplikacja Fly `lista-staging`), Neon projekt `lista-staging` (Free) | po każdym merge do `main` | tylko dane testowe |
| produkcja | domownicy | `https://lista-prod.fly.dev` (aplikacja Fly `lista-prod`), Neon projekt `lista-prod` (Launch) | po akceptacji właściciela (środowisko GitHub `production`) | prawdziwe dane |

Nazwy aplikacji Fly są globalne; jeśli `lista-staging` / `lista-prod` są zajęte, task staging wybiera wolne i aktualizuje ten plik.

Staging (T-010, potwierdzone przez właściciela 2026-10-29): aplikacja Fly `lista-staging` (org `personal`) utworzona przez `scripts/staging-setup.sh`; Neon `lista-staging`, plan Free, AWS Europe Central 1 (Frankfurt), gałąź `production`, połączenie bezpośrednie (bez `-pooler`), `sslmode=require`; ograniczenie dostępu po IP: brak (niedostępne na Free — ochroną jest hasło + TLS).

Pierwsze wdrożenia staging (T-010, 2026-10-29): [przebieg 40882296349](https://github.com/tombraz/lista-zakupow/actions/runs/40882296349) (obraz `:813ad14…`, `release_command` z migracjami, smoke, ZAP — zielone); [przebieg 40882953706](https://github.com/tombraz/lista-zakupow/actions/runs/40882953706) z celowo błędną migracją przerwany na `release_command`, poprzednia wersja działała dalej. Ustalenia:

- **Nazwy aplikacji:** `lista-staging` wolna i użyta (adres `https://lista-staging.fly.dev`); `lista-prod` — sprawdzić w tasku produkcji.
- **Jedna maszyna:** `flyctl deploy` bez `--ha=false` tworzy przy pierwszym wdrożeniu drugą maszynę (wysoka dostępność); hub zmian na żywo jest w pamięci procesu (ADR 0003), więc `scripts/deploy.sh` wdraża z `--ha=false`. Nadmiarową maszynę ze staging usunięto `flyctl scale count 1` (2026-10-29).
- **Limit bezczynności WebSocket na Fly:** proxy Fly zamyka połączenie TCP po 60 s bez ruchu (odpowiedź zespołu Fly, [community.fly.io/t/2373](https://community.fly.io/t/does-the-tls-handler-close-idle-tcp-connections-after-60s/2373), otwarte 2026-10-29). Bicie serca aplikacji (ping co 25 s) mieści się w limicie: połączenie `wss://lista-staging.fly.dev/api/v1/live` trwało 240 s bez zerwania (9 × ping/pong, test 2026-10-29).
- **`TRUSTED_PROXIES`:** proxy Fly łączy się z maszyną z adresów `172.16.x.x` (`remoteAddress` w logach Fly; healthchecki z `172.19.x.x`) i ustawia `X-Forwarded-For` → `TRUSTED_PROXIES = "172.16.0.0/16"` w `apps/api/fly.staging.toml`.
- **Uśpiona baza przy wdrożeniu:** pierwsze połączenie z uśpioną bazą Neon przekraczało 3 s puli API i `release_command` padał; migracje mają własny limit połączenia 30 s (`MIGRATION_CONNECTION_TIMEOUT_MS`).
- **Szyfrowanie w spoczynku (TH-07):** Neon szyfruje dane na dyskach NVMe (XTS-AES-256, sprzętowo) — [neon.com/docs/security/security-overview](https://neon.com/docs/security/security-overview), otwarte 2026-10-29; region projektu `lista-staging`: AWS Europe Central 1 (Frankfurt) — zrzut panelu Neon od właściciela 2026-10-29.

**Warunek przed zamknięciem epiku E-01:** `deploy.yml` ma tymczasowy wyzwalacz `push` dla gałęzi `deploy-test/**` (decyzja właściciela 2026-10-29: pierwsze wdrożenia przed merge do `main`, na którym nie ma jeszcze workflow). Przed zamknięciem epiku wyzwalacz wraca do samego `main` (razem z testem w `scripts/test/deploy-workflow.test.sh`), a gałęzie `deploy-test/*` zostają usunięte. Link zaproszenia i resetu hasła prowadzą do tego samego adresu (SC-08, SC-03).

Mail na staging: Brevo z osobnym kluczem API, ten sam zweryfikowany nadawca.

## Sekrety i dostęp

| Sekret | Używa | Przechowywany w (środowisko) | Rotacja |
| --- | --- | --- | --- |
| `FLY_API_TOKEN` (deploy token jednej aplikacji) | workflow `deploy.yml` | GitHub Environment `staging` / `production` (osobny token na aplikację) | raz w roku i po wycieku |
| `NEON_API_KEY` (gałąź-kopia przed migracją produkcji) | `deploy.yml` | GitHub Environment `production` | raz w roku |
| `DATABASE_URL` | API | sekrety Fly (`fly secrets`) per aplikacja | przy zmianie hasła bazy |
| `BETTER_AUTH_SECRET` | API (sesje) | sekrety Fly per aplikacja | przy podejrzeniu wycieku (wylogowuje wszystkich) |
| `BREVO_API_KEY` | API (mail resetu) | sekrety Fly per aplikacja | raz w roku |
| `EXPO_TOKEN` | `mobile.yml` | sekret repozytorium | raz w roku |

Zmienne API (nie sekrety, T-004): `APP_ORIGIN` — publiczny adres aplikacji (zaufany `Origin`, `Secure` ciasteczka przy `https://`), wymagany — bez niego API nie wystartuje; `TRUSTED_PROXIES` — adresy / CIDR proxy Fly przed API (Fastify `trustProxy`), bez nich limity per IP liczą adres proxy dla wszystkich; na Fly `172.16.0.0/16` (ustalone 2026-10-29, „Środowiska”). Migracje (`db:migrate`) potrzebują tylko `DATABASE_URL`.

OIDC (krótkotrwałe poświadczenia) dla Fly: niezweryfikowane — używamy tokenów o najwęższym zakresie (deploy jednej aplikacji). Wrócić, jeśli dostawca udostępni OIDC.

Kto akceptuje wdrożenia produkcji: Tomasz Brążkiewicz (jedyny wymagany akceptujący środowiska `production`).

## Podsumowanie researchu

Wszystkie strony otwarte 2026-10-26 (subagenci w `/ci-cd`).

**Backend.** Fly.io (prod ~2,5 $, staging z auto-stop, region `fra`, dowolny obraz, `auto_stop_machines = "off"` na produkcji) — wybrany. Drugie miejsce: Northflank Sandbox (0 $, Frankfurt, ale sam dostawca pisze, że plan darmowy „should not be used for production”, wymaga karty). Odrzucone: Render (prod 7 $ za 512 MB + baza → ponad budżet), Railway Hobby (5 $ + nadwyżki), Koyeb (Pro 29 $), Scaleway Serverless Containers (maks. 60 min na żądanie — zrywa WebSocket). Źródła: docs.fly.io/about/pricing, docs.fly.io/reference/regions, docs.fly.io/launch/autostop-autostart, docs.fly.io/launch/continuous-deployment-with-github-actions, northflank.com/pricing, northflank.com/docs/v1/application/billing/pricing-on-northflank, render.com/pricing, render.com/docs/websocket, render.com/docs/free, railway.com/pricing, koyeb.com/pricing, scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/. Niezweryfikowane: OIDC (limit bezczynności WebSocket: 60 s, zob. „Środowiska”).

**Baza.** Neon (Frankfurt, DPA, Free dla staging; Launch z przywracaniem do 7 dni dla produkcji) — wybrany. Drugie miejsce: dodatek Postgres w Northflank (kopie dzienne z dowolną retencją, ale jeden dodatek w planie darmowym). Odrzucone: Render Postgres (darmowa baza wygasa po 30 dniach; 7 dni przywracania tylko w płatnym workspace Pro), Supabase (Free pauzuje i bez kopii; Pro 25 $), Aiven (brak wyboru regionu), Scaleway Managed DB (~11 €), Fly Managed Postgres (38 $), Railway (kopie dzienne 6 dni). Źródła: neon.com/pricing, neon.com/docs/introduction/regions, neon.com/dpa, render.com/docs/postgresql-backups, supabase.com/pricing, aiven.io/pricing, scaleway.com/en/pricing/managed-databases/, docs.railway.com/reference/backups.

**Web.** Pierwotnie wybrany Cloudflare Workers static assets (darmowy, SPA fallback, `_headers`); po decyzji „bez własnej domeny” zastąpiony serwowaniem SPA przez Fastify na Fly (ten sam origin co API — ADR 0006). Inne rozważane: Vercel Hobby („non-commercial personal use only”), Netlify (kredyty; po wyczerpaniu pauzuje projekty), GitHub Pages (brak własnych nagłówków). Źródła: developers.cloudflare.com/workers/static-assets/routing/single-page-application/, developers.cloudflare.com/workers/platform/pricing/, vercel.com/docs/plans/hobby, netlify.com/pricing, docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits.

**Mail.** Brevo (300/dzień, serwery w UE, DPA w regulaminie) — wybrany. Drugie miejsce: Mailjet (6000/mies., GCP Frankfurt/Belgia; logo w stopce na planie darmowym). Odrzucone: Resend (dane konta w USA), Postmark (100/mies.), Amazon SES (sandbox i konfiguracja IAM), Scaleway TEM (300 łącznie). Wysyłka bez własnej domeny (zweryfikowany pojedynczy nadawca): niezweryfikowane — sprawdzić w tasku staging. Źródła: brevo.com/features/email-api/, help.brevo.com (lokalizacja danych), mailjet.com/pricing/, resend.com/docs/dashboard/domains/regions, postmarkapp.com/pricing, aws.amazon.com/ses/pricing/.

**Monitoring.** UptimeRobot Free — wybrany; drugie miejsce Better Stack Free (10 monitorów, „free for personal projects”). Freshping zamknięty (marzec 2026). Źródła: uptimerobot.com/pricing/, betterstack.com/pricing.

**Mobile.** EAS Free: 15 + 15 buildów / mies. (kolejka niskiego priorytetu), EAS Update 1000 MAU. Android: APK z linku. iOS ad hoc wymaga Apple Developer Program (99 USD/rok) — odrzucone na pilotaż (ADR 0008). Źródła: expo.dev/pricing, docs.expo.dev/build/internal-distribution/, developer.apple.com/help/account/membership/program-enrollment/.

**GitHub.** Prywatne repo na planie Free nie ma ochrony gałęzi, środowisk, secret scanning ani CodeQL; repo publiczne ma je bez opłat (ADR 0007). Źródła: docs.github.com/en/get-started/learning-about-github/githubs-plans, docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment, docs.github.com/en/get-started/learning-about-github/about-github-advanced-security.

## Ryzyka

- **Koszt bazy produkcyjnej:** Neon nalicza za czas, gdy baza nie śpi (usypia po 5 min bez połączeń). Gdyby nigdy nie spała: ~182 CU-h × 0,106 $ ≈ 19 $/mies. Środki: pula połączeń API zamyka bezczynne połączenia (`idleTimeoutMillis` ≤ 60 s), healthcheck Fly i UptimeRobot sprawdzają `/health` (bez bazy), `/health/ready` tylko w smoke teście po wdrożeniu; alert kosztowy u dostawcy (zob. `pipeline.md`, koszty). Wrócić po 2 tygodniach pilotażu z faktycznym rachunkiem.
- **Pierwsze żądanie po uśpieniu bazy** czeka na jej wybudzenie (zwykle sekundy, niezweryfikowane) — akceptowalne przy N-03.
- **Mail resetu w spamie:** nadawca bez własnej domeny (brak SPF/DKIM dla domeny nadawcy). Domownicy uprzedzeni; jeśli Brevo odmówi wysyłki z adresu darmowej poczty, wrócić do decyzji (Mailjet, Gmail SMTP albo zakup domeny).
- **Adres `*.fly.dev`:** zmiana dostawcy zmienia adres aplikacji (linki zaproszeń i zapisane adresy przestaną działać); do zaakceptowania w projekcie testowym.
- **Jeden region, jedna maszyna:** awaria Fly `fra` = przerwa (N-03 to dopuszcza).

## Otwarte pytania

- [x] Limit bezczynności WebSocket na Fly i nazwy aplikacji (staging) — rozstrzygnięte 2026-10-29 (T-010, „Środowiska”).
- [ ] Ceny w € — potwierdzić przy pierwszym rachunku. Wysyłka Brevo bez własnej domeny — w E-02 (reset hasła).
