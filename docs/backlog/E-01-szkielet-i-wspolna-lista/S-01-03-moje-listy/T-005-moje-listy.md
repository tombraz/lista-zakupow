---
id: T-005
title: "Moje listy: tworzenie, przegląd, zmiana nazwy i usunięcie (web)"
epic: E-01
story: S-01-03
status: in-progress          # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given zalogowany domownik, when `POST /api/v1/lists { name }`, then 201 z listą, w której jest właścicielem; lista jest na początku `GET /api/v1/lists` z `role: "owner"`. — verified by: test integracyjny `lists.create.test`
- [x] AC2: Given nazwa pusta (po obcięciu spacji) lub 101 znaków, when tworzy lub zmienia nazwę, then 400 `validation_failed` (`fields.name`); SC-05 pokazuje „Wpisz nazwę listy” / „Nazwa listy może mieć najwyżej 100 znaków”. — verified by: test integracyjny + test komponentu SC-05
- [x] AC3: Given domownik ma 50 własnych list, when tworzy kolejną, then 409 `limit_reached` (`limit: "lists"`); SC-05 pokazuje komunikat o limicie i nieaktywny „+ Nowa lista”; given 49 list i dwa równoległe żądania, then powstaje dokładnie jedna. — verified by: testy integracyjne (w tym równoległy) + test komponentu
- [x] AC4: Given domownik jest właścicielem jednej listy i uczestnikiem innej, when `GET /api/v1/lists`, then dostaje obie, posortowane od ostatnio zmienionej, z `role`, `owner { id, name }`, `toBuyCount`, `members [{ id, name }]`; SC-05 pokazuje „od <imię>” przy udostępnionej. — verified by: test integracyjny (uczestnictwo przez fabrykę `addMember`) + test komponentu SC-05
- [x] AC5: Given brak list, when otworzy SC-05, then widzi pusty stan; stany ładowania (szkielety) i błędu („Nie udało się wczytać list.” + „Spróbuj ponownie”) działają. — verified by: test komponentu SC-05
- [x] AC6: Given właściciel, when zmieni nazwę (`PATCH`) albo usunie listę (`DELETE` po ConfirmDialog z liczbą uczestników), then nowa nazwa jest w `GET /lists/:id` i na liście list; po usunięciu lista, jej członkostwa i (później) pozycje i zaproszenia znikają (kaskada). — verified by: testy integracyjne + test komponentu SC-06 (menu, dialog)
- [x] AC7: Given `GET /api/v1/lists/:listId` dla własnej listy, when brak pozycji, then odpowiedź ma `items: []`, a SC-06 pokazuje pusty stan i AppBar z nazwą jako `h1`. — verified by: test integracyjny + test komponentu SC-06
- [x] AC8: Given SC-05 (pusty, z listami, limit, formularz z błędem) i SC-06 (pusty, brak dostępu, dialog usunięcia), when E2E je odwiedza, then axe bez naruszeń; „+ Nowa lista” przenosi fokus na pole, Esc / „Anuluj” wraca fokusem na przycisk; ConfirmDialog ma pułapkę fokusu, Esc zamyka, fokus wraca na „Więcej opcji”. — verified by: E2E Playwright + axe, testy komponentów
- [x] SEC1 (TH-01): Given lista domownika A, when domownik B wywoła `GET`, `PATCH` lub `DELETE /api/v1/lists/:listId`, then dostaje 404 `not_found` identyczne jak dla nieistniejącego `listId`, lista się nie zmienia, a `GET /api/v1/lists` B nie zawiera listy A; anonim dostaje 401 na każdej z tych tras. — verified by: testy integracyjne `lists.authz.test`
- [x] SEC2 (TH-02): Given uczestnik listy A, when wywoła `PATCH` lub `DELETE /api/v1/lists/:listId`, then 403 `owner_only`, lista bez zmian; SC-06 uczestnika nie pokazuje opcji „Zmień nazwę listy” i „Usuń listę”. — verified by: test integracyjny + test komponentu
- [x] SEC3 (TH-01): Given domownik B otwiera adres SC-06 listy A, when ekran się załaduje, then widzi tylko „Nie masz dostępu do tej listy.” i „Wróć do moich list”, bez nazwy ani treści listy. — verified by: E2E z dwoma kontami
- [x] SEC4 (TH-13): Given limit 50 list (AC3), when bot tworzy listy w pętli, then po 50 dostaje 409, a odmowa dostępu (SEC1) jest zapisana w logu `security` z identyfikatorami. — verified by: test integracyjny (log)

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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg 2026-10-28 (`/implement-task T-005`), Windows 11, Docker (Testcontainers `postgres:17.11-alpine`).

