---
id: T-074
title: "listy: jedna funkcja zdarzeń na żywo przy utracie dostępu i zmianie członkostwa (TH-04)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-05, F-14, F-04, F-16]
threats: [TH-04]
screens: []
related_tasks: [T-058, T-059, T-061, T-062, T-008, T-032]
---

# T-074 listy: jedna funkcja zdarzeń na żywo przy utracie dostępu i zmianie członkostwa

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, C1 (major); powiązane S7.

- **Actual:** ta sama sekwencja zdarzeń jest napisana ręcznie w warstwie `http` w kilku miejscach:
  - usunięcie listy: `list.deleted` → `revoke` każdego → `lists.changed` (`apps/api/src/modules/listy/http/routes.ts:106-108` i `apps/api/src/modules/listy/http/person-events.ts:38-40`);
  - zmiana członkostwa: `members.changed` + `lists.changed` do `everyone(peopleWithAccess)` (`listy/http/routes.ts:163-166`, `listy/http/person-events.ts:17-21` i `:42-47`, `zaproszenia/http/invitation-events.ts:22-25`).

  Reguły TH-04/MC-03 (`backend.md`, „Zasady bezpieczeństwa”: `revoke` w tej samej operacji) i T-032 (`lists.changed` także do autora) trzeba pilnować w każdej kopii osobno. Dodatkowo `person-events.ts:38` podejmuje w `http` decyzję domenową (`list.ownerId === userId`). `announceRenamedPerson` używa ciężkiego `listsOf` zamiast `listsWithPeopleOf`, a typ `ListWithPeople` jest zdefiniowany dwa razy (S7).
- **Expected:** jedno miejsce w module `listy` (np. `announceListDeleted(listId, people)` i `announceMembershipChanged(listId, people, extra?)`), z którego korzystają: trasa DELETE listy, `withdrawAccess`, `announceDeletedPerson`, `announceRenamedPerson` i `acceptAndAnnounce`. Źródło: `CODING_STANDARDS.md:41` (DRY), `backend.md:82`.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given usunięcie listy (trasą albo przez usunięcie konta właściciela), then zdarzenia `list.deleted`, `revoke` i `lists.changed` idą przez jedną funkcję modułu `listy`, w tej samej kolejności co dziś. — verified by: istniejące testy `live.*` zielone bez zmian asercji
- [ ] AC2: Given usunięcie uczestnika, opuszczenie listy, przyjęcie zaproszenia, zmiana imienia i usunięcie konta uczestnika, then `members.changed` i `lists.changed` idą przez jedną funkcję. — verified by: istniejące testy `live.*`
- [ ] AC3: `announceRenamedPerson` używa `listsWithPeopleOf`; jest jeden typ `ListWithPeople`. — verified by: typecheck + testy `live.name`
- [ ] AC4: No regression in: T-008, T-032, T-058, T-059, T-061, T-062 (testy integracyjne na żywo).

## TDD plan

**Seam:** API + WS przez `buildTestApp` i `connectLive`; refaktoryzacja pod istniejącymi testami.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Istniejące `apps/api/test/live.*.test.ts` przed i po zmianie | integration | Vitest + Testcontainers | AC1, AC2, AC4 |
| 2 | Brakujący przypadek, jeśli któraś ścieżka nie ma testu kolejności `revoke` przed dalszymi zdarzeniami | integration | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api live`

## QA plan

- **Regression:** wszystkie ścieżki zmiany członkostwa z AC2, dwa klienty WS.
- **Edge cases:** właściciel usuwa konto z listami z uczestnikami; uczestnik na kilku listach zmienia imię.
- **Platforms:** API.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Linia w `backend.md`: zdarzenia członkostwa tylko przez funkcję modułu `listy` (przegląd, „Proposals”).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
