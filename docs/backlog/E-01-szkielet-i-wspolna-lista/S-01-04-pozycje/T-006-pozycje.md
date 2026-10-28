---
id: T-006
title: "Pozycje: dodawanie, edycja, usuwanie i blokada duplikatu (web)"
epic: E-01
story: S-01-04
status: in-qa          # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-005]
size: M                # S | M (L must be split)
layers: [db, backend, web]
requirements: [F-07, F-09, F-10, F-14, N-04]
threats: [TH-01, TH-13, TH-19]
screens: [SC-06]
---

# T-006 Pozycje: dodawanie, edycja, usuwanie i blokada duplikatu (web)

## Goal

Na SC-06 domownik z dostępem do listy dopisuje pozycję (nazwa + opcjonalna ilość/notatka), poprawia ją i usuwa w arkuszu edycji. Duplikat nazwy (bez rozróżniania wielkości liter, wśród wszystkich pozycji) jest blokowany z ostrzeżeniem; przy pozycji widać, kto ją dodał.

## Demo

1. Na pustej liście wpisuję „Mleko”, notatka „2 l”, „Dodaj” → pozycja na górze z podpisem „dodał(a) <moje imię>”; fokus zostaje w polu nazwy.
2. Wpisuję „mleko” → „„Mleko” jest już na liście. Pozycja nie została dodana.”, wpisany tekst zostaje. „Mleko owsiane” dodaje się bez ostrzeżenia.
3. Dotykam „Mleko owsiane” → arkusz „Edytuj pozycję”: zmiana nazwy na „MLEKO” → „Na liście jest już pozycja „Mleko”. Wybierz inną nazwę.”; zmiana notatki zapisuje się; „Usuń pozycję” usuwa ją od razu.
4. Gdy pozycję usunie ktoś inny (druga karta), zapis w otwartym arkuszu pokazuje „Ta pozycja została usunięta przez inną osobę.”

## Context