### Komendy (ten przebieg)

- `pnpm check` — Prettier, ESLint (`--max-warnings 0`), `tsc` wszystkich pakietów, jscpd **0 klonów**, dependency-cruiser **0 naruszeń** (201 modułów), design-check **0 błędów** (35 kontrastów, 0 kolorów na sztywno), backlog-check OK, Vitest **35 plików / 160 testów zielonych**.
- `pnpm build` — web i API zbudowane.
- `pnpm test:e2e` — **14/14** (telefon 390 × 844 i komputer 1280 × 800), w tym J-01 bez regresji.

### Testy z TDD planu (red → green)

| # | Plik / test | Red (pierwsze uruchomienie) | Teraz |
| --- | --- | --- | --- |
| 1 | `apps/api/test/lists.access.test.ts` (4 testy: właściciel, uczestnik, uczestnik przy `owner`, obcy = nieistniejąca = nie-UUID) | 4× `AssertionError: expected Error: not implemented to match object { code: 'not_found' }` (i analogicznie `resolves.toEqual`) na stubie | ✔ |
| 2 | `packages/shared/test/lists.test.ts` (trim, 1 i 100 znaków, emoji jak `char_length`, pusta, 101) | 3× `expected { name: '  Zakupy na tydzień  ' } to deeply equal …`, `expected {} to deeply equal { name: 'required' }`, `… { name: 'too_long' }` | ✔ |
| 3 | `apps/api/test/lists.create.test.ts` (201 z właścicielem, UUID v7; nowa lista pierwsza w `GET`) | `expected 501 to be 201` | ✔ |
| 4 | `apps/api/test/lists.validation.test.ts` (tworzenie, zmiana nazwy) | zmiana nazwy: `expected 404 to be 400`. Tworzenie przeszło od razu (walidacja weszła w zielonym kroku testu 3); spot-check: bez `validate` w `POST` → `expected 201 to be 400` | ✔ |
| 5 | `apps/api/test/lists.limit.test.ts` (409 przy 51., 2 równoległe przy 49, **20 równoległych przy 40**, liczone tylko własne, bot w pętli + log) | `expected 201 to be 409`, `expected [ 201, 201 ] to deeply equal [ 201, 409 ]`, `… length of 50 but got 52` | ✔ (3 przebiegi pod rząd) |
| 6 | `apps/api/test/lists.overview.test.ts` (własne + udostępnione, kolejność, kształt, uczestnik widzi tylko swoje, pusty) | przeszedł od razu (zapytanie przeglądu z zielonego kroku testu 3); spot-check: sortowanie rosnąco → 2 testy czerwone; bez warunku członkostwa → 3 czerwone | ✔ |
| 7 | `apps/api/test/lists.owner-actions.test.ts` (zmiana nazwy z trim i przesunięciem na górę; usunięcie z kaskadą członkostw, 204) | `expected 501 to be 200`, `expected 404 to be 204` | ✔ |
| 8 | `apps/api/test/lists.details.test.ts` (`items: []`, `members`, rola uczestnika, nowa nazwa po `PATCH`) | `expected 404 to be 200` (2×), `expected { error: { code: 'not_found' } } to match object { name: 'Nowa' }` | ✔ |
| 9 | `apps/api/test/lists.authz.test.ts` (obcy 404 = nieistniejąca = nie-UUID dla GET/PATCH/DELETE, identyczna treść; anonim 401 na 5 trasach; uczestnik 403; log `security`; obcy `Origin` 403) | `Origin`: `expected 201 to be 403`. Reszta przeszła od razu (`requireListAccess` z testów 1 i 7); spot-check: `PATCH` z rolą `member` → `expected 200 to be 403` | ✔ |
| 10 | `apps/web/src/screens/SC-05-moje-listy/ListsScreen.test.tsx` (13 testów) | pusty stan: `Unable to find an element with the text: Nie masz jeszcze żadnej listy.`; ładowanie: `expected … to have a length of 3 but got +0`, potem `toHaveAttribute("aria-busy", "true")`; błąd: `Unable to find role="alert"`; karty: `expected [ null, null ] to deeply equal [ 'Dom, 3 do kupienia', … ]`; formularz: `Unable to find role="button" and name "+ Nowa lista"`, `… role "textbox" and name "Nazwa listy"`; limit: `Unable to find an element with the text: Masz już 50 list…` (2 testy); błąd tworzenia: `Unable to find role="alert"`. Anulowanie / Esc i błędy nazwy przeszły od razu (zbudowane razem z formularzem); spot-check: bez powrotu fokusu → `toHaveFocus` czerwony; bez Esc → `expected <input …> to be null`; bez błędu pola → 2 testy czerwone | ✔ |
| 11 | `apps/web/src/screens/SC-06-lista/ListScreen.test.tsx` (15 testów) | nagłówek / pusty: `Unable to find … Lista jest pusta…`; ładowanie: `toHaveAttribute("aria-busy", "true")`; błąd: `Unable to find role="alert"`; brak dostępu: `Unable to find role="heading" and name "Nie masz dostępu do tej listy."`; menu: `Unable to find role="button" and name "Więcej opcji"`; arkusz: 3× `Unable to find an accessible element with the role "dialog" and name "Zmień nazwę listy"`; dialog usunięcia: 5× `… role "alertdialog"`; błąd usunięcia: `Unable to find role="alert"`. Test uczestnika przeszedł trywialnie (menu jeszcze nie było); spot-check po zbudowaniu menu: menu dla każdej roli → `expected <button …> to be null` | ✔ |
| 12 | `apps/web/e2e/j02-listy.spec.ts` (J-02; SEC3 dwa konta; limit 50) | napisany po zachowaniu na szybszych seamach (Step 6); spot-check: bez pułapki fokusu w `Modal` → J-02 czerwony (`toBeFocused` na „Usuń listę” w oknie) | ✔ 6/6 |

