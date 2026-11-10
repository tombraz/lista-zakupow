---
id: T-119
title: "Zapis pozycji sprawdza członkostwo w transakcji; usunięcie uczestnika szereguje się z zapisami"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, db]
requirements: [F-13]
threats: [TH-04, TH-31]
screens: []
related_tasks: [T-056, T-058, T-059, T-029]
---

# T-119 Zapis pozycji sprawdza członkostwo w transakcji; usunięcie uczestnika szereguje się z zapisami

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #2 (medium).

- **Actual:** trasy pozycji wołają `requireListAccess` osobnym zapytaniem przed transakcją zapisu (`apps/api/src/modules/pozycje/http/routes.ts:79-81`, także 91, 113, 122). W transakcji członkostwo nie jest sprawdzane drugi raz. `insert` bierze `lockList` (`items-repository.ts:45`), ale nie sprawdza pod nią członkostwa. `update`, `delete` i `check` (75, 114, 137) nie biorą blokady. `removeParticipant` (`listy/infra/lists-repository.ts:149-155`) i opuszczenie listy to `DELETE FROM list_member` bez `lockList`. Zapis, który już trwa w chwili usunięcia uczestnika, kończy się sukcesem (201 / 200), a zmiana zostaje w bazie.
- **Expected:** po zatwierdzeniu usunięcia albo opuszczenia listy żaden zapis tej osoby na tej liście się nie udaje (404 `not_found`). Źródło: TH-04 („zapisy zawsze sprawdzają dostęp w bazie… zapis zwraca 404”), MC-03, plan QA T-058.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `cad0509`; analiza kodu (wyścig nie był odtwarzany na żywo).
- **Evidence:** cytaty z kodu powyżej; `gatedPool` jest użyty tylko dla `subscribe` (`live.revoke.test.ts`).

## Acceptance criteria

- [ ] AC1: Given zapis pozycji uczestnika (dodanie, edycja, odhaczenie, cofnięcie odhaczenia, usunięcie, wyczyszczenie kupionych) wstrzymany po sprawdzeniu dostępu, when właściciel usuwa tego uczestnika, a potem zapis zostaje wznowiony, then zapis odpowiada 404 `not_found`, a w bazie nie ma zmian. — verified by: test integracyjny z `gatedPool` dla każdej trasy zapisu
- [ ] AC2: To samo dla opuszczenia listy i dla usunięcia konta uczestnika. — verified by: test integracyjny
- [ ] AC3: Równoległe zapisy członków na jednej liście nie wywołują zakleszczeń ani 500 (kolejność blokad: lista, potem pozycja). — verified by: istniejące testy równoległości (T-029, T-030)
- [ ] AC4: No regression in: `live.remove-member.test.ts`, `live.leave.test.ts`, `items*.test.ts`, J-03, J-05.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers i `gatedPool`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `refuses an item write that started before the participant was removed` (każda trasa zapisu) | integracja | Vitest + Testcontainers | AC1 |
| 2 | `refuses an item write that started before the participant left or deleted their account` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api items live.remove-member`

## QA plan

- **Regression:** J-03 (pozycje), J-04 (uczestnicy), J-05 (na żywo), limity pozycji (500), blokada duplikatu (F-09).
- **Edge cases:**
  - właściciel usuwa listę w trakcie zapisu uczestnika;
  - dwie osoby odhaczają tę samą pozycję;
  - zapis właściciela w trakcie usuwania uczestnika (musi się udać).
- **Platforms:** API.

## Root cause

<Do uzupełnienia przy poprawce. Wstępnie: wzorzec „sprawdź, potem zapisz” z E-01; testy TH-04 sprawdzały zapis po usunięciu, nie zapis w toku.>

## Evidence

## Prevention

Propozycja z przeglądu: linia w `backend.md` „Zasady bezpieczeństwa” — „Zapis do danych listy sprawdza członkostwo w tej samej transakcji pod `lockList`; każda zmiana członkostwa bierze tę samą blokadę”.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
