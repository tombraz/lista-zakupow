---
status: approved          # draft | approved
approved: 2026-10-26
---

# Strategia testów

## Poziomy

| Poziom | Narzędzie | Odpowiada za | Nie odpowiada za | Cel szybkości |
| --- | --- | --- | --- | --- |
| Unit | Vitest | czysta logika domenowa: normalizacja `name_key`, reguły ról, schematy zod, mapowanie zdarzeń | I/O, baza, HTTP | cały zestaw < 10 s |
| Integracja (api) | Vitest + Testcontainers (PostgreSQL) + `fastify.inject` i klient WebSocket | trasy HTTP i WS z prawdziwą bazą: walidacja, uprawnienia, limity, duplikaty, transakcje, zdarzenia na żywo, Better Auth | UI | plik < 5 s, całość < 2 min |
| Komponenty web | Vitest + React Testing Library (jsdom) | stany komponentów i ekranów z design systemu (pusty, ładowanie, błąd, offline, duplikat, limit) przy podstawionym API | prawdziwy backend | całość < 1 min |
| Komponenty mobile | Jest (preset Expo) + React Native Testing Library | to samo dla ekranów natywnych | prawdziwy backend, natywne moduły | całość < 1 min |
| E2E web | Playwright + `@axe-core/playwright` | krytyczne ścieżki na prawdziwym api + bazie, viewport telefonu i komputera, skan dostępności każdego stanu ekranu | przypadki brzegowe (są w integracji) | całość < 5 min |
| E2E mobile | Maestro (emulator Androida w CI; iOS ręcznie w QA) | krytyczne ścieżki w aplikacji natywnej | przypadki brzegowe | całość < 10 min |

Pomiar celów (T-021): „całość” to pełny przebieg projektu (`pnpm vitest run --project <projekt>`) z domyślną liczbą workerów; „plik < 5 s” w integracji — czas pliku przy jednym workerze (`--maxWorkers=1`), bo w przebiegu równoległym pliki czekają na wspólny kontener PostgreSQL. Testy komponentów web przechodzą także przy dwóch przebiegach naraz, bez podnoszenia limitów Vitest i Testing Library.

Wyjątki od „plik < 5 s” (integracja; plik sprawdza limit, więc z założenia wysyła dziesiątki żądań):

| Plik | Czas (1 worker, 2026-10-29) | Dlaczego |
| --- | --- | --- |
| `apps/api/test/sign-in-rate-limit.test.ts` | ~7–8 s | każda próba logowania haszuje hasło (scrypt, także dla nieistniejącego konta) |

Mobile używa Jest zamiast Vitest, bo preset Expo i React Native Testing Library działają na Jest; reszta monorepo na Vitest.

## Domyślne miejsca testów (seams)

| Warstwa | Seam | Przykład |
| --- | --- | --- |
| db | migracje + ograniczenia przez repozytorium modułu | drugi `INSERT` pozycji o tym samym `name_key` rzuca naruszenie unikalności |
| backend | HTTP API i WebSocket (`fastify.inject`, klient `ws`) | `POST /api/v1/lists/:id/items` z „mleko” przy istniejącym „Mleko” zwraca 409 `duplicate_item` |
| backend (domena) | funkcje modułu domenowego | `normalizeItemName(" Mleko ")` = `"mleko"` |
| web | ekran / trasa z podstawionym klientem API (MSW) | wysłanie formularza rejestracji bez zgód pokazuje błąd przy polu |
| mobile | ekran z podstawionym klientem API (MSW) | odhaczenie przenosi pozycję do sekcji „Kupione” |

Mocki tylko na granicach systemu: dostawca maili (lokalnie Mailpit, w testach przechwytujący adapter), zegar (wygasanie linków i resetu), losowość tokenów. Nigdy nie mockujemy własnych modułów ani bazy w testach integracyjnych.

## Testy bezpieczeństwa