Testy dopisane do planu w trakcie (zachowania, których plan nie wymieniał):

- 9 — obcy `Origin` dla `POST` / `PATCH` / `DELETE` (TH-14). Przewodnik backendu wymaga sprawdzenia `Origin` dla żądań zmieniających stan, a to pierwsze takie trasy w `/api/v1`.
- 5 — 20 równoległych żądań. Wersja z dwoma żądaniami przechodziła **także bez** `FOR UPDATE` (`inject` praktycznie ich nie nakłada). Spot-check: bez blokady 20 żądań daje 51 list (`expected … to have a length of 10 but got 11`), z blokadą 3/3 zielone.
- 10 — nieudane utworzenie (500): komunikat „Nie udało się utworzyć listy. Spróbuj ponownie.”, nazwa zostaje w polu.
- 11 — nieudane usunięcie (500): komunikat w oknie, okno zostaje otwarte.
- `apps/web/src/queryClient.test.ts` — `shouldRetry`: ponawiane tylko błędy sieci i 5xx; 404 (brak dostępu) od razu, inaczej SC-06 pokazywałby „brak dostępu” dopiero po ~7 s ponowień. Spot-check: odwrócona reguła → 2 testy czerwone.

Zmiana istniejącego testu: `apps/api/test/body-limit.test.ts` (T-001) używał `/api/v1/lists` jako trasy, której nie było (404), i nie wysyłał `Origin`. Teraz wysyła zaufany `Origin`, a żądanie „pod limitem” dochodzi do trasy i dostaje 401 zamiast 404. Sens testu (413 powyżej 16 kB) bez zmian. `security-log.test.ts` korzysta teraz ze wspólnego `test/logs.ts` (bez zmiany asercji).

