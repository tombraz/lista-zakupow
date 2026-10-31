---
id: T-007
title: Odhaczanie, „kto kupił” i usuwanie kupionych (web)
epic: E-01
story: S-01-04
status: done           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-006]
size: S                # S | M (L must be split)
layers: [db, backend, web]
requirements: [F-08, F-09, F-10, N-04]
threats: [TH-01]
screens: [SC-05, SC-06]
---

# T-007 Odhaczanie, „kto kupił” i usuwanie kupionych (web)

## Goal

W sklepie domownik odhacza pozycję (przechodzi do zwiniętej sekcji „Kupione” z podpisem, kto kupił), odznacza ją z powrotem i po zakupach usuwa wszystkie kupione naraz. Każde odhaczenie zapisuje aktywność dzienną listy — dane do miar sukcesu z BRD §10.

## Demo

1. Lista z „Mleko”, „Chleb”, „Jajka”: odhaczam „Chleb” → znika z „do kupienia”, licznik „2 do kupienia” się zmienia, sekcja „Kupione (1)”; fokus na checkboxie następnej pozycji.
2. Rozwijam „Kupione (1)”: „Chleb” przekreślony, „kupił(a) <moje imię>”; odznaczam → wraca na górę „do kupienia” z „dodał(a) …”.
3. Dodaję „chleb”, gdy „Chleb” jest kupiony → „„Chleb” jest już na liście jako kupione. Odznacz tę pozycję…” + „Pokaż” rozwija sekcję i przewija do pozycji.
4. „Usuń wszystkie kupione” → „Usunąć 2 kupionych pozycji?” → kupione znikają, nieodhaczone zostają; na SC-05 karta pokazuje „1 do kupienia” albo „Wszystko kupione”.

## Context

