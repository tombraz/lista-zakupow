---
id: T-005
title: "Moje listy: tworzenie, przegląd, zmiana nazwy i usunięcie (web)"
epic: E-01
story: S-01-03
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-004]
size: M                # S | M (L must be split)
layers: [db, backend, web]
requirements: [F-05, F-06, N-02, N-04]
threats: [TH-01, TH-02, TH-13]
screens: [SC-05, SC-06]
---

# T-005 Moje listy: tworzenie, przegląd, zmiana nazwy i usunięcie (web)

## Goal

Zalogowany domownik widzi swoje listy (pusty stan, gdy ich nie ma), tworzy nową, a jako właściciel zmienia jej nazwę i ją usuwa. Dostęp do listy sprawdza jedna funkcja `requireListAccess`; cudza lista jest nie do odróżnienia od nieistniejącej.

## Demo

1. Nowe konto: SC-05 pokazuje „Nie masz jeszcze żadnej listy.” i „Utwórz pierwszą listę”.
2. „Utwórz pierwszą listę” → pole „Nazwa listy” → „Utwórz” → SC-06 nowej listy (pusty stan „Lista jest pusta…”; pole dodawania przychodzi w T-006).
3. Na SC-06 „Więcej opcji” → „Zmień nazwę listy” → nowa nazwa widoczna w AppBar i na SC-05; „Usuń listę” → potwierdzenie → powrót na SC-05 bez tej listy.
4. Drugie konto wpisuje adres listy pierwszego: „Nie masz dostępu do tej listy.” bez żadnej treści.

## Context