- BRD: F-07 — „nazwa wymagana 1–100, ilość/notatka ≤ 200, limit 500, właściciel i uczestnicy mają te same prawa”; F-09 — „porównanie dokładnej nazwy bez wielkości liter wśród wszystkich pozycji; dotyczy dodawania i zmiany nazwy; ostrzeżenia nie da się pominąć; pozycja nie jest duplikatem samej siebie”; F-10 — „przy pozycji imię osoby, która dodała; bez e-maila; usunięty autor = „usunięty użytkownik””; F-14 — „usunięcie wygrywa z równoczesną edycją; ostatni zapis wygrywa”.
- Architektura: moduł `pozycje`, `api.md` „Pozycje” (`Item`, idempotentne `id` klienta), `data-model.md` (`item`, `name_key`, `UNIQUE (list_id, name_key)`, limit 500 z `FOR UPDATE`, kolejność nieodhaczonych `created_at DESC`, `UPDATE … WHERE id AND list_id`), ADR 0004 (duplikat przez `name_key` w bazie); bez optymistycznych aktualizacji.
- Design: SC-06 — AddBar, ItemRow (nieodhaczona), Avatar, BottomSheet „Edytuj pozycję”, InlineAlert (duplikat, limit, długość, błąd zapisu), stan Saving, „Edycja usuniętej pozycji”; tabela Copy (`dup.open`, `dup.rename`, `limit`, `addedBy`, `deletedUser`).
- Depends on: T-005 — `requireListAccess`, `GET /lists/:id` z `items`, ekran SC-06, fabryki `createList` / `addMember`.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given właściciel lub uczestnik, when `POST /api/v1/lists/:listId/items { name, note? }`, then 201 `Item` (nieodhaczona, `addedBy { id, name }`) i pozycja jest w `GET /lists/:id` przed starszymi; SC-06 pokazuje ją po odpowiedzi API (stan „zapisywanie” do tego czasu), czyści pola, zostawia fokus w nazwie i ogłasza „Dodano <nazwa>”. — verified by: test integracyjny `items.create.test` + test komponentu SC-06
- [x] AC2: Given pozycja „Mleko”, when ktoś dodaje „mleko”, „ MLEKO ” albo „Mleko” w innej postaci Unicode (NFC), then 409 `duplicate_item`; SC-06 pokazuje `dup.open` jako `role="alert"`, tekst w polu zostaje. Given „Mleko”, when dodaje „Mleko owsiane”, then 201. — verified by: test unit `normalizeItemName` + testy integracyjne + test komponentu
- [x] AC3: Given pozycje „Mleko” i „Masło”, when zmienia nazwę „Masło” na „mleko”, then 409 `duplicate_item`, nazwa bez zmian, arkusz pokazuje `dup.rename`; when zmienia „Mleko” na „mleko” albo tylko notatkę, then 200. — verified by: testy integracyjne `items.update.test` + test komponentu arkusza
- [x] AC4: Given nazwa pusta / 101 znaków albo notatka 201 znaków, when dodaje lub edytuje, then 400 `validation_failed` z `fields`; SC-06 pokazuje komunikat pod polem. — verified by: testy integracyjne + test komponentu
- [x] AC5: Given lista ma 500 pozycji, when dodaje kolejną, then 409 `limit_reached` (`limit: "items"`); SC-06 pokazuje komunikat o limicie i nieaktywny AddBar; given 499 i dwa równoległe dodania, then powstaje dokładnie jedna. — verified by: testy integracyjne (w tym równoległy) + test komponentu
- [x] AC6: Given żądanie dodania z `id` klienta, które już istnieje na tej liście, when przyjdzie ponownie, then 200 z istniejącą pozycją (nie 409). — verified by: test integracyjny
- [x] AC7: Given pozycja, when `DELETE …/items/:itemId` (z arkusza), then 204 i pozycja znika; fokus przechodzi na następną pozycję. Given pozycja usunięta w międzyczasie, when ktoś zapisuje jej edycję, then 404 `not_found`, a arkusz pokazuje „Ta pozycja została usunięta przez inną osobę.” + „Zamknij”. — verified by: testy integracyjne + test komponentu arkusza
- [x] AC8: Given pozycja, której autor ma `added_by = NULL`, when ktoś patrzy na listę, then `addedBy: null`, a wiersz pokazuje „dodał(a) usunięty użytkownik” (wg Copy `deletedUser`). — verified by: test integracyjny (wiersz z `NULL`) + test komponentu
- [x] AC9: Given SC-06 z pozycjami, ostrzeżeniem duplikatu, limitem i otwartym arkuszem, when E2E je odwiedza, then axe bez naruszeń; arkusz ma pułapkę fokusu, Esc zamyka, fokus wraca na nazwę pozycji; element z fokusem nie chowa się pod przyklejonym AddBar. — verified by: E2E Playwright + axe
- [x] SEC1 (TH-01): Given lista A i domownik B bez dostępu, when B wywoła `POST`, `PATCH` lub `DELETE` na pozycjach listy A, then 404 `not_found`, pozycje bez zmian; anonim 401. Given B ma własną listę, when wywoła `PATCH /lists/<lista B>/items/<pozycja z listy A>`, then 404 i pozycja A bez zmian. — verified by: testy integracyjne `items.authz.test`
- [x] SEC2 (TH-19): Given pozycje na wspólnej liście, when uczestnik pobierze listę lub pozycję, then `addedBy` zawiera wyłącznie `id` i `name` (bez `email`). — verified by: test integracyjny kształtu odpowiedzi
- [x] SEC3 (TH-13): Given limit 500 (AC5) i `bodyLimit`, when bot dodaje pozycje w pętli albo wysyła notatkę ponad limit treści, then po 500 dostaje 409, a zbyt duża treść 413. — verified by: test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- `normalizeItemName` w `packages/shared` (funkcja czysta)
- HTTP API `/api/v1/lists/:listId/items*` przez `fastify.inject`
- ekran SC-06 (AddBar, ItemRow, BottomSheet) z API podstawionym przez MSW

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `normalizeItemName`: trim, NFC, `pl-PL` lower („Ł”, „Ż”), różne nazwy różne klucze | unit | Vitest | AC2 |
| 2 | schematy pozycji (nazwa, notatka) | unit | Vitest | AC4 |
| 3 | dodanie pozycji, kolejność, `addedBy` | integration | Vitest + Testcontainers | AC1, SEC2 |
| 4 | duplikat przy dodaniu (wielkość liter, spacje, NFC); brak fałszywego duplikatu | integration | Vitest + Testcontainers | AC2 |
| 5 | idempotentne `id` klienta | integration | Vitest + Testcontainers | AC6 |
| 6 | edycja: duplikat innej pozycji, ta sama pozycja innej wielkości liter, sama notatka | integration | Vitest + Testcontainers | AC3 |
| 7 | walidacja długości (dodanie, edycja); 413 | integration | Vitest + Testcontainers | AC4, SEC3 |
| 8 | limit 500 i równoległe dodanie przy 499 | integration | Vitest + Testcontainers | AC5, SEC3 |
| 9 | usunięcie; edycja usuniętej = 404 | integration | Vitest + Testcontainers | AC7 |
| 10 | autor `NULL` → `addedBy: null` | integration | Vitest + Testcontainers | AC8 |
| 11 | autoryzacja: obcy 404, anonim 401, pozycja z innej listy 404 | integration | Vitest + Testcontainers | SEC1 |
| 12 | SC-06: dodanie (zapisywanie, fokus, ogłoszenie), duplikat, długość, limit, błąd zapisu | component | Vitest + RTL + MSW | AC1, AC2, AC4, AC5 |
| 13 | arkusz edycji: zapis, duplikat nazwy, usunięcie, pozycja usunięta przez kogoś | component | Vitest + RTL + MSW | AC3, AC7 |
| 14 | wiersz: „dodał(a) <imię>” / „usunięty użytkownik” | component | Vitest + RTL | AC8 |
| 15 | E2E J-03 (część): dodanie, duplikat, edycja, usunięcie; axe | E2E | Playwright + axe | AC9 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów. Baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** „Żółty ser” vs „żółty SER”; nazwy różniące się tylko spacją w środku (to różne pozycje); emoji; dokładnie 100 / 200 znaków; szybkie wielokrotne „Dodaj” (Enter); dodanie przy słabym zasięgu (throttling w DevTools) — brak podwójnej pozycji; edycja tej samej pozycji w dwóch kartach (ostatni zapis wygrywa).
- **Design states:** SC-06: pusty, ładowanie, duplikat, limit, długość, błąd zapisu, zapisywanie, edycja usuniętej pozycji, sukces.
- **Platforms / devices:** Safari i Chrome na telefonie (AddBar przy klawiaturze ekranowej), Chrome / Firefox na komputerze; 320 px i 200 %.
- **Accessibility:** klawiatura: dodawanie Enterem, arkusz (fokus, Esc, powrót); czytnik ekranu ogłasza „Dodano …” i ostrzeżenie duplikatu; fokus nie chowa się pod AddBar (2.4.11); cele ≥ 48 px, wiersz ≥ 60 px.
- **Security / privacy:** TH-01 — drugie konto: żądania na pozycjach cudzej listy i mieszanie `listId` / `itemId`; TH-19 — odpowiedź w DevTools bez e-maili; treść z HTML (`<img onerror>`) wyświetla się jako tekst.
- **Regression:** J-02 z T-005 (utworzenie, zmiana nazwy, usunięcie listy z pozycjami — kaskada).