- BRD: F-08 — „odhaczona zostaje jako przekreślona pod nieodhaczonymi; odznaczenie przywraca; „usuń odhaczone” usuwa wszystkie odhaczone”; F-10 — „przy odhaczonej widać, kto odhaczył”; F-09 — „przy duplikacie odhaczonej pozycji jedyną drogą jest jej odznaczenie”; BRD §10 — „dni z ≥ 3 odhaczonymi pozycjami na wspólnej liście, aktywni uczestnicy tygodniowo”.
- Architektura: `api.md` „Pozycje” (`PATCH { checked }`, `POST …/items/clear-checked` → `{ deletedIds }`), moduł `statystyki`, `data-model.md` (`checked_at`, `checked_by`, `list_daily_activity`, kolejność kupionych `checked_at DESC`), wstrzykiwany zegar.
- Design: SC-06 — checkbox ItemRow (odhaczona), CollapsibleSection „Kupione (N)” (domyślnie zwinięta), „Usuń wszystkie kupione” + ConfirmDialog, stan „Wszystko kupione.”, `dup.bought` + „Pokaż”, linia „N do kupienia” (`polite`), ogłoszenie „Odhaczono <nazwa>”, „ogranicz ruch”; SC-05 — ListCard `card.toBuy` / `card.allBought`.
- Depends on: T-006 — pozycje, `Item`, AddBar z ostrzeżeniem duplikatu, ItemRow.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given nieodhaczona pozycja, when `PATCH …/items/:itemId { checked: true }`, then 200 `Item` z `checked: true`, `checkedBy { id, name }`, `checkedAt`; given odhaczona, when `{ checked: false }`, then `checked: false`, `checkedBy: null`. — verified by: test integracyjny `items.check.test`
- [x] AC2: Given lista z pozycjami, when ekran SC-06 się odświeży po odhaczeniu, then pozycja jest w „Kupione (N)” (sekcja domyślnie zwinięta, kupione od ostatnio odhaczonej), przekreślona, z „kupił(a) <imię>”; linia stanu pokazuje nowy licznik; checkbox ma nazwę dostępną „Odhacz <nazwa>” / „Odznacz <nazwa>” i stan zapisywania do odpowiedzi API. — verified by: test komponentu SC-06
- [x] AC3: Given odhaczenie z klawiatury, when zapis się powiedzie, then fokus przechodzi na checkbox następnej nieodhaczonej pozycji (albo poprzedniej, gdy to była ostatnia), a region `polite` ogłasza „Odhaczono <nazwa>”; przy „ogranicz ruch” brak animacji przeniesienia. — verified by: test komponentu + E2E (emulacja `prefers-reduced-motion`)
- [x] AC4: Given 2 odhaczone i 1 nieodhaczona, when `POST …/items/clear-checked` (po ConfirmDialog „Usunąć 2 kupionych pozycji?”), then 200 `{ deletedIds }` z dwoma identyfikatorami, nieodhaczona zostaje; brak nieodhaczonych pokazuje „Wszystko kupione.” — verified by: test integracyjny + test komponentu
- [x] AC5: Given odhaczona pozycja „Chleb”, when ktoś dodaje „chleb”, then SC-06 pokazuje `dup.bought` z przyciskiem „Pokaż”, który rozwija „Kupione” i przenosi fokus na tę pozycję. — verified by: test komponentu SC-06
- [x] AC6: Given odhaczenia trzech pozycji przez domownika jednego dnia (zegar wstrzyknięty), when sprawdzę `list_daily_activity`, then jest jeden wiersz (lista, dzień, domownik) z `checks = 3`; odznaczenie nie zmniejsza licznika; następny dzień daje nowy wiersz. — verified by: test integracyjny modułu `statystyki` przez API
- [x] AC7: Given SC-05 po zmianach, when lista ma nieodhaczone / tylko odhaczone pozycje, then karta pokazuje „N do kupienia” / „Wszystko kupione”. — verified by: test integracyjny `toBuyCount` + test komponentu SC-05
- [x] AC8: Given SC-06 z rozwiniętą i zwiniętą sekcją „Kupione”, z dialogiem „Usuń wszystkie kupione”, when E2E je odwiedza, then axe bez naruszeń; dwie listy `ul` z nagłówkami „Do kupienia” (wizualnie ukryty) i „Kupione”. — verified by: E2E Playwright + axe
- [x] SEC1 (TH-01): Given lista A i domownik B bez dostępu, when B wywoła `PATCH { checked }` na pozycji A albo `POST /lists/<A>/items/clear-checked`, then 404, nic nie zostaje odhaczone ani usunięte, aktywność się nie zmienia; anonim 401. — verified by: testy integracyjne `items.check.authz.test`

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `PATCH …/items/:itemId` (`checked`) i `POST …/items/clear-checked` przez `fastify.inject`
- ekrany SC-06 i SC-05 z API podstawionym przez MSW

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | odhaczenie i odznaczenie: pola `checked*` | integration | Vitest + Testcontainers | AC1 |
| 2 | kolejność kupionych i `toBuyCount` w przeglądzie list | integration | Vitest + Testcontainers | AC2, AC7 |
| 3 | usuń kupione: `deletedIds`, nieodhaczone zostają | integration | Vitest + Testcontainers | AC4 |
| 4 | aktywność dzienna: licznik, odznaczenie, nowy dzień (zegar) | integration | Vitest + Testcontainers | AC6 |
| 5 | autoryzacja: obcy 404, anonim 401, brak skutków | integration | Vitest + Testcontainers | SEC1 |
| 6 | SC-06: odhaczenie (zapisywanie, sekcja, podpis, licznik), fokus i ogłoszenie | component | Vitest + RTL + MSW | AC2, AC3 |
| 7 | SC-06: usuń kupione z dialogiem; „Wszystko kupione.” | component | Vitest + RTL + MSW | AC4 |
| 8 | SC-06: `dup.bought` + „Pokaż” | component | Vitest + RTL + MSW | AC5 |
| 9 | SC-05: „N do kupienia” / „Wszystko kupione” | component | Vitest + RTL + MSW | AC7 |
| 10 | E2E J-03 (reszta): dodanie, duplikat kupionej, odhaczenie, usuń kupione; axe; reduced motion | E2E | Playwright + axe | AC3, AC8 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** zegar (aktywność dzienna); API tylko w testach komponentów. Baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** odhaczenie ostatniej nieodhaczonej (fokus na poprzedniej / „Wszystko kupione.”); szybkie wielokrotne klikanie checkboxa; usuń kupione przy 0 kupionych (przycisk niewidoczny lub nieaktywny); odhaczenie około północy (dzień w strefie `Europe/Warsaw`? — sprawdzić, jaką datę zapisuje `day`, i zanotować).
- **Design states:** SC-06: kupione zwinięte / rozwinięte, wszystko kupione, zapisywanie, błąd zapisu (pozycja wraca do stanu sprzed zmiany); SC-05: karta z „Wszystko kupione”.
- **Platforms / devices:** telefon (Safari, Chrome) — cele ≥ 48 px, wiersz ≥ 60 px; komputer (Chrome, Firefox); 320 px i 200 %.
- **Accessibility:** klawiatura (spacja na checkboxie, fokus po odhaczeniu), czytnik ekranu (stan zaznaczenia, ogłoszenia, nagłówki list), „ogranicz ruch”.
- **Security / privacy:** TH-01 — drugie konto: odhaczenie i usuwanie kupionych na cudzej liście przez API; `checkedBy` bez e-maila.
- **Regression:** T-006 (dodawanie, duplikat nieodhaczonej, edycja, usunięcie), T-005 (przegląd list, kolejność).

