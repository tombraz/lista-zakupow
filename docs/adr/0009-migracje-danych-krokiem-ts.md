# 0009. Migracje danych liczone kodem TS jako krok po migracjach SQL

- Status: przyjęty
- Data: 2026-11-01
- Decyduje: Tomasz Brążkiewicz

## Kontekst

T-060 zmienia `normalizeItemName` (NFKC, usuwanie znaków `Default_Ignorable_Code_Point`), więc `name_key` istniejących pozycji trzeba przeliczyć (AC5). Według ADR 0004 i `layers/db.md` klucz liczy wyłącznie `normalizeItemName` z `packages/shared` („nigdy `lower()` w SQL”), żeby API, web i baza zawsze dawały ten sam wynik. Migracje Drizzle (`apps/api/drizzle/`) to tylko pliki SQL, a `runMigrations` (`apps/api/src/db/migrate.ts`) uruchamia tylko je. Dotąd żadna migracja nie potrzebowała kodu aplikacji.

## Decyzja

Migracje danych, które muszą liczyć wartości kodem z `packages/shared`, są krokami TS uruchamianymi w `runMigrations` **po** migracjach SQL, w tym samym `release_command` / `db:migrate`.

- Tabela `data_migration` (nazwa kroku, czas wykonania) gwarantuje, że każdy krok wykona się dokładnie raz. Tabelę tworzy zwykła migracja SQL.
- Każdy krok to nazwana, eksportowana funkcja (np. `0007_name_key_nfkc`). Działa w jednej transakcji razem z wpisem do `data_migration`, więc kończy się w całości albo wcale.
- Duże tabele krok czyta partiami. Kolizje wynikłe z nowej reguły rozwiązuje deterministycznie: dla `name_key` starsza pozycja (`created_at`, potem `id`) zachowuje klucz, nowsza dostaje `<klucz>#<id>`. Liczbę kolizji krok zapisuje w logu.
- Testy: Testcontainers. Dane wstawiamy w stanie sprzed kroku, potem wywołujemy funkcję kroku. Sprawdzamy, że ponowne uruchomienie niczego nie zmienia.
- Kroki nie mają automatycznego `down`. Notatka w kroku opisuje ręczny powrót (dla `0007`: stary klucz = `trim` + NFC + `toLocaleLowerCase('pl-PL')`). Przed migracją produkcji `deploy.yml` i tak robi gałąź-kopię Neon (`deployment.md`).

## Rozważane alternatywy

- **Czysta migracja SQL** (`normalize(name, NFKC)`, `regexp_replace` z listą zakresów ignorowalnych znaków, `lower(… COLLATE "pl-PL-x-icu")`): nie wymaga nowego mechanizmu, ale łamie zasadę „`name_key` tylko z `packages/shared`”. Na znakach brzegowych wynik może się różnić od `toLocaleLowerCase('pl-PL')`, a taka rozbieżność dałaby fałszywe lub przeoczone duplikaty.
- **Jednorazowy skrypt uruchamiany ręcznie:** nic nie wiąże go z wdrożeniem. Łatwo go pominąć na stagingu lub produkcji i nie da się sprawdzić, czy już został wykonany.
- **Przeliczanie leniwe przy zapisie pozycji:** stare klucze zostałyby w bazie na stałe, a `UNIQUE (list_id, name_key)` porównywałby wartości liczone według dwóch różnych reguł.

## Konsekwencje

- Wdrożenie ma teraz dwa etapy migracji: najpierw SQL, potem kroki TS. Błąd kroku przerywa `release_command` tak samo jak błędna migracja SQL, a poprzednia wersja działa dalej.
- Obraz z `release_command` musi zawierać skompilowany kod `packages/shared` używany przez kroki.
- Krok już zmergowany do `main` jest niezmienny, tak jak migracja SQL (`layers/db.md`). Zmiana reguły oznacza nowy krok.
- Przy pierwszym kroku zaktualizować `layers/db.md` (pliki, polecenia, historia) i `data-model.md` (tabela `data_migration`).
- Wrócić do decyzji, gdy krok na dużej tabeli przestanie mieścić się w limicie czasu `release_command`.