## Implementation notes

- `name_key` liczone wyłącznie przez `normalizeItemName` z `packages/shared`, nigdy `lower()` w SQL; naruszenie unikalności mapowane na `duplicate_item`.
- Edycja i usunięcie zawsze z `list_id` z już sprawdzonego dostępu (`UPDATE … WHERE id = $1 AND list_id = $2`).
- `updated_at` listy aktualizowane przy zmianie pozycji (kolejność SC-05).
- Wariant ostrzeżenia dla odhaczonej pozycji (`dup.bought` + „Pokaż”) — T-007, gdy istnieje sekcja „Kupione”; API już teraz blokuje duplikaty wśród wszystkich pozycji.
- Fabryka `createItem(list, by)`.
- Publikacja zdarzeń `item.upserted` / `item.deleted` — T-009.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg 2026-10-28 (`/implement-task T-006`), Windows 11, Docker (Testcontainers `postgres:17.11-alpine`).

### Komendy (ten przebieg)

- `pnpm check` — Prettier, ESLint (`--max-warnings 0`), `tsc` wszystkich pakietów, jscpd **0 klonów**, dependency-cruiser **0 naruszeń** (237 modułów), design-check **0 błędów** (35 kontrastów, 0 kolorów na sztywno), backlog-check OK, Vitest **49 plików / 240 testów zielonych**.
- `pnpm build` — web i API zbudowane.
- `pnpm test:e2e` — **22/22** (telefon 390 × 844 i komputer 1280 × 800), w tym J-01 i J-02 bez regresji. `j03-pozycje.spec.ts` dodatkowo 3 przebiegi pod rząd 8/8 po poprawce opisanej niżej.

### Testy z TDD planu (red → green)