## Implementation notes

- `checked_at`, `checked_by`, `updated_at` ustawiane wstrzykiwanym zegarem; odznaczenie czyści `checked_at` i `checked_by`.
- Zapis aktywności w tej samej transakcji co odhaczenie, przez funkcję modułu `statystyki` z jego `index.ts` (granice modułów, `CODING_STANDARDS.md`).
- Strefa czasowa dla `day`: ustalić w tasku (propozycja `Europe/Warsaw`, bo pilotaż jest w Polsce) i zapisać w `data-model.md`.
- Zapytania miar sukcesu (`metrics.sql`) i sprzątanie aktywności po 90 dniach — E-02 (S-02-05).
- Zdarzenia `item.upserted` / `items.cleared` — T-009.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence — layer guides zaktualizowane; strefa `Europe/Warsaw` do dopisania w `data-model.md` (patrz „Decyzje”)
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

### TDD (red → green)

| # | Test | Red (pierwszy przebieg, przed kodem) | Teraz |
| --- | --- | --- | --- |
| 1 | `apps/api/test/items.check.test.ts` (3) | `expected { …(9) } to match object { …(4) }` (brak `checked`), `expected 200 to be 400` (schemat ignorował `checked`) | pass |
| 2 | `apps/api/test/items.checked-order.test.ts` (3) | `expected [ [ 'Jajka', true ], …] to deeply equal [ [ 'Chleb', false ], …]`; `expected +0 to be 3` (`toBuyCount` na sztywno 0) | pass |
| 3 | `apps/api/test/items.clear-checked.test.ts` (3) | `expected 404 to be 200` (brak trasy) | pass |
| 4 | `apps/api/test/items.activity.test.ts` (4) | po migracji: `expected [] to deeply equal [ { …(4) } ]` (pierwszy przebieg: brak tabeli) | pass |
| 5 | `apps/api/test/items.check.authz.test.ts` (4) | przeszedł od razu (wspólne `requireListAccess`); sprawdzenie, że gryzie: trasy bez `requireListAccess` → `PATCH …: expected 200 to be 404`, kod przywrócony | pass |
| 6 | `apps/web/src/screens/SC-06-lista/ListScreen.check.test.tsx` (10) | `Unable to find an accessible element with the role "button" and name "Odhacz Chleb"` | pass |
| 7 | `ListScreen.clear.test.tsx` (6) | `Unable to find … name "Usuń wszystkie kupione"` („Wszystko kupione.” przeszło, bo linia stanu powstała w teście 6) | pass |
| 8 | `ListScreen.dup-bought.test.tsx` (4) | `expect(element).toHaveTextContent()` (dup.open zamiast dup.bought), `Unable to find … "Pokaż"`; dodatkowy test „ostrzeżenie wygasa po odznaczeniu”: `expected <div class="alert warning"> to be null` | pass |
| 9 | `SC-05-moje-listy/ListsScreen.test.tsx` — „2 do kupienia” / „Wszystko kupione” | `Unable to find an element with the text: Wszystko kupione` | pass |
| 10 | `apps/web/e2e/j03-kupione.spec.ts` (2 × telefon/komputer) | napisany po zachowaniu na szybszych seamach (reguła: E2E na końcu), więc bez czerwonego przebiegu | pass |

