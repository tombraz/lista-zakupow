---
id: T-024
title: "Spóźniona odpowiedź na dodanie pozycji nie nadpisuje nowszej wersji ani nie przywraca usuniętej"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07, F-14]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-009, T-017]
---

# T-024 Spóźniona odpowiedź na dodanie pozycji nie nadpisuje nowszej wersji ani nie przywraca usuniętej

## Report

- **Actual:** `useAddItem.added` (`apps/web/src/screens/SC-06-lista/useAddItem.ts`) wstawia odpowiedź `POST …/items` do cache bez porównania `updatedAt` (`isNewer` z `itemsCache.ts`, T-017). Gdy przed spóźnioną odpowiedzią przyjdzie na żywo zdarzenie własnego dodania, a po nim zmiana innej osoby (`item.upserted` z nowszym `updatedAt`) albo usunięcie (`item.deleted`), odpowiedź nadpisuje nowszą wersję albo przywraca usuniętą pozycję.
- **Expected:** Odpowiedź na dodanie przyjmowana jak każda wersja pozycji: tylko, gdy w cache nie ma nowszej; pozycja usunięta na żywo nie wraca (F-14: usunięcie wygrywa) — source: `docs/architecture/api.md` (zdarzenia, porównanie `updatedAt`), T-017
- **Steps to reproduce:**
  1. Test komponentu SC-06: `POST` z MSW najpierw wysyła WS `item.upserted` (własne dodanie), potem `item.upserted` z nowszym `updatedAt` (Tomek), potem odpowiada pierwotną wersją.
  2. Po odpowiedzi SC-06 pokazuje wersję z odpowiedzi zamiast wersji Tomka.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (po T-017).
- **Evidence:** T-017, QA round 1, znalezisko minor.

## Acceptance criteria

- [ ] AC1: Given zdarzenia WS własnego dodania i nowszej zmiany innej osoby przed odpowiedzią `POST`, when przyjdzie odpowiedź, then SC-06 pokazuje nowszą wersję. — verified by: test komponentu SC-06 (podstawiony klient WS)
- [ ] AC2: Given zdarzenia WS własnego dodania i `item.deleted` przed odpowiedzią `POST`, when przyjdzie odpowiedź, then pozycji nie ma na liście. — verified by: test komponentu SC-06
- [ ] AC3: No regression in: dodanie pozycji (T-006, ogłoszenie „Dodano …”, czyszczenie pól), ponowienie z tym samym `id` (AC6 T-006), J-05.

## TDD plan

**Seam:** cache SC-06 (`useAddItem` / `itemsCache`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `ListScreen.live.test.tsx` › keeps Tomek's newer edit of a new item when the response to adding it comes later | komponent | Vitest + RTL + MSW, podstawiony klient WS, `heldResponse` | AC1, AC3 (ogłoszenie „Dodano …”) |
| 2 | `ListScreen.live.test.tsx` › does not bring back a new item deleted live before the response to adding it | komponent | Vitest + RTL + MSW, podstawiony klient WS, `heldResponse` | AC2, AC3 |

**Run:** `pnpm --filter @lista/web test`

## QA plan

- **Regression:** dodanie pozycji, ponowienie po zerwanym połączeniu, J-05 (zmiany na żywo)
- **Edge cases:** odpowiedź z tym samym `updatedAt` co własne zdarzenie WS (cache bez zmian, ogłoszenie i czyszczenie pól działają); `items.cleared` przed odpowiedzią na dodanie (pozycja nie wraca); dodanie bez zdarzenia WS (zwykła ścieżka, pozycja na górze listy); ponowne połączenie (pełny stan listy z API)
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

`useAddItem.added` (od T-006) wstawiał odpowiedź `POST` do cache własnym `updateItems`, z pominięciem reguły api.md „tylko nowsza wersja” (`isNewer`), którą T-017 wprowadził tylko dla `replaceItem` i zdarzeń WS (`upsertNewer` w `useLiveList`). Do tego cache nie pamiętał pozycji usuniętych na żywo, więc spóźniona odpowiedź na dodanie nie mogła odróżnić „jeszcze nie ma” od „już usunięta” i ją przywracała.

**Dlaczego testy nie złapały:** testy dodania (`ListScreen.add.test.tsx`) nie używały klienta WS, a T-017 dodał testy „WS przed odpowiedzią” tylko dla edycji i odhaczenia; dodanie zostało poza jego AC (znalezisko minor QA round 1).

**Inne wystąpienia:** `replaceItem` (edycja, odhaczenie) mapuje tylko istniejące wiersze — nie przywraca usuniętej, bez zmian. Wszystkie ścieżki wstawiania pozycji do cache (odpowiedź na dodanie, `item.upserted`) idą teraz przez jedno `upsertNewer` w `itemsCache.ts`; usunięcia na żywo (`item.deleted`, `items.cleared`) przez `removeItems`, które zapamiętuje usunięte `id` (per `QueryClient`).

## Evidence

Red (przed poprawką):

- test 1: `TestingLibraryElementError: Unable to find an element with the text: /kostka/` (po odpowiedzi pokazana wersja z odpowiedzi zamiast nowszej Tomka)
- test 2: `AssertionError: expected <button aria-label="Edytuj Masło"> to be null` (usunięta pozycja wróciła)

Testy zwalniają odpowiedź `POST` przez `heldResponse` dopiero, gdy zdarzenia WS są widoczne na liście (bez `delay`, uwaga 2 z QA T-017).

Green: `pnpm test` 89 plików, 425 testów pass; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 naruszeń zależności), `pnpm build` — bez błędów.