| # | Plik / test | Red (pierwsze uruchomienie) | Teraz |
| --- | --- | --- | --- |
| 1 | `packages/shared/test/items.test.ts` — `normalizeItemName` (wielkość liter i spacje, „ŁOSOŚ”, „Żółty SER”, NFC z rozłożonej formy, różne nazwy = różne klucze, spacja w środku zostaje) | stub zwracający nazwę bez zmian: `expected 'Mleko' to be 'mleko'`, `expected 'ŁOSOŚ' to be 'łosoś'`, `expected 'Żółty ser' to be 'żółty ser'`. „Różne klucze” przeszło na stubie: pilnuje, żeby normalizacja nie skleiła różnych nazw | ✔ |
| 2 | `packages/shared/test/items.test.ts` — `createItemRequestSchema`, `updateItemRequestSchema` (trim, pusta notatka = `null`, `id` klienta, 1 / 100 / 200 znaków z emoji, pusta, 101, 201, nie-UUID, NUL; edycja tylko podanych pól) | stub `z.object({})`: 6× np. `expected {} to deeply equal { name: 'Mleko', note: '2 l' }`, `expected {} to deeply equal { name: 'required' }` | ✔ |
| 3 | `apps/api/test/items.create.test.ts` (201 `Item` z `addedBy { id, name }` bez e-maila; uczestnik; nowa pozycja przed starszą w `GET /lists/:id`; lista na górze SC-05) | stub 501: `expected 501 to be 201` (2×), `expected [ 'Nowsza', 'Starsza' ] to deeply equal [ 'Starsza', 'Nowsza' ]`; test kolejności padł na `SyntaxError: Unexpected end of JSON input` (pusta treść 501) | ✔ |
| 4 | `apps/api/test/items.duplicate.test.ts` („mleko”, „ MLEKO ”, „Mleko”, NFC, odhaczona „Mleko”, „Mleko owsiane”, ta sama nazwa na innej liście) | 5× `expected 500 to be 409` (naruszenie indeksu bez obsługi) | ✔ |
| 5 | `apps/api/test/items.idempotency.test.ts` (powtórka z tym samym `id` = 200 i ta sama pozycja; `id` pozycji cudzej listy = 404, nic nie zmienione) | `expected { …(9) } to match object { …(2) }` (serwer ignorował `id`), `expected 201 to be 404` | ✔ |
| 6 | `apps/api/test/items.update.test.ts` („Masło” → „mleko” = 409 i nazwa bez zmian; „Mleko” → „mleko” = 200; sama notatka i czyszczenie; uczestnik) | 4× `expected 404 to be 409` / `… to be 200` (brak trasy) | ✔ |
| 7 | `apps/api/test/items.validation.test.ts` (dodanie i edycja: pusta, 101, notatka 201 → 400 z `fields`; dokładnie 100 / 200 = 201; 20 000 znaków = 413) | przeszedł od razu: walidacja weszła w trasach razem ze schematem (testy 2, 3, 6), 413 daje `bodyLimit` z T-001. Spot-check: trasy bez `validate` i `bodyLimit` 1 MB → 7 testów czerwonych (`expected 500 to be 400`, `expected 200 to be 400`, `expected 500 to be 413`) | ✔ |
| 8 | `apps/api/test/items.limit.test.ts` (501. = 409 `limit_reached` `items`; 2 równoległe przy 499; **20 równoległych przy 490**; powtórka istniejącego `id` przy limicie = 200; bot w pętli + log `security` z `userId`, `listId`, bez treści) | `expected 201 to be 409`, `expected [ 201, 201 ] to deeply equal [ 201, 409 ]`, `… length of 10 but got 20`, `expected [ 201, 201, 201, 201, 201 ] to deeply equal [ 201, 201, 201, 409, 409 ]` | ✔ |
| 9 | `apps/api/test/items.delete.test.ts` (204 i znika z listy; uczestnik; drugie usunięcie = 404; edycja usuniętej = 404 i nie wraca; `itemId` nie-UUID = 404) | `expected 404 to be 204` (2×), `expected 200 to be 404` (edycja usuniętej) | ✔ |
| 10 | `apps/api/test/items.deleted-author.test.ts` (`added_by NULL` → `addedBy: null`; usunięty uczestnik → `SET NULL`, pozycja zostaje) | przeszedł od razu (mapowanie i `SET NULL` powstały z odczytem i schematem). Spot-check: autor `null` mapowany na `{ id: "", name: "" }` → 2 testy czerwone | ✔ |
| 11 | `apps/api/test/items.authz.test.ts` (obcy: `POST` / `PATCH` / `DELETE` = 404, nic nie zmienione; anonim 401; pozycja listy A przez własną listę B = 404) | przeszedł od razu (trasy od testu 3 wołają `requireListAccess`, zapytania mają `list_id`). Spot-check każdej ochrony osobno: bez `requireListAccess` → `POST …: expected 201 to be 404`; `UPDATE` / `DELETE` bez `list_id` → `expected 200 to be 404` | ✔ |
| 12 | `apps/web/src/screens/SC-06-lista/ListScreen.add.test.tsx` (9 testów: dodanie ze stanem zapisywania, kolejnością, czyszczeniem, fokusem i „Dodano Mleko”; duplikat lokalny i z API; „Mleko owsiane”; długość w kliencie i z API; limit z liczby pozycji i z API; błąd zapisu) | dodanie: `Unable to find role="textbox" and name "Co kupić?"`. Pozostałe 8 przypadków napisałem po kodzie: obsługa duplikatu, limitu, długości i błędu zapisu weszła do `useAddItem` razem z dodaniem (odstępstwo od red-first). Spot-check każdej gałęzi osobno — padał dokładnie jej test: bez lokalnego duplikatu, bez `duplicate_item` z API, bez błędów pól w kliencie, bez błędu pola z API, bez limitu z liczby pozycji, bez `limit_reached` z API, bez `setFailure` | ✔ |
| 13 | `apps/web/src/screens/SC-06-lista/ListScreen.edit.test.tsx` (12 testów: otwarcie z fokusem; zapis samej notatki i powrót fokusu; duplikat nazwy lokalnie i z API; „Mleko” → „mleko”; długość; błąd zapisu; Esc; usunięcie z fokusem na następnej / poprzedniej / „Co kupić?”; „usunięta przez inną osobę” + „Zamknij”) | otwarcie / zapis: 2× `Unable to find … role "dialog" and name "Edytuj pozycję"`; duplikat / błąd: 3× `Unable to find role="alert"`, długość: `toHaveAccessibleDescription` pusty; usunięcie: 3× `Unable to find … role "button" and name "Usuń pozycję"`; usunięta przez kogoś: `Unable to find an element with the text: Ta pozycja została usunięta przez inną osobę.`. „Mleko” → „mleko” i Esc przeszły od razu (zapis z poprzedniego kroku; Esc i powrót fokusu daje `Modal` z T-005) | ✔ |
| 14 | `apps/web/src/screens/SC-06-lista/ListScreen.items.test.tsx` („dodał(a) Tomek”, notatka przed podpisem, „dodał(a) usunięty użytkownik”, nazwa z HTML jako tekst) | przeszedł od razu (podpis wiersza powstał w teście 12). Spot-check: bez „usunięty użytkownik” → test AC8 czerwony; wiersz bez podpisu → 3 testy czerwone | ✔ |
| 15 | `apps/web/e2e/j03-pozycje.spec.ts` (J-03: dodanie, duplikat, edycja z pułapką fokusu i Esc, duplikat nazwy, zapis, usunięcie; „usunięta przez inną osobę”; limit 500; fokus nad AddBar) | napisany po zachowaniu na szybszych seamach (Step 6) | ✔ 8/8 |

Testy dopisane do planu w trakcie (zachowania, których plan nie wymieniał):

- 4 — duplikat odhaczonej pozycji (F-09: „także odhaczonej”) i ta sama nazwa na innej liście.
- 5 — `id` klienta należące do pozycji **innej** listy: bez tego powtórka cudzego `id` zwracałaby cudzą pozycję albo 500 (PK). Teraz 404.
- 8 — 20 równoległych żądań przy 490 (jak w T-005: dwa żądania przez `inject` rzadko się nakładają) i powtórka istniejącego `id` przy pełnej liście (200, nie 409 limitu).
- 9 — `itemId` nie-UUID = 404 (bez tego zapytanie z tekstem w kolumnie `uuid` kończyło się 500).
- 13 — usunięcie: fokus na poprzedniej pozycji, gdy usunięto ostatnią, i w „Co kupić?”, gdy lista jest pusta (`design-system.md`, BottomSheet).
- 14 — nazwa z HTML jako tekst (QA plan, TH-15).