Dodane do planu w trakcie (test najpierw): SC-06 — 404 przy odhaczeniu odświeża listę (pozycja usunięta przez inną osobę, F-14); kilka kliknięć w czasie zapisu = jedno żądanie; dup.bought wygasa po odznaczeniu pozycji; aktywność — strefa `Europe/Warsaw` (23:30 UTC 28.10 = 29.10) i ponowne odhaczenie odhaczonej nie liczy się drugi raz.

Zmienione istniejące testy (tylko selektor / oczekiwanie wynikające z AC7): `ListScreen.add.test.tsx` — wiersz ma teraz dwa przyciski, zapytanie zawężone do `/^Edytuj /`; `ListsScreen.test.tsx` i `e2e/j02-listy.spec.ts` — karta z `toBuyCount = 0` pokazuje „Wszystko kupione” zamiast „0 do kupienia”; `lists.access.test.ts` — `createLists(pool, createItems(pool))`.

### Kryteria akceptacji

- AC1: `items.check.test` — 200, `checked`, `checkedBy { id, name }` (bez e-maila), `checkedAt`; odznaczenie → `checked: false`, `checkedBy: null`, `checkedAt: null`.
- AC2: `ListScreen.check.test` — „Kupione (1)” zwinięte (`aria-expanded=false`), po rozwinięciu przekreślona (`data-checked`), „kupił(a) Ania”, „Odznacz Chleb” `aria-pressed=true`; „2 do kupienia”; zapisywanie = `aria-busy` do odpowiedzi API, pozycja nie zmienia sekcji; kolejność kupionych z API (`checked_at DESC`, `items.checked-order.test`).
- AC3: `ListScreen.check.test` — spacja na checkboxie, fokus na „Odhacz Mleko” (następna), przy ostatniej na poprzedniej; „Odhaczono Chleb” w regionie `status`. E2E: to samo w przeglądarce + `prefers-reduced-motion: reduce` → 0 działających animacji po przeniesieniu (aplikacja nie animuje przeniesienia w ogóle; spinner bez animacji przy „ogranicz ruch”).
- AC4: `items.clear-checked.test` (2 `deletedIds`, nieodhaczona zostaje, inne listy nietknięte) + `ListScreen.clear.test` (dialog „Usunąć 2 kupionych pozycji?”, fokus na „Anuluj”, po potwierdzeniu znikają, „1 do kupienia”, fokus w „Co kupić?”; błąd w oknie) + „Wszystko kupione.”.
- AC5: `ListScreen.dup-bought.test` — dup.bought + „Pokaż” → „Kupione (1)” rozwinięte, fokus na „Odznacz Chleb”; bez żądania do API.
- AC6: `items.activity.test` — jeden wiersz `checks = 3`; odznaczenie i ponowne odhaczenie nie zmieniają licznika; nowy dzień i inny domownik = nowe wiersze.
- AC7: `items.checked-order.test` (`toBuyCount` 3 → 2 → 0, tylko nieodhaczone tej listy) + `ListsScreen.test` („2 do kupienia” / „Wszystko kupione”) + E2E (karta „Dom, 1 do kupienia”, „Dom, Wszystko kupione”).
- AC8: `j03-kupione.spec.ts` — axe bez naruszeń: zwinięta i rozwinięta „Kupione”, dialog usuwania, „Wszystko kupione.”; nagłówki „Do kupienia” (ukryty) i „Kupione (N)” (`h2` z przyciskiem), listy `ul` „Do kupienia” i „Kupione”.
- SEC1: `items.check.authz.test` — obcy domownik 404 dla `PATCH { checked: true|false }` i `clear-checked`, pozycje i aktywność bez zmian; anonim 401; pozycja listy A przez własną listę B = 404 bez aktywności; nie-UUID = 404.

### Decyzje (do przejrzenia przez QA / właściciela)