## Prevention

**Co by zapobiegło:** jedna droga zapisu pozycji do cache SC-06, której nie da się ominąć. T-017 dodał regułę `isNewer`, ale eksportowane `updateItems` pozwalało każdemu hookowi pisać do cache po swojemu (tak zrobił `useAddItem.added`).

**Przyjęte przez użytkownika (2026-10-29):** `updateItems` nieeksportowane z `itemsCache.ts` — zapis pozycji spoza modułu tylko przez `upsertNewer`, `replaceItem`, `removeItems`; obejście to błąd kompilacji (`pnpm typecheck`). Własne usunięcia (`useEditItem`, `ClearBoughtDialog`) przeszły na `removeItems`, więc też są zapamiętywane (uwaga z QA round 1).

**Odrzucone:** wpis „Pułapki” w `layers/web.md` (słabszy niż błąd kompilacji).

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Proces | Sekcja `## Prevention` nadal ma placeholder `<Uzupełnia /fix.>`. | plik zadania | Uzupełnić (np. odesłanie do jednej ścieżki `upsertNewer`/`removeItems`) albo „nie dotyczy”. |
| 2 | note | Kod (spójność) | Własne usunięcia (`useEditItem.ts:111`, `ClearBoughtDialog.tsx:27`) nadal filtrują cache przez `updateItems`, a nie `removeItems`, więc nie trafiają do zbioru usuniętych. Ochronę daje dopiero zdarzenie WS `item.deleted`/`items.cleared` o własnej zmianie. | grep `updateItems` | Rozważyć `removeItems` we wszystkich ścieżkach usuwania (jedna reguła F-14). |
| 3 | note | Kod | `deletedItems` (WeakMap per `QueryClient`) jest stanem modułu, rośnie przez całą sesję i nigdy nie jest czyszczony (np. po pełnym pobraniu listy po ponownym połączeniu). Przy UUID bez wpływu na poprawność. | `itemsCache.ts:53-61` | Akceptowalne; ewentualnie czyścić przy zamknięciu listy. |
| 4 | note | Eksploracja | Ponowienie dodania z tym samym `id` po usunięciu pozycji na żywo: ogłoszenie „Dodano Masło”, ale pozycji nie ma (usunięcie wygrywa). Zgodne z F-14, komunikat może mylić. | analiza kodu | Decyzja produktowa, bez zmian teraz. |

**Reprodukcja:** `pnpm install --frozen-lockfile`; `pnpm test` 89 plików / 425 testów pass; `pnpm typecheck`, `pnpm lint` (0 ostrzeżeń), `pnpm format:check`, `pnpm quality` (0 naruszeń), `pnpm build` bez błędów.

**Kryteria:**

- AC1 pass — test 1 (`keeps Tomek's newer edit…`) zwalnia odpowiedź `POST` po zdarzeniach WS i sprawdza nowszą notatkę „kostka” oraz ogłoszenie.
- AC2 pass — test 2 (`does not bring back a new item deleted live…`) sprawdza brak „Edytuj Masło” i licznik „3 do kupienia”.
- AC3 pass — testy dodania T-006 (`ListScreen.add.test.tsx`, w tym ponowienie z tym samym `id`) i testy na żywo (J-05) zielone.

**Spot-checki (cofnięte, `git status` czysty):**

1. `useAddItem.added` przywrócone do bezwarunkowego `updateItems([item, ...])` → oba testy T-024 czerwone.
2. Usunięty warunek `deletedItems…has(item.id)` w `upsertNewer` → czerwony test 2 (AC2), test 1 zielony; oba testy bronią swojej części poprawki.

**Eksploracja (tymczasowe testy, cofnięte):** `items.cleared` przed odpowiedzią → pozycja nie wraca, ogłoszenie i czyszczenie pola działają; odpowiedź z tym samym `updatedAt` co własne zdarzenie WS → jeden wiersz, ogłoszenie, pole wyczyszczone. Oba pass.

**Testy:** red evidence obecne dla obu planowanych testów; testy asertują zachowanie widoczne dla użytkownika (tekst, role), bez mocków własnych modułów; wartości oczekiwane to literały. Root cause wyjaśnia, dlaczego wcześniejsze testy nie złapały błędu.

**Bezpieczeństwo:** zmiana tylko w cache klienta; brak nowych danych wejściowych, logów ani uprawnień; `threats: []`.