Zmiany istniejących testów: `apps/web/test/lists.ts` — `detailsOf(list, items = [])` i nowy `anItem`. `ListScreen.test.tsx` (T-005) bez zmian i zielony.

### Kryteria akceptacji

- **AC1** — `items.create.test` (201 `Item` nieodhaczona z `addedBy { id, name }`, nowa przed starszą w `GET /lists/:id`); SC-06 „adds an item after the API answers…” (`aria-busy` na „Dodaj pozycję” i brak wiersza do odpowiedzi, potem wiersz na górze, pola puste, fokus w „Co kupić?”, `role="status"` „Dodano Mleko”, w żądaniu `id` UUID); E2E J-03.
- **AC2** — `items.test.ts` (`normalizeItemName`); `items.duplicate.test` (409 `duplicate_item` dla „mleko”, „ MLEKO ”, „Mleko”, formy NFC; „Mleko owsiane” 201); SC-06: ostrzeżenie `role="alert"` „„Mleko” jest już na liście. Pozycja nie została dodana.”, tekst zostaje (lokalnie i z API); E2E J-03 + axe w stanie duplikatu.
- **AC3** — `items.update.test` (409 i nazwa bez zmian; „mleko” 200; sama notatka 200); arkusz: `dup.rename` lokalnie i z API, „Mleko” → „mleko” zapisane, wysyłane tylko zmienione pole; E2E (rename na „MLEKO” → ostrzeżenie + axe; zapis notatki).
- **AC4** — `items.validation.test` (400 `validation_failed` z `fields` przy dodaniu i edycji); SC-06 i arkusz: „Nazwa może mieć najwyżej 100 znaków”, „Notatka może mieć najwyżej 200 znaków” jako opis pola (`aria-describedby`), także dla błędu pola z API.
- **AC5** — `items.limit.test` (409 `limit_reached` `items`; przy 499 dwa równoległe → `[201, 409]`, łącznie 500; 20 równoległych przy 490 → 10 × 201); SC-06: komunikat limitu, pole i „Dodaj pozycję” nieaktywne (z liczby pozycji i z odpowiedzi API); E2E 500 pozycji + axe.
- **AC6** — `items.idempotency.test` (powtórka: 200 i ta sama pozycja, 1 wiersz); `items.limit.test` (powtórka przy pełnej liście = 200); web wysyła jedno `id` na wpisywaną pozycję (`useItemDraft`, nowe po dodaniu).
- **AC7** — `items.delete.test` (204 i znika; edycja usuniętej = 404 i nie wraca); arkusz: „Usuń pozycję” usuwa od razu, fokus na następnej / poprzedniej / „Co kupić?”; 404 przy zapisie → „Ta pozycja została usunięta przez inną osobę.” + „Zamknij” (fokus na „Zamknij”), po zamknięciu pozycji nie ma; E2E (usunięcie z fokusem na „Edytuj Mleko”; „usunięta przez inną osobę” + axe).
- **AC8** — `items.deleted-author.test` (wiersz z `NULL` i `SET NULL` po usunięciu konta uczestnika → `addedBy: null`); SC-06 „signs an item of a deleted account with „usunięty użytkownik””.
- **AC9** — E2E: axe bez naruszeń dla SC-06 pustej, z pozycją, z ostrzeżeniem duplikatu, z otwartym arkuszem, z `dup.rename`, „usunięta przez inną osobę”, limit 500, 30 pozycji; w arkuszu 6 × Tab zostaje w dialogu, Esc zamyka, fokus na „Edytuj Mleko owsiane”; Shift+Tab z „Co kupić?” na ostatnią pozycję — jej dół ≤ górna krawędź AddBar (telefon i komputer).
- **SEC1** — `items.authz.test` (obcy: `POST` / `PATCH` / `DELETE` → 404 `not_found`, pozycje bez zmian; anonim 401 na 3 trasach; `PATCH` / `DELETE` pozycji listy A przez listę B → 404, A bez zmian); `items.idempotency.test` (cudze `id` → 404).
- **SEC2** — `items.create.test`: `addedBy` dokładnie `{ id, name }` (`toEqual`), treść `POST` i `GET /lists/:id` bez e-maili obu osób; mapowanie w jednym miejscu (`http/item-response.ts`).
- **SEC3** — `items.limit.test` „stops a bot adding in a loop at 500…” (`[201, 201, 201, 409, 409]`, 2 wpisy `limit_reached` w logu `security` z `userId`, `listId`, `limit: "items"`, bez nazwy pozycji); `items.validation.test` (notatka 20 000 znaków → 413).

### Decyzje do obejrzenia przez QA