- BRD: F-05 — „nazwa 1–100 znaków, limit 50 list (liczone własne), tylko właściciel zmienia nazwę i usuwa, usunięcie po potwierdzeniu”; F-06 — „widzi własne i udostępnione; pusty stan; brak dostępu nie pokazuje zawartości (MC-01)”.
- Architektura: moduł `listy` z `requireListAccess(userId, listId, rola)`, tabela autoryzacji, konwencje błędów (404 dla braku dostępu, 403 `owner_only`, 409 `limit_reached`), `api.md` „Listy”, `data-model.md` (`shopping_list`, `list_member`, limit z `SELECT … FOR UPDATE`, kolejność `updated_at DESC`, kaskady).
- Design: SC-05 (wszystkie stany), SC-06 — AppBar z nazwą, menu „Więcej opcji” (właściciel: zmień nazwę, usuń listę), stany Empty, Loading, Error — wczytanie, No permission; ConfirmDialog, BottomSheet (zmiana nazwy), ListCard, EmptyState, Loading, Avatar.
- Depends on: T-004 — sesja, `requireUser()`, fabryki `createUser` / `signIn`, chroniony routing web.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given zalogowany domownik, when `POST /api/v1/lists { name }`, then 201 z listą, w której jest właścicielem; lista jest na początku `GET /api/v1/lists` z `role: "owner"`. — verified by: test integracyjny `lists.create.test`
- [ ] AC2: Given nazwa pusta (po obcięciu spacji) lub 101 znaków, when tworzy lub zmienia nazwę, then 400 `validation_failed` (`fields.name`); SC-05 pokazuje „Wpisz nazwę listy” / „Nazwa listy może mieć najwyżej 100 znaków”. — verified by: test integracyjny + test komponentu SC-05
- [ ] AC3: Given domownik ma 50 własnych list, when tworzy kolejną, then 409 `limit_reached` (`limit: "lists"`); SC-05 pokazuje komunikat o limicie i nieaktywny „+ Nowa lista”; given 49 list i dwa równoległe żądania, then powstaje dokładnie jedna. — verified by: testy integracyjne (w tym równoległy) + test komponentu
- [ ] AC4: Given domownik jest właścicielem jednej listy i uczestnikiem innej, when `GET /api/v1/lists`, then dostaje obie, posortowane od ostatnio zmienionej, z `role`, `owner { id, name }`, `toBuyCount`, `members [{ id, name }]`; SC-05 pokazuje „od <imię>” przy udostępnionej. — verified by: test integracyjny (uczestnictwo przez fabrykę `addMember`) + test komponentu SC-05
- [ ] AC5: Given brak list, when otworzy SC-05, then widzi pusty stan; stany ładowania (szkielety) i błędu („Nie udało się wczytać list.” + „Spróbuj ponownie”) działają. — verified by: test komponentu SC-05
- [ ] AC6: Given właściciel, when zmieni nazwę (`PATCH`) albo usunie listę (`DELETE` po ConfirmDialog z liczbą uczestników), then nowa nazwa jest w `GET /lists/:id` i na liście list; po usunięciu lista, jej członkostwa i (później) pozycje i zaproszenia znikają (kaskada). — verified by: testy integracyjne + test komponentu SC-06 (menu, dialog)
- [ ] AC7: Given `GET /api/v1/lists/:listId` dla własnej listy, when brak pozycji, then odpowiedź ma `items: []`, a SC-06 pokazuje pusty stan i AppBar z nazwą jako `h1`. — verified by: test integracyjny + test komponentu SC-06
- [ ] AC8: Given SC-05 (pusty, z listami, limit, formularz z błędem) i SC-06 (pusty, brak dostępu, dialog usunięcia), when E2E je odwiedza, then axe bez naruszeń; „+ Nowa lista” przenosi fokus na pole, Esc / „Anuluj” wraca fokusem na przycisk; ConfirmDialog ma pułapkę fokusu, Esc zamyka, fokus wraca na „Więcej opcji”. — verified by: E2E Playwright + axe, testy komponentów
- [ ] SEC1 (TH-01): Given lista domownika A, when domownik B wywoła `GET`, `PATCH` lub `DELETE /api/v1/lists/:listId`, then dostaje 404 `not_found` identyczne jak dla nieistniejącego `listId`, lista się nie zmienia, a `GET /api/v1/lists` B nie zawiera listy A; anonim dostaje 401 na każdej z tych tras. — verified by: testy integracyjne `lists.authz.test`
- [ ] SEC2 (TH-02): Given uczestnik listy A, when wywoła `PATCH` lub `DELETE /api/v1/lists/:listId`, then 403 `owner_only`, lista bez zmian; SC-06 uczestnika nie pokazuje opcji „Zmień nazwę listy” i „Usuń listę”. — verified by: test integracyjny + test komponentu
- [ ] SEC3 (TH-01): Given domownik B otwiera adres SC-06 listy A, when ekran się załaduje, then widzi tylko „Nie masz dostępu do tej listy.” i „Wróć do moich list”, bez nazwy ani treści listy. — verified by: E2E z dwoma kontami
- [ ] SEC4 (TH-13): Given limit 50 list (AC3), when bot tworzy listy w pętli, then po 50 dostaje 409, a odmowa dostępu (SEC1) jest zapisana w logu `security` z identyfikatorami. — verified by: test integracyjny (log)

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `/api/v1/lists*` przez `fastify.inject`; domena `listy` (reguły ról) przez funkcje modułu
- ekrany SC-05 i SC-06 z API podstawionym przez MSW

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `requireListAccess`: właściciel, uczestnik, obcy, nieistniejąca lista, rola `owner` | integration | Vitest + Testcontainers (funkcja modułu `listy` na prawdziwej bazie) | SEC1, SEC2 |
| 2 | schemat nazwy listy (trim, 1–100) | unit | Vitest | AC2 |
| 3 | utworzenie listy i obecność w przeglądzie | integration | Vitest + Testcontainers | AC1 |
| 4 | walidacja nazwy (tworzenie, zmiana) | integration | Vitest + Testcontainers | AC2 |
| 5 | limit 50 i równoległe tworzenie przy 49 | integration | Vitest + Testcontainers | AC3, SEC4 |
| 6 | przegląd: własne + udostępnione, kolejność, kształt | integration | Vitest + Testcontainers | AC4 |
| 7 | zmiana nazwy i usunięcie przez właściciela (kaskada członkostw) | integration | Vitest + Testcontainers | AC6 |
| 8 | szczegóły listy z `items: []` | integration | Vitest + Testcontainers | AC7 |
| 9 | autoryzacja: obcy 404 (= nieistniejąca), anonim 401, uczestnik 403 | integration | Vitest + Testcontainers | SEC1, SEC2 |
| 10 | SC-05: pusty, ładowanie, błąd, lista kart, formularz, limit, fokus | component | Vitest + RTL + MSW | AC2–AC5, AC8 |
| 11 | SC-06: nagłówek, pusty stan, menu właściciela / uczestnika, dialog usunięcia, brak dostępu | component | Vitest + RTL + MSW | AC6–AC8, SEC2 |
| 12 | E2E J-02: utworzenie, zmiana nazwy, usunięcie; drugie konto na obcym adresie; axe | E2E | Playwright + axe | AC8, SEC3 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów. Baza prawdziwa; domeny nie mockujemy.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** nazwa ze spacjami na brzegach (obcięte), dokładnie 100 znaków, polskie znaki i emoji; 50. i 51. lista; podwójne kliknięcie „Utwórz”; usunięcie listy otwartej w drugiej karcie (odświeżenie → brak dostępu).
- **Design states:** SC-05: pusty, ładowanie, błąd, limit, błąd nazwy, sukces; SC-06: pusty, ładowanie, błąd, brak dostępu.
- **Platforms / devices:** Chrome i Firefox na komputerze, Safari i Chrome na telefonie; 320 px i 200 %.
- **Accessibility:** klawiatura (formularz w miejscu przycisku, dialog, arkusz zmiany nazwy); czytnik ekranu: karty jako linki z pełną nazwą, `h1`; cele ≥ 48 px.
- **Security / privacy:** TH-01 — drugie konto: podmiana `listId` w adresie i w żądaniach `PATCH` / `DELETE` (DevTools / curl), porównanie odpowiedzi z nieistniejącym UUID; TH-02 — uczestnik (dodany fabryką lub przez T-008, gdy gotowe) próbuje zmienić nazwę przez API; logi bez nazw list.
- **Regression:** J-01 z T-004 (logowanie, wylogowanie, przekierowania).

## Implementation notes

- Trasa: walidacja → `requireListAccess` → domena → mapowanie; żadnych warunków `owner_id === …` w trasach.
- Limit 50 w transakcji z `SELECT … FOR UPDATE` na wierszu `user`; stałe limitów i długości w `packages/shared`.
- Typowane błędy domenowe z `code` i jeden handler HTTP (wzorzec dla wszystkich kolejnych modułów).
- Fabryki `createList(owner)` i `addMember(list, user)` w `apps/api/test/factories.ts` (członkostwo bezpośrednio w bazie do czasu T-008).
- `toBuyCount` liczony z pozycji (0, dopóki T-006 ich nie doda); kształt odpowiedzi od razu pełny wg `api.md`.
- Publikacja zdarzeń na żywo (`list.updated`, `list.deleted`, `lists.changed`) — T-009.
- Skill `postgres-best-practices:supabase-postgres-best-practices` przy migracji i zapytaniach z blokadą.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
