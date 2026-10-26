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

<Uzupełnia task walking skeleton. Planowane: `apps/api/src/db/schema.ts`, `apps/api/drizzle/` (migracje), repozytoria w `apps/api/src/modules/<moduł>/infra/`.>

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
