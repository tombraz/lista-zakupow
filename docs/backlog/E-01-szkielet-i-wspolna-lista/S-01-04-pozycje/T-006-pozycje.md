---
id: T-006
title: "Pozycje: dodawanie, edycja, usuwanie i blokada duplikatu (web)"
epic: E-01
story: S-01-04
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given właściciel lub uczestnik, when `POST /api/v1/lists/:listId/items { name, note? }`, then 201 `Item` (nieodhaczona, `addedBy { id, name }`) i pozycja jest w `GET /lists/:id` przed starszymi; SC-06 pokazuje ją po odpowiedzi API (stan „zapisywanie” do tego czasu), czyści pola, zostawia fokus w nazwie i ogłasza „Dodano <nazwa>”. — verified by: test integracyjny `items.create.test` + test komponentu SC-06
- [ ] AC2: Given pozycja „Mleko”, when ktoś dodaje „mleko”, „ MLEKO ” albo „Mleko” w innej postaci Unicode (NFC), then 409 `duplicate_item`; SC-06 pokazuje `dup.open` jako `role="alert"`, tekst w polu zostaje. Given „Mleko”, when dodaje „Mleko owsiane”, then 201. — verified by: test unit `normalizeItemName` + testy integracyjne + test komponentu
- [ ] AC3: Given pozycje „Mleko” i „Masło”, when zmienia nazwę „Masło” na „mleko”, then 409 `duplicate_item`, nazwa bez zmian, arkusz pokazuje `dup.rename`; when zmienia „Mleko” na „mleko” albo tylko notatkę, then 200. — verified by: testy integracyjne `items.update.test` + test komponentu arkusza
- [ ] AC4: Given nazwa pusta / 101 znaków albo notatka 201 znaków, when dodaje lub edytuje, then 400 `validation_failed` z `fields`; SC-06 pokazuje komunikat pod polem. — verified by: testy integracyjne + test komponentu
- [ ] AC5: Given lista ma 500 pozycji, when dodaje kolejną, then 409 `limit_reached` (`limit: "items"`); SC-06 pokazuje komunikat o limicie i nieaktywny AddBar; given 499 i dwa równoległe dodania, then powstaje dokładnie jedna. — verified by: testy integracyjne (w tym równoległy) + test komponentu
- [ ] AC6: Given żądanie dodania z `id` klienta, które już istnieje na tej liście, when przyjdzie ponownie, then 200 z istniejącą pozycją (nie 409). — verified by: test integracyjny
- [ ] AC7: Given pozycja, when `DELETE …/items/:itemId` (z arkusza), then 204 i pozycja znika; fokus przechodzi na następną pozycję. Given pozycja usunięta w międzyczasie, when ktoś zapisuje jej edycję, then 404 `not_found`, a arkusz pokazuje „Ta pozycja została usunięta przez inną osobę.” + „Zamknij”. — verified by: testy integracyjne + test komponentu arkusza
- [ ] AC8: Given pozycja, której autor ma `added_by = NULL`, when ktoś patrzy na listę, then `addedBy: null`, a wiersz pokazuje „dodał(a) usunięty użytkownik” (wg Copy `deletedUser`). — verified by: test integracyjny (wiersz z `NULL`) + test komponentu
- [ ] AC9: Given SC-06 z pozycjami, ostrzeżeniem duplikatu, limitem i otwartym arkuszem, when E2E je odwiedza, then axe bez naruszeń; arkusz ma pułapkę fokusu, Esc zamyka, fokus wraca na nazwę pozycji; element z fokusem nie chowa się pod przyklejonym AddBar. — verified by: E2E Playwright + axe
- [ ] SEC1 (TH-01): Given lista A i domownik B bez dostępu, when B wywoła `POST`, `PATCH` lub `DELETE` na pozycjach listy A, then 404 `not_found`, pozycje bez zmian; anonim 401. Given B ma własną listę, when wywoła `PATCH /lists/<lista B>/items/<pozycja z listy A>`, then 404 i pozycja A bez zmian. — verified by: testy integracyjne `items.authz.test`
- [ ] SEC2 (TH-19): Given pozycje na wspólnej liście, when uczestnik pobierze listę lub pozycję, then `addedBy` zawiera wyłącznie `id` i `name` (bez `email`). — verified by: test integracyjny kształtu odpowiedzi
- [ ] SEC3 (TH-13): Given limit 500 (AC5) i `bodyLimit`, when bot dodaje pozycje w pętli albo wysyła notatkę ponad limit treści, then po 500 dostaje 409, a zbyt duża treść 413. — verified by: test integracyjny

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
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
