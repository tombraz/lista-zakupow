---
id: T-007
title: Odhaczanie, „kto kupił” i usuwanie kupionych (web)
epic: E-01
story: S-01-04
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given nieodhaczona pozycja, when `PATCH …/items/:itemId { checked: true }`, then 200 `Item` z `checked: true`, `checkedBy { id, name }`, `checkedAt`; given odhaczona, when `{ checked: false }`, then `checked: false`, `checkedBy: null`. — verified by: test integracyjny `items.check.test`
- [ ] AC2: Given lista z pozycjami, when ekran SC-06 się odświeży po odhaczeniu, then pozycja jest w „Kupione (N)” (sekcja domyślnie zwinięta, kupione od ostatnio odhaczonej), przekreślona, z „kupił(a) <imię>”; linia stanu pokazuje nowy licznik; checkbox ma nazwę dostępną „Odhacz <nazwa>” / „Odznacz <nazwa>” i stan zapisywania do odpowiedzi API. — verified by: test komponentu SC-06
- [ ] AC3: Given odhaczenie z klawiatury, when zapis się powiedzie, then fokus przechodzi na checkbox następnej nieodhaczonej pozycji (albo poprzedniej, gdy to była ostatnia), a region `polite` ogłasza „Odhaczono <nazwa>”; przy „ogranicz ruch” brak animacji przeniesienia. — verified by: test komponentu + E2E (emulacja `prefers-reduced-motion`)
- [ ] AC4: Given 2 odhaczone i 1 nieodhaczona, when `POST …/items/clear-checked` (po ConfirmDialog „Usunąć 2 kupionych pozycji?”), then 200 `{ deletedIds }` z dwoma identyfikatorami, nieodhaczona zostaje; brak nieodhaczonych pokazuje „Wszystko kupione.” — verified by: test integracyjny + test komponentu
- [ ] AC5: Given odhaczona pozycja „Chleb”, when ktoś dodaje „chleb”, then SC-06 pokazuje `dup.bought` z przyciskiem „Pokaż”, który rozwija „Kupione” i przenosi fokus na tę pozycję. — verified by: test komponentu SC-06
- [ ] AC6: Given odhaczenia trzech pozycji przez domownika jednego dnia (zegar wstrzyknięty), when sprawdzę `list_daily_activity`, then jest jeden wiersz (lista, dzień, domownik) z `checks = 3`; odznaczenie nie zmniejsza licznika; następny dzień daje nowy wiersz. — verified by: test integracyjny modułu `statystyki` przez API
- [ ] AC7: Given SC-05 po zmianach, when lista ma nieodhaczone / tylko odhaczone pozycje, then karta pokazuje „N do kupienia” / „Wszystko kupione”. — verified by: test integracyjny `toBuyCount` + test komponentu SC-05
- [ ] AC8: Given SC-06 z rozwiniętą i zwiniętą sekcją „Kupione”, z dialogiem „Usuń wszystkie kupione”, when E2E je odwiedza, then axe bez naruszeń; dwie listy `ul` z nagłówkami „Do kupienia” (wizualnie ukryty) i „Kupione”. — verified by: E2E Playwright + axe
- [ ] SEC1 (TH-01): Given lista A i domownik B bez dostępu, when B wywoła `PATCH { checked }` na pozycji A albo `POST /lists/<A>/items/clear-checked`, then 404, nic nie zostaje odhaczone ani usunięte, aktywność się nie zmienia; anonim 401. — verified by: testy integracyjne `items.check.authz.test`

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