- **Granice modułów.** `pozycje` zależy od `Lists.requireListAccess`, a `GET /lists/:id` (moduł `listy`) pokazuje pozycje. Żeby nie powstał cykl, domena `listy` definiuje interfejs `ListItems`, a `app.ts` podaje implementację `createItems(pool)`. Odstępstwo (zapisane w `layers/backend.md`): `pozycje/infra` blokuje wiersz `shopping_list` (`FOR UPDATE` dla limitu, zgodnie z `data-model.md`) i ustawia jego `updated_at` w tej samej transakcji co zmiana pozycji.
- **Kolejność sprawdzeń przy dodaniu:** blokada listy → powtórzone `id` → limit → `INSERT … ON CONFLICT (list_id, name_key) DO NOTHING`. Przy pełnej liście duplikat dostaje `limit_reached`.
- **Edycja** wysyła tylko zmienione pola (ostatni zapis wygrywa per pole, F-14); duplikat przy zmianie nazwy wykrywa naruszenie `item_list_id_name_key_unique` (23505).
- **Układ SC-06 (2.4.11):** zamiast `position: sticky` AddBar stoi w przepływie pod przewijanym `main` (`height: 100dvh`), więc nie może zasłonić elementu z fokusem. Na telefonie z klawiaturą ekranową (Safari) warto sprawdzić to ręcznie.
- **AddBar na tle marki:** pary kontrastu nie obejmują tekstu błędu na `surface.brand`, więc błąd pola i licznik w AddBar mają jasne tło (`TextField variant="onBrand"`). Ostrzeżenie duplikatu to InlineAlert w tonie ostrzeżenia z `role="alert"` (nowa opcja `urgent`).
- **Teksty spoza tabeli „Copy”** (tekst agenta): pusta nazwa „Wpisz nazwę pozycji” (jak „Wpisz nazwę listy” na SC-05), etykieta pola w arkuszu „Nazwa”. Nazwa dostępna „Dodaj pozycję” przy widocznym „Dodaj” (Copy `add.submit`).
- **Stan „Loading”:** AddBar jest nieaktywny do wczytania listy (SC-06 „States”).
- **E2E „usunięta przez inną osobę”** usuwa pozycję przez `page.request` w tej samej sesji, nie z drugiej karty. Otwarcie drugiej strony w trakcie testu wstrzymywało API na Windows na ~10 s (log API: przerwa 10 s po `DELETE`, potem `PATCH` bez odpowiedzi przed limitem asercji; 2 z 4 przebiegów czerwone). Dopisane do „Pułapki” w `layers/web.md`. Wariant z dwiema kartami (Demo 4) do sprawdzenia ręcznie w QA.
- **Poza zakresem (T-007):** `toBuyCount` na SC-05 nadal 0, wariant `dup.bought` + „Pokaż”, checkbox w wierszu. **T-009:** zdarzenia `item.upserted` / `item.deleted`.

### Przewodniki warstw (Step 8b)

Zaktualizowane fakty w „Gdzie jest kod” / „Pułapki”: `layers/db.md` (tabela `item`, migracja `0004_pozycje`, limit i duplikat w repozytorium), `layers/backend.md` (moduł `pozycje`, `ListItems`, `ids.ts`, `createItem`, pliki `shared`), `layers/web.md` (pliki SC-06, nowe komponenty i warianty, `anItem`, dwie pułapki E2E). Poza tym `api.md` („Stan po T-006”) i `data-model.md` (indeks `item (list_id)` pokryty unikalnym `(list_id, name_key)`). Propozycji zmian „Conventions” brak.

### Runda poprawek po QA round 1 (2026-10-28)

Zakres: usterki major #1–#3. Zmiana tylko w `apps/web/src/screens/SC-06-lista/useAddItem.ts` (+ testy w `ListScreen.add.test.tsx`, seam „ekran SC-06 z MSW”).

| QA # | Test (`ListScreen.add.test.tsx`, „SC-06 AddBar while saving and after a failed save”) | Red | Poprawka | Teraz |
| --- | --- | --- | --- | --- |
| 1 | „keeps text typed while the previous item is saving and adds it next” — `POST` opóźniony 200 ms, „Mleko” + Enter, w trakcie zapisu „Chleb”; po odpowiedzi pole ma „Chleb”, Enter dodaje „Chleb” z nowym `id` | `Expected the element to have value: Chleb` / `Received:` (puste) | `useItemDraft.clear(sent)` czyści pola tylko, gdy nadal zawierają wysłaną treść (aktualizacja funkcyjna stanu, bez nieaktualnego domknięcia) | ✔ |
| 2 | „sends a new id when the text changed after a lost response” — serwer zapisuje „Ser”, odpowiedź zerwana (`HttpResponse.error()`), zmiana na „Jajka” + Enter → „Jajka” na liście, „Dodano Jajka”, dwa różne `id` | `Unable to find role="button" and name "Edytuj Jajka"` (powtórzone `id` zwróciło „Ser”) | `id` związane z wysłaną treścią: `idFor(sent)` używa poprzedniego `id` tylko dla tej samej nazwy i notatki, inaczej nowe; po dodaniu próba się zeruje | ✔ |
| 2 (strażnik) | „repeats the same id when the unchanged text is sent again (AC6)” — po zerwanej odpowiedzi ponowienie bez zmian ma to samo `id` | przeszedł od razu: przypina istniejące zachowanie AC6, żeby poprawka #2 go nie zepsuła | — | ✔ |
| 3 | „enables the AddBar again when an item is deleted after the API's limit” — 409 `limit_reached` → komunikat limitu; usunięcie „Chleb” w arkuszu → brak komunikatu, pole i „Dodaj pozycję” aktywne | `expected <div></div> to be null` (komunikat limitu nadal widoczny) | ostrzeżenie limitu z API pamięta liczbę pozycji (`atCount`), przy której przyszło; obowiązuje, dopóki pozycji nie ubędzie | ✔ |

Komendy (ten przebieg): `pnpm check` — Prettier, ESLint, `tsc`, jscpd 0 klonów, dependency-cruiser 0 naruszeń, design-check 0 błędów, backlog-check OK, Vitest **49 plików / 244 testy zielone**; `pnpm build` OK; `pnpm test:e2e` **22/22**. W pierwszym przebiegu `pnpm check` jeden timeout (5 s) w `SC-02 … links each summary entry to its field …` — plik nietknięty, pod pełnym obciążeniem trwał 17 s; osobno 7/7, w powtórzonym `pnpm check` zielony. Niestabilność pod obciążeniem, nie regresja.

