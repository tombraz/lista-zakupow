---
layer: db
paths: [apps/api/drizzle/, apps/api/src/db/, apps/api/test/]   # katalogi warstwy: nowy test w nich wymaga wiersza w „Historia zmian” (backlog-check, T-117)
status: approved          # draft | approved
approved: 2026-10-26
---

# Przewodnik warstwy: db

## Cel

Schemat PostgreSQL, migracje i ograniczenia, które egzekwują reguły biznesowe niezależnie od kodu (unikalność, długości, kaskady). Model: `../data-model.md`.

## Technologia

PostgreSQL, Drizzle ORM + drizzle-kit (`../tech-stack.md`). Tabele Better Auth generowane jego CLI i rozszerzane (ADR 0002).

## Gdzie jest kod

- `apps/api/src/db/schema.ts` — schemat Drizzle (`user`, `session`, `account`, `verification`, `rate_limit`, `sign_in_failure`, `mail_quota` (T-120), `shopping_list`, `list_member`, `item`, `list_daily_activity`, `invitation`, `data_migration`, `cleanup_run` — jeden wiersz z początkiem ostatniego sprzątania, T-064; tabele kolejnych modułów dochodzą w taskach); `src/db/uuid.ts` — `uuidv7()` dla kluczy UUID (PostgreSQL 17 nie ma wbudowanego)
- `apps/api/drizzle/` — migracje SQL (`0000_init.sql` startowa, `0001_konta.sql` tabele Better Auth + zgody, `0002_sign_in_failure.sql`, `0003_listy.sql` listy i członkostwa, `0004_pozycje.sql` pozycje z `UNIQUE (list_id, name_key)` i `CHECK` długości, `0005_statystyki.sql` aktywność dzienna z PK `(list_id, day, user_id)` i indeksem `user_id`, `0006_zaproszenia.sql` linki z unikalnym `token`, indeksami `list_id` i `used_by`, `0007_data_migration.sql` tabela wykonanych kroków danych, `0008_sprzatanie.sql` tabela `cleanup_run` z `CHECK (id = 1)`, `0009_mail_quota.sql` dobowe liczniki maili resetu) i `meta/_journal.json`
- `apps/api/drizzle.config.ts` — konfiguracja drizzle-kit
- `apps/api/src/db/pool.ts` — pula `pg` (bezczynne połączenia zamykane po 30 s)
- `apps/api/src/db/migrate.ts`, `migrate-cli.ts` — uruchamianie migracji: SQL, potem kroki danych w TS
- `apps/api/src/db/data-migrations/` — kroki migracji danych liczone kodem z `packages/shared` (`index.ts`: lista kroków, każdy raz dzięki wierszowi `data_migration` w tej samej transakcji; `0007-name-key-nfkc.ts` — przeliczenie `item.name_key`, T-060); test `apps/api/test/name-key-migration.test.ts`
- `apps/api/scripts/metrics.sql` — zapytania miar sukcesu (tylko `SELECT`, definicje w komentarzu pliku; test `apps/api/test/metrics.test.ts`, T-065)
- `apps/api/src/db/retention.ts` — usuwanie wierszy po terminie partiami po 1000 (`ctid`), reguły terminów w `modules/<moduł>/infra/retention.ts` (T-064)
- `apps/api/test/global-setup.ts`, `test/database.ts` — kontener testowy, baza-szablon, `useTestDatabase()`
- repozytoria: `apps/api/src/modules/<moduł>/infra/` (`listy/infra/lists-repository.ts` — w tym limit 50 list z `SELECT … FOR UPDATE` na wierszu `user`, `lockList(tx, listId)` — blokada wiersza `shopping_list` w transakcji innego modułu (eksport z `listy/index.ts`), `insertParticipant` — limit 20 uczestników pod tą blokadą, `lockListFor(tx, listId, userId)` — `user FOR KEY SHARE`, `lockList`, członkostwo `FOR SHARE`: dostęp sprawdzony w transakcji zapisu (T-119); `pozycje/infra/items-repository.ts` — limit 500 z `SELECT … FOR UPDATE` na wierszu `shopping_list`, duplikat przez `ON CONFLICT (list_id, name_key) DO NOTHING` przy dodaniu i naruszenie `item_list_id_name_key_unique` (23505) przy zmianie nazwy; `statystyki/infra/activity-repository.ts` — licznik odhaczeń `INSERT … ON CONFLICT DO UPDATE SET checks = checks + 1`; `zaproszenia/infra/invitations-repository.ts` — przyjęcie: warunkowy `UPDATE invitation … RETURNING list_id` i `Lists.join` w jednej transakcji, limit tworzenia linków liczony pod `lockList`)

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| baza lokalna | `pnpm services:up` (PostgreSQL na `localhost:5442`, Mailpit `localhost:8025`); stop `pnpm services:down` | korzeń repo |
| wygeneruj migrację | `pnpm --filter @lista/api db:generate` (pusta własna: `pnpm --filter @lista/api exec drizzle-kit generate --custom --name=<nazwa>`) | korzeń repo |
| uruchom migracje | `pnpm --filter @lista/api db:migrate` | korzeń repo |
| testy warstwy | `pnpm vitest run --project api` (Testcontainers, wymaga działającego Dockera) | korzeń repo |
| miary sukcesu (BRD §10, T-065) | lokalnie: `psql "$DATABASE_URL" -f apps/api/scripts/metrics.sql` (bez lokalnego psql: `docker exec -i lista-zakupow-postgres-1 psql -U lista -d lista -f - < apps/api/scripts/metrics.sql`); produkcja: rolą tylko do odczytu Neon (albo z `PGOPTIONS='-c default_transaction_read_only=on'`) i jej connection string zamiast `$DATABASE_URL`, lub treść pliku wklejona w Neon SQL Editor; wynik: tydzień + liczby, bez danych osobowych | korzeń repo |

