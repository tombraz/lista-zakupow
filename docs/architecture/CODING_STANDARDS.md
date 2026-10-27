---
status: approved          # draft | approved
approved: 2026-10-26
---

# Standardy kodu

Dotyczą każdej warstwy. Zasady specyficzne dla warstwy są w `layers/<warstwa>.md`.

## 1. Sprawdzane przez narzędzia (CI blokuje merge)

Konfigurowane w tasku walking skeleton; progi startowe, które szkielet przechodzi z zapasem, potem zaostrzane. Zmiana progu wymaga wpisu tutaj.

| Sprawdzenie | Narzędzie | Próg / reguła | Zakres |
| --- | --- | --- | --- |
| Formatowanie | Prettier (`prettier --check`) | konfiguracja domyślna + `printWidth: 100` | kod i konfiguracja (wyłączenia w `.prettierignore`: `docs/`, `.claude/`, `README.md`, pliki generowane i lockfile, skrypty z pipeline'u `scripts/backlog-check.mjs`, `scripts/design-check.mjs`) |
| Lint | ESLint (flat config), `typescript-eslint` strict-type-checked | brak błędów i ostrzeżeń (`--max-warnings 0`) | całe repo |
| Złożoność i rozmiar | ESLint core | `complexity` ≤ 10, `max-lines-per-function` ≤ 60 (bez pustych i komentarzy; komponenty React ≤ 80), `max-params` ≤ 4, `max-depth` ≤ 3, `max-lines` ≤ 300 na plik | kod źródłowy (bez testów) |
| Duplikacja | jscpd | ≤ 3 % duplikacji, minimalny blok 50 tokenów | `apps/*/src`, `packages/*/src` |
| Kierunek zależności | dependency-cruiser | `modules/*/domain` nie importuje `fastify`, `drizzle-orm`, `ws`, `better-auth` ani `*/http`, `*/infra`; moduły nie importują wnętrza innych modułów (tylko ich `index.ts`); `packages/shared` nie importuje aplikacji; brak cykli | `apps/api`, `packages` |
| Typy | TypeScript | `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes` | całe repo |
| Dostępność (lint) | `eslint-plugin-jsx-a11y` (recommended, strict), `eslint-plugin-react-native-a11y` | brak błędów | `apps/web`, `apps/mobile` |
| Bezpieczne wzorce | ESLint `no-restricted-syntax` / `react/no-danger` | zakaz `dangerouslySetInnerHTML`, `sql.raw`, `eval`, `localStorage` dla sesji | całe repo |
| Kolory na sztywno, kontrasty | `node scripts/design-check.mjs --scan apps/web/src apps/mobile/src --allow generated` | 0 błędów | UI |

Zmiany: 2026-10-27 (T-001, zatwierdził właściciel) — zakres Prettiera z „całe repo” na „kod i konfiguracja” (wyłączenia jak w tabeli).

## 2. Zasady wymagające oceny

**Nazwy.** Pojęcia domenowe ze słownika BRD, po angielsku w kodzie, jedno tłumaczenie na pojęcie: domownik `User`, lista `ShoppingList`, pozycja `Item`, właściciel `owner`, uczestnik `participant`, link zaproszenia `Invitation`, odhaczenie `check` / `checked`. Nazwy modułów API po polsku (`konta`, `listy`, `pozycje`, `zaproszenia`, `na-zywo`, `statystyki`), jak w `architecture.md`. Teksty interfejsu po polsku z tabeli „Copy”.

**Granice modułów.** Moduł posiada swoje tabele; inny moduł korzysta z niego przez funkcje z `index.ts`, nie przez jego tabele. Dostęp do listy sprawdza wyłącznie `listy.requireListAccess`. Rozsyłanie zdarzeń wyłącznie przez `na-zywo.publish` / `revoke`.

**Obsługa błędów.** Błędy domenowe to typowane wyjątki z `code` z `packages/shared`; mapuje je jeden handler HTTP. Nie łapiemy wyjątków po to, żeby je zalogować i rzucić dalej. Klient mapuje `code` na tekst w jednym miejscu. Nieoczekiwany błąd: 500 z `requestId`, szczegóły tylko w logu.

**Jedna odpowiedzialność.** Pytanie kontrolne: „jakie dwie różne zmiany wymagań wymusiłyby edycję tego miejsca?”. Jeśli dwie — podziel. Trasa: walidacja, dostęp, wywołanie domeny, mapowanie. Komponent: renderuje; dane i reguły w hookach.

**Odwrócenie zależności na granicach systemu.** Domena definiuje interfejsy, których potrzebuje (repozytorium, `LiveHub`, `Clock`, `Mailer`); adaptery w `infra` je implementują. To też jedyne miejsca, które testy mogą podstawić.

**DRY = jedno miejsce na każdą wiedzę.** Limity, długości, kody błędów, normalizacja nazwy pozycji, kształty odpowiedzi: tylko w `packages/shared`. Dwa podobne fragmenty, które zmieniają się z różnych powodów (np. ekran web i ekran mobile), to nie duplikacja. Wyodrębniamy przy trzecim prawdziwym powtórzeniu tej samej wiedzy.

**Bez nadmiaru (YAGNI).** Zakazane bez drugiego realnego przypadku: interfejs z jedną implementacją poza granicami systemu, fabryki, konfiguracja wartości, których nikt nie zmienia, warstwa „na później”, wspólna funkcja z flagami dla każdego wywołującego. Nie dodajemy kolejek, cache, i18n, feature flag ani wielu instancji API (ADR 0003).

**Komentarze.** Tylko „dlaczego”, nigdy „co”. Odniesienie do wymagania (`// F-09`) przy regule biznesowej, która bez niego wygląda dziwnie.