Decyzje do obejrzenia przez QA:

- **#1:** wybrany wariant „czyścić tylko to, co zostało wysłane”. Pole zostaje edytowalne w trakcie zapisu (zablokowanie chowałoby klawiaturę ekranową na telefonie). Enter w trakcie zapisu nadal nic nie wysyła, ale tekst zostaje widoczny, więc nie ginie po cichu.
- **#3:** limit z API wygasa przy spadku liczby pozycji poniżej tej z chwili odpowiedzi; przy pozycjach dodanych w międzyczasie przez kogoś innego (bez T-009) API i tak odpowie ponownie 409.
- **Poza rundą (minor / note, nie ruszane):** #4 (fokus na pustej liście — do decyzji: poprawić osobno albo zapisać odstępstwo), #6–#8.
- **Propozycja do „Pułapek” `layers/web.md` (nie edytowana):** każdy hook mutacji ma test z opóźnioną i zerwaną odpowiedzią oraz zmianą danych w międzyczasie (QA, krok 10).

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-28)

Verdict: fail

Niezależna weryfikacja w nowej sesji (Windows 11, Docker, Testcontainers `postgres:17.11-alpine`, Playwright Chromium).

**Reprodukcja:** `pnpm install --frozen-lockfile` (bez zmian w plikach śledzonych), `pnpm check` — Prettier, ESLint, `tsc`, jscpd 0 klonów, dependency-cruiser 0 naruszeń, design-check 0 błędów / 0 kolorów na sztywno, backlog-check OK, Vitest **49 plików / 240 testów zielonych**; `pnpm build` OK; `pnpm test:e2e` **22/22**.

**Spot-checki (mutacje, cofnięte, `git status` czysty):** bez `.for("update")` → pada „never exceeds 500 items under many parallel requests”; `UPDATE`/`DELETE` bez `list_id` → pada „answers 404 when an item of list A is addressed through own list B”; `normalizeItemName` bez `toLocaleLowerCase` → 7 testów czerwonych (shared + `items.duplicate`); `sameNameAs` bez `exceptId` → 4 testy arkusza czerwone. Testy rzeczywiście pilnują zachowania. Formy NFC w testach są naprawdę rozłożone (`Z U+0307 o U+0301`).

**Kryteria akceptacji:**

| AC | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | `items.create.test`, `ListScreen.add.test`; E2E; ręcznie: pozycja na górze, pola puste, fokus w „Co kupić?”, „Dodano …” w `role="status"` |
| AC2 | pass | testy + ręcznie „żółty SER” przy „Żółty ser” → `dup.open` jako `role="alert"`, tekst zostaje; „Żółty  ser” (spacja w środku) dodaje się |
| AC3 | pass | `items.update.test`, arkusz; ręcznie „MLEKO” → `dup.rename`; równoległa zmiana notatki przez innego klienta + zmiana nazwy w arkuszu → obie zmiany zostają (per pole) |
| AC4 | pass | testy + ręcznie 101 / 201 znaków → komunikaty pod polem; dokładnie 100 / 200 → 201; emoji liczone jako znaki (spójnie z `char_length`) |
| AC5 | pass | testy (w tym 20 równoległych) + E2E 500 pozycji; patrz jednak #3 (stan po zejściu poniżej limitu) |
| AC6 | pass | `items.idempotency.test`; ręcznie: zerwana odpowiedź + ponowienie bez zmian → jedna pozycja; patrz jednak #2 |
| AC7 | pass | testy + **ręcznie z drugą kartą (Demo 4)**: usunięcie w drugiej karcie, zapis w otwartym arkuszu → „Ta pozycja została usunięta przez inną osobę.”, fokus na „Zamknij”, Esc zamyka, pozycja znika |
| AC8 | pass | `items.deleted-author.test`, `ListScreen.items.test` |
| AC9 | pass | E2E + axe (8 stanów SC-06); pułapka fokusu, Esc, powrót fokusu, fokus nad AddBar |
| SEC1 | pass | `items.authz.test` + ręcznie: nieistniejąca / nie-UUID lista → 404, `itemId` nie-UUID i `..%2F` → 404, żądanie bez `Origin` → 403 |
| SEC2 | pass | test kształtu; ręcznie odpowiedzi `POST` / `PATCH` / `GET` bez e-maili |
| SEC3 | pass | `items.limit.test`; ręcznie notatka 20 000 znaków → 413 |