Wymaga `DATABASE_URL` w `.env` (skopiuj `.env.example`; lokalnie `postgres://lista:lista@localhost:5442/lista`) albo w zmiennej środowiskowej.

Izolacja testów (decyzja T-001): jeden kontener na przebieg, migracje raz do bazy `lista_template`, każdy plik testów dostaje własną bazę `CREATE DATABASE … TEMPLATE`, przed każdym testem `DELETE` ze wszystkich tabel schematu `public` (z `session_replication_role = replica`, więc bez kolejności kluczy obcych; `TRUNCATE` kosztował ~0,4 s na test, T-021). Schemat nie ma sekwencji; nowa tabela z sekwencją wymaga jej restartu w `apps/api/test/database.ts`. W pliku testów: `const db = useTestDatabase();`, potem `db.pool`.

## Testy w tej warstwie

- **Seam:** repozytorium modułu albo trasa API (testy integracyjne backendu); osobne testy tylko dla ograniczeń, których API nie pokazuje wprost.
- **Narzędzia:** Vitest + Testcontainers (prawdziwy PostgreSQL), wszystkie migracje na czystej bazie.
- **Dane testowe:** fabryki z `apps/api/test/factories.ts`; reset przez bazę-szablon i `DELETE` przed każdym testem; dziesiątki wierszy (testy limitów) jednym `INSERT … SELECT generate_series`, nie w pętli.
- **Mocki:** brak — baza zawsze prawdziwa.

## Zasady bezpieczeństwa

- Tylko zapytania parametryzowane przez Drizzle; `sql.raw` z danymi użytkownika zakazany (TH-20). Wyjątek: kroki migracji danych (`src/db/data-migrations/`, ADR 0009) działają na `PoolClient` z `pg` w transakcji kroku i używają surowego `client.query` — zawsze z parametrami `$n` dla wartości; w tekst zapytania wolno wstawić tylko stałe z kodu (np. nazwę ograniczenia), nigdy dane z bazy ani z żądania.
- Każde zapytanie o pozycje, członkostwa i zaproszenia zawiera `list_id` z już sprawdzonego dostępu, nigdy samo `id` z żądania (TH-01).
- Ograniczenia `CHECK` długości dublują zod celowo: baza jest ostatnią linią obrony (TH-13, TH-20).
- Kaskady i `SET NULL` zgodne z `data-model.md`; zmiana kaskady wymaga testu F-04 (TH-18).

## Konwencje

- Nazwy tabel i kolumn po angielsku w `snake_case`; mapowanie na słownik BRD w `data-model.md`.
- Każda zmiana schematu = nowa migracja; nigdy edycja migracji już zmergowanej do `main`.
- Limity (50 / 500 / 20) liczone w transakcji z `SELECT … FOR UPDATE` na wierszu rodzica, nie przez `COUNT` bez blokady.
- Kolejność blokad w transakcjach: wiersz `user`, potem `shopping_list`, potem `list_member`, potem `item`. Usunięcie konta blokuje `user` jako pierwszy (`konta/infra/users.ts`), zapis pozycji też (`lockListFor`); odwrotna kolejność kończy się zakleszczeniem i 500 (QA T-119).
- `name_key` liczone tylko funkcją z `packages/shared`; nigdy `lower()` w SQL (różne reguły dla polskich znaków).
- Znaczniki czasu: `timestamptz`, ustawiane przez wstrzykiwany zegar w kodzie domeny, gdy test musi nimi sterować.

## Pułapki

<Rośnie z ustaleniami QA.>

## Skille i źródła

- `postgres-best-practices:supabase-postgres-best-practices` — przed każdą zmianą schematu, indeksu lub migracji.
- Dokumentacja Drizzle (drizzle-kit, transakcje, `for("update")`).

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-11-04 | T-081: „Zasady bezpieczeństwa”: wyjątek dla surowych zapytań `pg` w krokach migracji danych (ADR 0009). |
| 2026-11-02 | T-064: `cleanup_run`, migracja `0008_sprzatanie`, `db/retention.ts`. |
| 2026-10-29 | T-021: izolacja testów — `DELETE` zamiast `TRUNCATE`, dane testów limitów jednym `INSERT … SELECT`. |
| 2026-10-28 | T-008: `invitation`, migracja `0006_zaproszenia`, `lockList`. |
| 2026-10-28 | T-007: `list_daily_activity`, migracja `0005_statystyki`. |
| 2026-10-28 | T-006: `item`, migracja `0004_pozycje`. |
| 2026-10-28 | T-005: `shopping_list`, `list_member`, migracja `0003_listy`, `uuidv7()`. |
| 2026-10-27 | T-004: tabele kont w „Gdzie jest kod”. |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
| 2026-11-10 | T-117: frontmatter `paths:` — katalogi warstwy; nowy plik testu w nich wymaga wiersza zadania w tej historii (`backlog-check`). |
| 2026-11-13 | T-119: „Konwencje”: kolejność blokad `user` → `shopping_list` → `list_member` → `item`; `lockListFor` w repozytoriach. |
| 2026-11-13 | T-120: tabela `mail_quota` (migracja `0009_mail_quota.sql`) — dobowe liczniki maili resetu poza `rate_limit`, bo Better Auth kasuje tam wiersze starsze niż 1 h; sprzątanie po 24 h. |