### Kryteria akceptacji

- **AC1** — `lists.create.test` (201, `role: "owner"`, lista pierwsza w `GET`); SC-05 „creates the list from the empty state and opens it”; E2E J-02.
- **AC2** — `lists.validation.test` (400 `validation_failed`, `fields.name` `required` / `too_long` przy tworzeniu i zmianie nazwy, nic nie zapisane); `packages/shared/test/lists.test.ts`; SC-05 „explains a blank or too long name…”, „shows the name error the API returns”; SC-06 „explains a blank name…”; E2E (formularz z błędem + axe).
- **AC3** — `lists.limit.test` (409 `limit_reached` z `limit: "lists"`, równoległe przy 49 i przy 40, liczone tylko własne); SC-05 „limit of 50 own lists” (3 testy); E2E „SC-05 at 50 own lists…” + axe.
- **AC4** — `lists.overview.test` (obie listy, `updated_at DESC`, `role`, `owner`, `toBuyCount`, `members`; uczestnictwo fabryką `addMember`); SC-05 „shows own and shared lists as links…” („od Tomek”, nazwa dostępna „Działka, udostępniona przez Tomek, 0 do kupienia”).
- **AC5** — SC-05: pusty stan, 3 szkielety z `aria-busy`, błąd „Nie udało się wczytać list.” + „Spróbuj ponownie”.
- **AC6** — `lists.owner-actions.test` (nowa nazwa w `GET /lists`, kaskada `list_member`), `lists.details.test` (nowa nazwa w `GET /lists/:id`); SC-06: arkusz, dialog z liczbą uczestników, usunięcie → SC-05; E2E J-02.
- **AC7** — `lists.details.test` (`items: []`); SC-06 „shows the list name as h1 and the empty state”.
- **AC8** — E2E J-02, SEC3 i limit: axe bez naruszeń dla SC-05 (pusty, z listami, limit, formularz z błędem) i SC-06 (pusty, arkusz zmiany nazwy, dialog usunięcia, brak dostępu). Fokus: „Utwórz pierwszą listę” → pole, Esc → z powrotem na przycisk; ConfirmDialog: fokus na „Anuluj”, Tab zostaje w oknie, Esc zamyka, fokus na „Więcej opcji”. Komponenty: SC-05 „opens in place of the button…”, „closes on „Anuluj” or Esc…”; SC-06 menu, arkusz i dialog (Tab / Shift+Tab).
- **SEC1** — `lists.authz.test` „answers someone else's list exactly like a list that does not exist” (GET / PATCH / DELETE: obcy, losowy UUID i „nie-uuid” — ten sam 404 `not_found` i identyczna treść; nazwa bez zmian; `GET /lists` B pusty) oraz „answers 401 to an anonymous request on every list route” (5 tras).
- **SEC2** — `lists.authz.test` „refuses a participant…” (403 `owner_only`, nazwa bez zmian), `lists.access.test`; SC-06 „does not offer a participant rename or delete”.
- **SEC3** — E2E „SEC3 another account sees no content of someone else's list” (dwa konteksty przeglądarki: tylko „Nie masz dostępu do tej listy.” i „Wróć do moich list”, nazwy listy brak, „Więcej opcji” brak, axe).
- **SEC4** — `lists.limit.test` „stops a bot creating lists in a loop after 50…” (50 × 201, potem 409; log `security` `limit_reached` z `userId`, bez nazwy listy); `lists.authz.test` „logs a refused access…” (`list_access_denied` z `userId`, `listId`, `requestId`; nazwa listy nie trafia do logu).

### Decyzje do wglądu QA