- Każda trasa dotykająca danych list ma negatywne testy autoryzacji na seamie API: **inny zalogowany domownik** (404), **anonim** (401), **uczestnik przy akcji właściciela** (403) — dla odczytu, zmiany, usunięcia i przeglądu (lista list nie zawiera cudzych list).
- WebSocket: subskrypcja cudzej listy odrzucona; po usunięciu uczestnika kolejne zdarzenie listy do niego nie dociera (MC-03); po wylogowaniu połączenie zamknięte.
- Limity (MC-04, MC-05): testy integracyjne 429 dla logowania (IP i konto), prośby o reset, rejestracji, tworzenia i przyjmowania zaproszeń.
- Zagrożenia `Covered by: task` weryfikują testy nazwane w tasku; `Covered by: ci` — kroki w `pipeline.md` (skan zależności, sekretów, nagłówków, DAST).
- DAST stagingu: OWASP ZAP baseline scan (propozycja; narzędzie, moment i próg ustala `/ci-cd`). Blokuje wydanie na produkcję przy alertach wysokich.

## Testy dostępności

Cel: WCAG 2.2 AA (`docs/design/design-decisions.md`).

| Platforma | Automatyczne sprawdzenie | Poziom | Blokuje merge |
| --- | --- | --- | --- |
| Web | `@axe-core/playwright` — skan każdego stanu ekranu w E2E; `eslint-plugin-jsx-a11y` | E2E, lint | tak |
| Web | zapytania Testing Library po roli i nazwie (`getByRole`) | komponenty | tak |
| Mobile (React Native) | `eslint-plugin-react-native-a11y`; zapytania RNTL po roli i etykiecie | lint, komponenty | tak |
| Android / iOS | brak automatycznego audytu kontrastu i rozmiaru celu dla RN — ręcznie w QA (TalkBack, VoiceOver, największy rozmiar tekstu) | QA | — |

- Testy komponentów i ekranów szukają elementów po roli i nazwie dostępnej, nie po test ID ani klasach CSS.
- `node scripts/design-check.mjs --scan apps/web/src apps/mobile/src --allow generated` (kontrasty, kolory na sztywno) w CI.
- Ręczne sprawdzenia (klawiatura, czytnik ekranu, powiększenie 200 % i 320 px, największy tekst systemowy, ograniczony ruch) są częścią QA każdego taska z UI.

## Dane testowe

- Integracja (decyzja T-001, 2026-10-26): jeden kontener PostgreSQL na przebieg (Testcontainers, `globalSetup`), migracje uruchamiane raz do bazy-szablonu; każdy plik testów dostaje własną bazę `CREATE DATABASE … TEMPLATE` (pliki mogą biec równolegle), a przed każdym testem `DELETE` ze wszystkich tabel aplikacji (bez tabeli migracji). Zmiana T-021: kontener bez trwałości zapisu (`fsync`, `synchronous_commit`, `full_page_writes` = `off`), `DELETE` zamiast `TRUNCATE` (kilka wierszy na test), pula testowa z limitem połączenia 20 s zamiast produkcyjnych 3 s, projekt `api` z `isolate: false` (izolację daje baza pliku, nie świeży import modułów).
- Fabryki w `apps/api/test/factories.ts`: `createUser()`, `signIn(user)` (zwraca ciasteczko), `createList(owner)`, `addMember(list, user)`, `createItem(list, by)`, `createInvitation(list)`. Nazwy i e-maile losowe, bez prawdziwych danych.
- E2E: api uruchomione na czystej bazie w kontenerze; użytkownicy zakładani przez API w `beforeEach`; mail resetu odczytywany z API Mailpit.
- Zegar: wstrzykiwany `clock` w module domenowym (wygasanie zaproszeń 7 dni, resetu 1 h, aktywność dzienna). Sesje i limity Better Auth czytają `Date.now()` wewnątrz biblioteki, więc testy tego obszaru sterują czasem przez `vi.useFakeTimers({ toFake: ["Date"] })` (T-004).
- Limity per IP w testach: fabryki i testy podają losowy `remoteAddress` (`randomIp()` w `apps/api/test/factories.ts`); E2E — losowy `X-Forwarded-For` per test przy `TRUSTED_PROXIES=127.0.0.1` (`apps/web/e2e/fixtures.ts`).
- Testy limitów przypinają wartość z BRD lub threat-model liczbą (`expect(max).toBe(30)`, jak `lists.limit.test.ts`), zanim pętla użyje stałej z `packages/shared`: oczekiwana wartość nie może pochodzić tylko z implementacji, bo zła stała przeszłaby test (przegląd E-01 runda 2, S13).