- **Strefa dnia aktywności: `Europe/Warsaw`** (propozycja z „Implementation notes”), `statystyki/domain/activity.ts`. Notatka każe zapisać to w `data-model.md`; implementer w trybie autonomicznym nie edytuje `docs/architecture/` poza „Gdzie jest kod” — **do dopisania w `data-model.md`** (tabela `list_daily_activity`: „`day` w strefie Europe/Warsaw, T-007”).
- **SC-05 przy `toBuyCount = 0` pokazuje „Wszystko kupione” także dla pustej listy** — `ListSummary` nie mówi, czy lista ma kupione pozycje, a tabela „Copy” SC-05 ma tylko `card.toBuy` i `card.allBought`. Rozróżnienie wymagałoby nowego pola w kontrakcie (`api.md`). Wcześniej pusta lista pokazywała „0 do kupienia”.
- Odznaczona pozycja wraca na swoje miejsce wśród nieodhaczonych wg `created_at DESC` (`data-model.md`), nie „na górę” jak w Demo pkt 2.
- Ponowne odhaczenie odhaczonej (`{ checked: true }`) to no-op: podpis, `checked_at` i aktywność bez zmian (szybkie wielokrotne klikanie, F-10).
- `PATCH` z `checked` i `name`/`note` naraz: najpierw edycja, potem odhaczenie.
- Po odhaczeniu ostatniej nieodhaczonej fokus trafia na przycisk „Kupione (N)”; po „Usuń wszystkie kupione” — w pole „Co kupić?”. Sekcja „Kupione” (i przycisk usuwania) nie istnieje przy 0 kupionych.
- `toBuyCount` liczy moduł `pozycje` (`Items.toBuyCounts`), `listy` dostaje go przez interfejs `ListItems` (granice modułów).

### Komendy (ten przebieg)

Jeden łańcuch (2026-10-28), kod wyjścia 0: `pnpm typecheck` ✔ · `pnpm lint` ✔ (0 ostrzeżeń) · `pnpm format:check` ✔ · `pnpm quality:duplication` — 0 klonów (wspólne `confirmMutation.ts` usunęło klon ClearBoughtDialog/DeleteListDialog) · `pnpm quality:deps` — brak naruszeń (286 modułów) · `pnpm design-check` — 0 błędów, 0 kolorów na sztywno · `pnpm vitest run` — 57 plików, 285 testów ✔ · build api i web ✔ · `pnpm test:e2e` — 26 passed (telefon + komputer, 4.7 min).

Layer guides (krok 8b, tylko fakty): `db.md`, `backend.md`, `web.md` — „Gdzie jest kod” i historia zmian.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-28)

Verdict: pass