- **`Origin` w `/api/v1/*` (TH-14):** hook `http/trusted-origin.ts` odrzuca `POST` / `PATCH` / `DELETE` z `Origin` innym niż `APP_ORIGIN`, **także bez nagłówka `Origin`** (przeglądarki wysyłają go przy tych metodach). Klient bez `Origin` (np. aplikacja mobilna w E-04) będzie wymagał decyzji w swoim tasku.
- **`members` w `GET /lists/:listId`:** dopisane do kontraktu (`api.md`), bo okno usunięcia pokazuje liczbę uczestników.
- **Teksty agenta (brak w tabelach „Copy”):** okno usunięcia przy 0 uczestników — „Tego nie można cofnąć.” (zamiast „Zniknie też u 0 uczestników.”); przy 1 — „Zniknie też u 1 uczestnika.”; nieudane utworzenie — „Nie udało się utworzyć listy. Spróbuj ponownie.”; nieudane usunięcie i zmiana nazwy — Copy SC-06 `saveError`. Tytuł arkusza „Zmień nazwę listy” (jak pozycja menu), przycisk „Zapisz” (`edit.save`). Na ekranie „brak dostępu” `h1` to „Nie masz dostępu do tej listy.”.
- **Karta listy:** zawsze „N do kupienia”; „Wszystko kupione” (`card.allBought`) dopiero z pozycjami (T-006 / T-007) — dziś nie da się odróżnić pustej listy od listy, na której wszystko kupiono.
- **Menu „Więcej opcji”:** wzorzec disclosure (przycisk z `aria-expanded` + lista przycisków), nie `role="menu"` ze strzałkami. Uczestnik nie widzi przycisku wcale, bo „Opuść listę” to E-02 (F-13).
- **Dialogi:** własny `Modal` (portal, `aria-modal`, pułapka Tab, Esc, powrót fokusu) zamiast `<dialog>.showModal()` — jsdom go nie obsługuje, więc testy komponentów nie mogłyby sprawdzić zachowania.
- **UUID v7:** `src/db/uuid.ts` (PostgreSQL 17 nie ma `uuidv7()`), zgodnie z „Identyfikatory: UUID (v7)” w `architecture.md`.
- **Ponawianie zapytań:** `createQueryClient()` ponawia tylko błędy sieci i 5xx (wcześniej domyślnie każdy błąd 3×).
- **Poza zakresem (zgodnie z taskiem):** zdarzenia na żywo i komunikat „Lista została usunięta albo nie masz już do niej dostępu” (T-009); pole dodawania i fokus na nim po utworzeniu listy (T-006); ikona „Uczestnicy” (T-008); OfflineBanner (E-02).
- **Obserwacja:** pierwszy przebieg testów web po zimnym starcie raz oblał 3 testy (w tym istniejące SC-01) na limicie `findBy` 1 s; kolejne 4 przebiegi zielone. Do obserwacji w CI.

### Przewodniki warstw (Step 8b)

Uzupełnione „Gdzie jest kod” w `layers/db.md`, `layers/backend.md`, `layers/web.md` (nowe pliki, helpery testów, fabryki `createList(pool, owner)` / `addMember(pool, list, user)`) oraz `api.md` („Stan po T-005”, `members` w szczegółach). Bez zmian w „Conventions”.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-28)