**Eksploracja (inne wyniki OK):** `<img onerror>` w nazwie wyświetla się jako tekst, skrypt się nie wykonał; podwójny / potrójny Enter na wolnej sieci → jedna pozycja; treść spoza schematu (`addedBy`, `checked`, `listId`) ignorowana; `PATCH {}` → 200; 320 px bez poziomego przewijania, wiersz 86 px, „Dodaj” 48 px wysokości; arkusz mieści się na 320 × 640.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | major | web / AddBar (F-07, F-15) | Pozycja wpisana w trakcie zapisu poprzedniej **ginie bez śladu**. Pole „Co kupić?” jest edytowalne podczas zapisu, Enter jest wtedy po cichu ignorowany (`AddBar`: `if (!pending) onSubmit()`), a po odpowiedzi API `draft.reset()` czyści pole z nowym tekstem. Użytkownik widzi pusty pasek i uważa, że dodał obie rzeczy. | Opóźnienie `POST` 1,5 s: „Mleko” + Enter, potem „Chleb” + Enter → na liście tylko „Mleko”, pole puste, brak komunikatu (`X9`; zrzut 320 px pokazuje „Mleko” wpisane przy kręcącym się „Dodaj”). Ten sam efekt wystąpił mimowolnie dwa razy przy zwykłym szybkim wpisywaniu w teście eksploracyjnym na lokalnym API. | Tekst wpisany po wysłaniu nie może zniknąć: albo czyścić tylko to, co zostało wysłane (zostawić nowy tekst), albo zablokować pole na czas zapisu, albo wysłać kolejną pozycję po zakończeniu poprzedniej. Test komponentu z opóźnioną odpowiedzią, który to pilnuje. |
| 2 | major | web / AddBar (AC6, F-15) | `id` klienta nie jest związane z treścią: po błędzie sieci (serwer zapisał, odpowiedź przepadła) użytkownik poprawia tekst i ponawia — serwer zwraca starą pozycję (200, to samo `id`), web ogłasza „Dodano <stara nazwa>”, czyści pole, a **nowy tekst przepada**. | Zerwana odpowiedź na „Ser” (`route.fetch` + `abort`) → „Brak połączenia…”; zmiana pola na „Jajka” + Enter → na liście „Ser”, „Jajek” brak, ogłoszenie „Dodano Ser”, pole puste (`X3b`). | Nowe `id`, gdy po nieudanym wysłaniu zmieni się nazwa lub notatka (ponowienie tylko tej samej treści używa tego samego `id`); test komponentu na ten przypadek. |
| 3 | major | web / limit (F-07, AC5) | Ostrzeżenie limitu z odpowiedzi API jest „lepkie”: `limitReached = items.length >= 500 \|\| warning?.kind === "limit"`, a `warning` zeruje tylko `submit`, którego nie da się wywołać, bo AddBar jest nieaktywny. Po usunięciu pozycji AddBar zostaje zablokowany do przeładowania strony. | 499 pozycji w UI, 500. dodana przez innego klienta, „Moja” + Enter → 409 i komunikat limitu (poprawnie); usunięcie „P 0” w arkuszu → na liście 499, AddBar nadal nieaktywny, komunikat limitu nadal widoczny (`X1`, zrzut `x1-after-delete`). | Limit wynika z aktualnej liczby pozycji: ostrzeżenie z API znika, gdy liczba pozycji spadnie poniżej 500 (np. po usunięciu); test komponentu: limit z API → usunięcie pozycji → AddBar aktywny. |
| 4 | minor | web / SC-06 Empty | Stan „Empty” wg SC-06: „fokus na polu dodawania” — po wejściu na pustą listę fokus jest na `body`. | `document.activeElement` = `<body>` na nowej pustej liście (`X5`). | Fokus w „Co kupić?” po wczytaniu pustej listy (albo zapisane odstępstwo, jeśli celowo). |
| 5 | minor | TDD (Step 5) | Test 12 (8 z 9 przypadków), 15 (E2E) oraz testy 7, 10, 11, 14 bez czerwieni przed kodem. Autor uczciwie to opisał i dla każdej gałęzi pokazał spot-check (mutacja → czerwony test), a moje 4 mutacje potwierdzają, że testy gryzą; DoD „written test-first” słusznie nie odhaczone. | Evidence, wiersze 7, 10–15. | W rundzie poprawek testy do #1–#3 najpierw czerwone, z komunikatem w Evidence. |
| 6 | note | web / arkusz | `dup.rename` z odpowiedzi API pokazuje nazwę wpisaną przez użytkownika, nie istniejącą pozycję (przy lokalnym sprawdzeniu — istniejącą). Przy nieaktualnym cache: „Na liście jest już pozycja „MLEKO”” zamiast „Mleko”. | `useEditItem.failed`: `setDuplicate(typed)`. | Do rozważenia razem z T-009 (cache na żywo zmniejszy ten przypadek). |
| 7 | note | backend | `PATCH` bez zmian (`{}` — „Zapisz” w arkuszu bez edycji) podbija `updated_at` pozycji i listy, więc lista wskakuje na górę SC-05 bez żadnej zmiany. | `PATCH {}` → 200, `updatedAt` nowszy (`X8`). | Pominąć zapis (albo zamknąć arkusz bez żądania), gdy nic się nie zmieniło. |
| 8 | note | backend (T-001) | 413 ma domyślny kształt Fastify (`FST_ERR_CTP_BODY_TOO_LARGE`, `message`), nie `{ error: { code } }` z `api.md`. Sprzed T-006. | `POST` z notatką 20 000 znaków (`X8`). | Ewentualnie osobne zadanie. |

**Do poprawy w rundzie 2 (`/implement-task T-006` w nowej sesji):** #1, #2, #3 — każdy z testem komponentu, który najpierw jest czerwony; #4 poprawić albo zapisać jako odstępstwo. #6–#8 opcjonalnie.

**Krok 10:** pierwsza w projekcie seria usterek „stan klienta w czasie trwającej / nieudanej mutacji” (#1–#3). Jeśli wróci w T-007 (odhaczanie), warto dopisać do „Pułapek” w `layers/web.md` regułę: każdy hook mutacji ma test z opóźnioną i zerwaną odpowiedzią oraz zmianą danych w międzyczasie.