Środowisko: lokalnie (Windows, Docker/Testcontainers). `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych · `format:check`, `lint` (0 ostrzeżeń), `typecheck`, `quality` (0 klonów, 0 naruszeń zależności), `design-check` (0 kolorów na sztywno), build ✔ · `pnpm vitest run` — 57 plików / 285 testów ✔ (pierwszy przebieg: 1 błąd infrastruktury `Connection terminated due to connection timeout` w `lists.authz.test` przy `truncateAllTables`, test spoza zadania; 2 ponowienia pliku i pełny przebieg zielone) · `pnpm test:e2e` — 26 passed (telefon + komputer, w tym `j03-kupione.spec.ts` z axe i `reducedMotion`).

Kryteria akceptacji: AC1 pass · AC2 pass · AC3 pass (komponent + E2E: spacja, fokus na „Odhacz Mleko”, przy ostatniej na „Kupione (1)”, 0 animacji przy „ogranicz ruch”) · AC4 pass · AC5 pass · AC6 pass (strefa `Europe/Warsaw`: 23:30 UTC 28.10 → `day` 2026-10-29) · AC7 pass · AC8 pass (axe: zwinięta, rozwinięta, dialog, „Wszystko kupione.”) · SEC1 pass.

Spot-checki (każdy przywrócony `git checkout`, `git status` czysty):
- `items-repository.ts` `check()`: `.where(onList)` zamiast warunku `isNull(checkedAt)` → `items.activity.test` „does not decrease … nor count a repeated check” czerwony.
- `useCheckItem.ts`: usunięte `onFocus(neighbourOf(…))` → 2 testy fokusu w `ListScreen.check.test` czerwone.
- `domain/items.ts` `clearChecked` zwraca `[]` → 2 testy `items.clear-checked.test` czerwone.

Exploity TH-01 (tymczasowy test przez `buildTestApp` + `fastify.inject`, usunięty): domownik B → `POST /lists/<A>/items/clear-checked` (także z UUID wielkimi literami) = 404 `not_found`, pozycje A nietknięte; anonim 401 (test zadania); pozycja A przez listę B = 404. Wejście: `checked: "true" | null | 1` → 400 `validation_failed`; 2 MB tekstu → 415. Dwa równoległe `PATCH { checked: true }` tej samej pozycji → 200/200, aktywność `checks = 1` (warunkowy `UPDATE`). Uczestnik (nie właściciel) odhacza → 200, `checkedBy { id, name }` bez e-maila. `{ name: "chleb", checked: false }` przy istniejącym „Chleb” → 409, pozycja bez zmian. Ponowne `clear-checked` → `{ deletedIds: [] }`.

Ręczne sprawdzenia dostępności: czytnik ekranu, zoom 200 % / 320 px i Safari — nie wykonane (brak narzędzi w trybie autonomicznym); pokryte częściowo przez E2E telefon/komputer i axe. Do UAT.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | dokumentacja | DoD „Architecture docs updated” niespełniony: strefa dnia aktywności `Europe/Warsaw` nie jest zapisana w `data-model.md`; `api.md` nadal mówi „Stan po T-006 … odhaczanie i „usuń odhaczone” — T-007” i „`GET /lists/:listId` zwraca `items` od najnowszej” (teraz: nieodhaczone, pod nimi odhaczone `checked_at DESC`). | `docs/architecture/data-model.md` (tabela `list_daily_activity`), `docs/architecture/api.md:61`; Evidence zadania, „Decyzje”. | Dopisać strefę i kolejność w `data-model.md`, „Stan po T-007” w `api.md` (no-op ponownego odhaczenia, `PATCH` z `name` + `checked`). |
| 2 | minor | design (SC-05) | Pusta lista (0 pozycji) pokazuje na karcie „Wszystko kupione” — wprowadza w błąd dla nowej listy. Spec SC-05 nie definiuje karty pustej listy; implementer zgłosił to w „Decyzjach”. | `SC-05-moje-listy/messages.ts:9`; nowa lista „Dom” bez pozycji. | Decyzja projektowa: np. „Pusta lista” / „0 do kupienia” (wymaga informacji o kupionych w `ListSummary` albo nowej kopii). |
| 3 | minor | web (SC-06) | Stan rozwinięcia „Kupione” przeżywa „Usuń wszystkie kupione”: po wyczyszczeniu i kolejnym odhaczeniu sekcja pojawia się od razu rozwinięta, choć spec mówi „domyślnie zwinięta”. | `ListScreen.tsx` `boughtOpen` nie jest zerowane w `onCleared`. | Po usunięciu kupionych (sekcja znika) stan wraca do zwiniętej. |
| 4 | minor | backend | `PATCH { name|note, checked }` wykonuje edycję i odhaczenie w dwóch osobnych transakcjach — przy błędzie drugiej (np. 404 po równoczesnym usunięciu) edycja zostaje zapisana, a klient dostaje błąd. `PATCH { checked: false }` na nieodhaczonej przesuwa listę na górę SC-05 (`touchList`) bez faktycznej zmiany. | `domain/items.ts` `changeItem`; `items-repository.ts` `check()` (warunek tylko dla `checked: true`). | Jedna transakcja albo odrzucenie łączenia pól; odznaczenie nieodhaczonej jako no-op jak ponowne odhaczenie. |
| 5 | note | zgodność z Demo | Odznaczona pozycja wraca na swoje miejsce wg `created_at DESC`, nie „na górę” (Demo pkt 2). Zgodne z `data-model.md` „Kolejność” i SC-06 („najnowsze na górze”), więc przyjęte. | Evidence, „Decyzje”. | Ewentualnie poprawić tekst Demo w szablonie zadań. |
| 6 | note | testy | TDD: czerwone przebiegi udokumentowane dla testów 1–9; test 5 (authz) przeszedł od razu, z udokumentowanym sprawdzeniem, że gryzie; E2E (10) bez czerwonego przebiegu zgodnie z regułą „E2E na końcu”. | Evidence, tabela TDD. | — |
| 7 | note | infrastruktura testów | Sporadyczny timeout połączenia w `truncateAllTables` przy wielu równoległych kontenerach Testcontainers. | `apps/api/test/database.ts:49`, pierwszy pełny przebieg. | Obserwować; ewentualnie `connectionTimeoutMillis` / mniejsza równoległość. |