Verdict: fail

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | major | backend (bezpieczeństwo, błędy) | Nieoczekiwany błąd w trasach `/api/v1/lists*` wraca do klienta z treścią wyjątku: zapytanie SQL i jego parametry (id listy, `owner_id`, nazwa). `apiErrors` przekazuje nieznane błędy do domyślnego handlera Fastify, a ten dla 500 wysyła `message`. Wywołać to może każdy zalogowany: nazwa z `\u0000` przechodzi przez `listNameRequestSchema`, a PostgreSQL odrzuca ją przy `INSERT`. Ten sam komunikat z parametrami (w tym nazwą listy) trafia do logu, wbrew „logi bez nazw list” z QA planu. Rejestracja przy tym samym wejściu odpowiada bezpiecznie (`{"error":{"code":"internal"}}`). | `POST /api/v1/lists {"name":"a\u0000b"}` → `500 {"statusCode":500,"error":"Internal Server Error","message":"Failed query: insert into \"shopping_list\" (\"id\", \"owner_id\", \"name\", …) values ($1, $2, $3, default, default) returning \"id\"\nparams: 01a18209-…,q0NnyP9B…,a\u0000b"}`; w logu serwera `err.message` z tymi samymi parametrami. SC-05 pokazuje wtedy „Nie udało się utworzyć listy. Spróbuj ponownie.” | CODING_STANDARDS.md, „Obsługa błędów”: „Nieoczekiwany błąd: 500 z `requestId`, szczegóły tylko w logu”. Handler zwraca `500 {"error":{"code":"internal"}}` z `requestId`, bez treści wyjątku, i ma na to test (np. trasa testowa albo awaria repozytorium). Schemat nazwy odrzuca znaki, których baza nie przyjmie (NUL), z 400 `validation_failed`, i ma na to test w `packages/shared/test/lists.test.ts`. Do logu trafiają identyfikatory, nie parametry zapytania z nazwą listy. |
| 2 | minor | web (dostępność) | SC-06 w stanach ładowania i błędu ma pusty `h1` (`AppBar title=""`) i tytuł karty „· Wspólna lista zakupów”. AC8 nie obejmuje tych stanów, więc E2E tego nie łapie. | axe `empty-heading` (best practice) na SC-06 w ładowaniu i po błędzie; zestaw WCAG bez naruszeń. Zrzut stanu błędu: pasek z samym „← Wstecz”. | Nagłówek nie jest pusty, np. `h1` „Lista” albo tekst błędu, dopóki nazwa nieznana, i taki sam tytuł karty. |
| 3 | minor | backend (DRY) | Reguła „kto jest właścicielem” jest zapisana dwa razy: w SQL `roleOf` (`CASE WHEN owner_id = …`) i w `viewOf` (`list.owner.id === userId`). | `infra/lists-repository.ts:12`, `domain/lists.ts:63` | Jedno miejsce wyznaczania roli, np. `listsOf` zwraca rolę z repozytorium albo `roleOf` korzysta z tej samej reguły. |
| 4 | note | backend (API) | Treść `[]` albo brak treści daje `400 validation_failed` z `fields: {}`. Klient nie ma wtedy błędu pola do pokazania. | `POST /api/v1/lists` z `[]` → `{"error":{"code":"validation_failed","fields":{}}}` | Do rozważenia: `fields.name: "required"` dla treści, która nie jest obiektem. |
| 5 | note | domena (F-05) | Nazwa złożona tylko ze znaku o zerowej szerokości (`​`) jest przyjmowana, bo `trim()` go nie usuwa. Lista ma wtedy na ekranie pustą nazwę. | `POST {"name":"​"}` → 201 | Do rozważenia razem z #1: normalizacja w schemacie (znaki niewidoczne / sterujące). |
| 6 | note | backend (YAGNI) | `createLists(pool)` w `modules/listy/index.ts` używa dziś tylko `lists.access.test.ts`. To seam z TDD planu (test 1), a `pozycje` w T-006 skorzysta z `requireListAccess`, więc to nie nadmiar. | `grep createLists` | Bez zmian, jeśli T-006 tego użyje. |

**Co sprawdziłem i przeszło**

