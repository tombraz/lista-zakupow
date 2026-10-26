| baza lokalna | `pnpm services:up` (PostgreSQL na `localhost:5442`, Mailpit `localhost:8025`); stop `pnpm services:down` | korzeń repo |
| wygeneruj migrację | `pnpm --filter @lista/api db:generate` (pusta własna: `pnpm --filter @lista/api exec drizzle-kit generate --custom --name=<nazwa>`) | korzeń repo |
| uruchom migracje | `pnpm --filter @lista/api db:migrate` | korzeń repo |
| testy warstwy | `pnpm vitest run --project api` (Testcontainers, wymaga działającego Dockera) | korzeń repo |

Wymaga `DATABASE_URL` w `.env` (skopiuj `.env.example`; lokalnie `postgres://lista:lista@localhost:5442/lista`) albo w zmiennej środowiskowej.

Izolacja testów (decyzja T-001): jeden kontener na przebieg, migracje raz do bazy `lista_template`, każdy plik testów dostaje własną bazę `CREATE DATABASE … TEMPLATE`, przed każdym testem `TRUNCATE … RESTART IDENTITY CASCADE` wszystkich tabel schematu `public`. W pliku testów: `const db = useTestDatabase();`, potem `db.pool`.
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

- `apps/api/src/db/schema.ts` — schemat Drizzle (tabele modułów dochodzą w kolejnych taskach)
- `apps/api/drizzle/` — migracje SQL (`0000_init.sql` startowa) i `meta/_journal.json`
- `apps/api/drizzle.config.ts` — konfiguracja drizzle-kit
- `apps/api/src/db/pool.ts` — pula `pg` (bezczynne połączenia zamykane po 30 s)
- `apps/api/src/db/migrate.ts`, `migrate-cli.ts` — uruchamianie migracji
- `apps/api/test/global-setup.ts`, `test/database.ts` — kontener testowy, baza-szablon, `useTestDatabase()`
- repozytoria: `apps/api/src/modules/<moduł>/infra/` (od pierwszego modułu z tabelami)

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| baza lokalna | | |
| wygeneruj migrację | | |
| uruchom migracje | | |
| testy warstwy | | |

<Uzupełnia task walking skeleton.>

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