## Pokrycie E2E

| Ścieżka | Web | Mobile |
| --- | --- | --- |
| J-01 rejestracja, logowanie, wylogowanie | ✔ | ✔ (rejestracja + logowanie) |
| J-01 reset hasła (Mailpit) | ✔ | — (link prowadzi do web) |
| J-02 utworzenie, zmiana nazwy, usunięcie listy | ✔ | ✔ (utworzenie) |
| J-03 dodanie, duplikat, odhaczenie, usuń odhaczone | ✔ | ✔ |
| J-04 link → przyjęcie przez drugie konto → usunięcie uczestnika | ✔ | — |
| J-05 dwie osoby na jednej liście: zmiana widoczna ≤ 5 s; utrata dostępu na żywo | ✔ (dwa konteksty przeglądarki) | — |

Mobile korzysta z tego samego API, więc reguły biznesowe sprawdza integracja; E2E mobile potwierdza tylko, że aplikacja natywna przechodzi główny przepływ.

## Bramki CI (blokują merge)

- [ ] build wszystkich pakietów
- [ ] type check (TypeScript strict) i lint (ESLint, Prettier check)
- [ ] jakość kodu: duplikacja (jscpd), złożoność (ESLint), kierunek zależności (dependency-cruiser) — progi w `CODING_STANDARDS.md`
- [ ] testy unit, integracyjne i komponentów
- [ ] E2E web dla dotkniętych ścieżek ze skanami axe; E2E mobile (Maestro, Android) przy każdym PR zmieniającym `apps/mobile/**` lub `packages/shared/**` (`pipeline.md`)
- [ ] design check (kontrasty, kolory na sztywno)
- [ ] backlog check (`node scripts/backlog-check.mjs`)
- [ ] skan zależności (`pnpm audit`, próg: brak high/critical), CodeQL i secret scanning z push protection (`pipeline.md`)

## Globalna definicja ukończenia

Każdy task dziedziczy:

- [ ] testy napisane najpierw, na uzgodnionych seamach, wszystkie przechodzą
- [ ] kryteria akceptacji zweryfikowane z dowodami
- [ ] brak wartości designu na sztywno; użyte tokeny
- [ ] UI: automatyczne sprawdzenia dostępności przechodzą dla każdego dotkniętego stanu ekranu
- [ ] trasy z danymi list: negatywne testy autoryzacji (inny domownik, anonim, uczestnik przy akcji właściciela)
- [ ] brak sekretów i danych osobowych w kodzie i logach
- [ ] teksty interfejsu po polsku, zgodnie z tabelą „Copy” specyfikacji ekranu

Po przekazaniu `/qa-task` jest osobną bramką: tylko werdykt QA „pass” ustawia task na `done`.

## Zakres QA poza automatyzacją

- Przeglądarki: Chrome i Safari na telefonie (iOS), Chrome lub Firefox na komputerze; szerokość 320 px i 200 % powiększenia.
- Urządzenia: jeden telefon z Androidem i jeden iPhone (development build), największy rozmiar tekstu systemowego, TalkBack i VoiceOver.
- Wspólne zakupy: dwa urządzenia na tej samej liście, przełączanie trybu samolotowego (F-15: komunikat, brak udawanego zapisu, aktualny stan po powrocie).
- Uprawnienia ręcznie: drugie konto próbuje otworzyć cudzą listę po adresie; ponowne użycie wykorzystanego linku.
- Klawiatura (web): arkusz edycji i okna potwierdzenia (pułapka fokusu, Esc, powrót fokusu).