- Czysta instalacja (`pnpm install --frozen-lockfile`) i `pnpm check`: Prettier, ESLint, `tsc`, jscpd 0 klonów, dependency-cruiser 0 naruszeń (201 modułów), design-check 0 błędów, backlog-check, Vitest **35 plików / 160 testów** zielonych. `pnpm build` OK. `pnpm test:e2e` **14/14** (telefon i komputer), w tym J-01 bez regresji. Instalacja i build nie zmieniły śledzonych plików.
- Spot-checki (każdy cofnięty, `git status` czysty): wyłączenie reguły `owner` w `requireListAccess` → 3 testy czerwone (`lists.access`, `lists.authz` ×2); usunięcie `.for("update")` → test 20 równoległych żądań czerwony; menu właściciela dla każdej roli na SC-06 → test uczestnika czerwony; przegląd bez warunku członkostwa → 3 testy `lists.overview` czerwone.
- Red evidence jest dla każdego testu z planu. Testy, które przeszły od razu, mają opisany spot-check. Testy sprawdzają zachowanie na uzgodnionych seamach (`inject`, funkcja modułu, RTL + MSW), a wartości oczekiwane są literałami.
- AC1–AC8 i SEC1–SEC4: **pass** (testy przeczytane, zachowanie sprawdzone ręcznie). AC2 i SEC1 przechodzą w swoim zakresie, ale znalezisko #1 dotyczy wejścia, którego kryteria nie wymieniają.
- TH-01 (curl, drugie konto): `GET` / `PATCH` / `DELETE` cudzej listy dają bajt w bajt taką samą odpowiedź `404 {"error":{"code":"not_found"}}` jak losowy UUID. `HEAD` też 404. UUID wielkimi literami nie omija sprawdzenia. Nieprawidłowa treść `PATCH` daje 400 i dla cudzej, i dla nieistniejącej listy (walidacja przed dostępem, więc nic nie wycieka). Lista A bez zmian, `GET /lists` B pusty. Anonim dostaje 401. W logu `security` jest `list_access_denied` z `userId` i `listId`, bez nazwy listy.
- TH-02: uczestnik (dodany do `list_member` w bazie) nie widzi „Więcej opcji”. API z rolą uczestnika daje 403 `owner_only` (testy i spot-check).
- TH-13: 51. lista daje 409. Treść ponad 16 kB daje 413. Dodatkowe pola (`ownerId`, `id`) są ignorowane. `Origin` obcy, z końcowym `/` albo bez nagłówka daje 403 `invalid_origin`.
- Przypadki brzegowe: obcięte spacje, dokładnie 100 znaków, 100 emoji (201) i 101 (400), polskie znaki, HTML / SQL w nazwie zapisane dosłownie. Podwójne kliknięcie „Utwórz” i podwójny Enter tworzą jedną listę. Ponowne `DELETE` daje 404.
- UI (Chromium 390 px i 320 px, Firefox): wszystkie stany SC-05 (pusty, ładowanie, błąd + „Spróbuj ponownie”, limit, błędy nazwy, nieudane utworzenie z zachowaną nazwą, brak sieci) i SC-06 (pusty, ładowanie, błąd, brak dostępu). Lista usunięta przy otwartej drugiej karcie właściciela i u uczestnika po odświeżeniu pokazuje „Nie masz dostępu do tej listy.”, a SC-05 uczestnika jest pusty. Wygasła sesja na SC-06 → SC-01. Okno usunięcia: „Zniknie też u 1 uczestnika.”, fokus na „Anuluj”, pułapka Tab (Chromium i Firefox), Esc wraca na „Więcej opcji”. Esc w arkuszu i menu wraca na „Więcej opcji”. Karta uczestnika: „od Ania”, nazwa dostępna „Enter, udostępniona przez Ania, 0 do kupienia”. 320 px i tekst 200 %: bez przewijania w poziomie (SC-05 z formularzem, SC-06 z menu i arkuszem). Cele ≥ 48 px. Przy „ogranicz ruch” szkielety bez animacji. axe (WCAG 2.2 AA) bez naruszeń także dla stanów ładowania i błędu SC-05 i SC-06. CSP blokuje wstrzyknięte style inline.
- Nie sprawdziłem: Safari (iOS) i czytnik ekranu na urządzeniu. Brak narzędzi w tym środowisku.

**Do zmiany przed kolejną rundą**

1. #1: jeden handler dla nieoczekiwanych błędów w `/api/v1/*`, który zwraca `500 {"error":{"code":"internal"}}` z `requestId` i loguje wyjątek bez parametrów zapytania z treścią użytkownika. Test integracyjny, który to udowadnia. Odrzucenie NUL (i rozważenie innych znaków sterujących) w `listNameRequestSchema` z testem jednostkowym i integracyjnym (400 `validation_failed`, `fields.name`).
2. #2 i #3 opcjonalnie w tej samej rundzie (minor).
