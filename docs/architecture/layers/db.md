---
layer: db
status: approved          # draft | approved
approved: 2026-10-26
---

# Przewodnik warstwy: db

## Cel

Schemat PostgreSQL, migracje i ograniczenia, które egzekwują reguły biznesowe niezależnie od kodu (unikalność, długości, kaskady). Model: `../data-model.md`.

## Technologia

PostgreSQL, Drizzle ORM + drizzle-kit (`../tech-stack.md`). Tabele Better Auth generowane jego CLI i rozszerzane (ADR 0002).

## Gdzie jest kod

- `apps/api/src/db/schema.ts` — schemat Drizzle (`user`, `session`, `account`, `verification`, `rate_limit`, `sign_in_failure`, `shopping_list`, `list_member`, `item`, `list_daily_activity`, `invitation`; tabele kolejnych modułów dochodzą w taskach); `src/db/uuid.ts` — `uuidv7()` dla kluczy UUID (PostgreSQL 17 nie ma wbudowanego)
- `apps/api/drizzle/` — migracje SQL (`0000_init.sql` startowa, `0001_konta.sql` tabele Better Auth + zgody, `0002_sign_in_failure.sql`, `0003_listy.sql` listy i członkostwa, `0004_pozycje.sql` pozycje z `UNIQUE (list_id, name_key)` i `CHECK` długości, `0005_statystyki.sql` aktywność dzienna z PK `(list_id, day, user_id)` i indeksem `user_id`, `0006_zaproszenia.sql` linki z unikalnym `token`, indeksami `list_id` i `used_by`) i `meta/_journal.json`
- `apps/api/drizzle.config.ts` — konfiguracja drizzle-kit
- `apps/api/src/db/pool.ts` — pula `pg` (bezczynne połączenia zamykane po 30 s)
- `apps/api/src/db/migrate.ts`, `migrate-cli.ts` — uruchamianie migracji
- `apps/api/test/global-setup.ts`, `test/database.ts` — kontener testowy, baza-szablon, `useTestDatabase()`
- repozytoria: `apps/api/src/modules/<moduł>/infra/` (`listy/infra/lists-repository.ts` — w tym limit 50 list z `SELECT … FOR UPDATE` na wierszu `user`, `lockList(tx, listId)` — blokada wiersza `shopping_list` w transakcji innego modułu (eksport z `listy/index.ts`), `insertParticipant` — limit 20 uczestników pod tą blokadą; `pozycje/infra/items-repository.ts` — limit 500 z `SELECT … FOR UPDATE` na wierszu `shopping_list`, duplikat przez `ON CONFLICT (list_id, name_key) DO NOTHING` przy dodaniu i naruszenie `item_list_id_name_key_unique` (23505) przy zmianie nazwy; `statystyki/infra/activity-repository.ts` — licznik odhaczeń `INSERT … ON CONFLICT DO UPDATE SET checks = checks + 1`; `zaproszenia/infra/invitations-repository.ts` — przyjęcie: warunkowy `UPDATE invitation … RETURNING list_id` i `Lists.join` w jednej transakcji, limit tworzenia linków liczony pod `lockList`)

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| baza lokalna | `pnpm services:up` (PostgreSQL na `localhost:5442`, Mailpit `localhost:8025`); stop `pnpm services:down` | korzeń repo |
| wygeneruj migrację | `pnpm --filter @lista/api db:generate` (pusta własna: `pnpm --filter @lista/api exec drizzle-kit generate --custom --name=<nazwa>`) | korzeń repo |
| uruchom migracje | `pnpm --filter @lista/api db:migrate` | korzeń repo |
| testy warstwy | `pnpm vitest run --project api` (Testcontainers, wymaga działającego Dockera) | korzeń repo |

Wymaga `DATABASE_URL` w `.env` (skopiuj `.env.example`; lokalnie `postgres://lista:lista@localhost:5442/lista`) albo w zmiennej środowiskowej.

Izolacja testów (decyzja T-001): jeden kontener na przebieg, migracje raz do bazy `lista_template`, każdy plik testów dostaje własną bazę `CREATE DATABASE … TEMPLATE`, przed każdym testem `TRUNCATE … RESTART IDENTITY CASCADE` wszystkich tabel schematu `public`. W pliku testów: `const db = useTestDatabase();`, potem `db.pool`.

## Testy w tej warstwie

- **Seam:** repozytorium modułu albo trasa API (testy integracyjne backendu); osobne testy tylko dla ograniczeń, których API nie pokazuje wprost.
- **Narzędzia:** Vitest + Testcontainers (prawdziwy PostgreSQL), wszystkie migracje na czystej bazie.
- **Dane testowe:** fabryki z `apps/api/test/factories.ts`; reset przez bazę-szablon albo `TRUNCATE … CASCADE`.
- **Mocki:** brak — baza zawsze prawdziwa.

## Zasady bezpieczeństwa

- Tylko zapytania parametryzowane przez Drizzle; `sql.raw` z danymi użytkownika zakazany (TH-20).
- Każde zapytanie o pozycje, członkostwa i zaproszenia zawiera `list_id` z już sprawdzonego dostępu, nigdy samo `id` z żądania (TH-01).
- Ograniczenia `CHECK` długości dublują zod celowo: baza jest ostatnią linią obrony (TH-13, TH-20).
- Kaskady i `SET NULL` zgodne z `data-model.md`; zmiana kaskady wymaga testu F-04 (TH-18).

## Konwencje

- Nazwy tabel i kolumn po angielsku w `snake_case`; mapowanie na słownik BRD w `data-model.md`.
- Każda zmiana schematu = nowa migracja; nigdy edycja migracji już zmergowanej do `main`.
- Limity (50 / 500 / 20) liczone w transakcji z `SELECT … FOR UPDATE` na wierszu rodzica, nie przez `COUNT` bez blokady.
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
| 2026-10-28 | T-008: `invitation`, migracja `0006_zaproszenia`, `lockList`. |
| 2026-10-28 | T-007: `list_daily_activity`, migracja `0005_statystyki`. |
| 2026-10-28 | T-006: `item`, migracja `0004_pozycje`. |
| 2026-10-28 | T-005: `shopping_list`, `list_member`, migracja `0003_listy`, `uuidv7()`. |
| 2026-10-27 | T-004: tabele kont w „Gdzie jest kod”. |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
