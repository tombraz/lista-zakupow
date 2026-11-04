---
id: T-074
title: "listy: jedna funkcja zdarzeń na żywo przy utracie dostępu i zmianie członkostwa (TH-04)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

Każda ścieżka zmiany członkostwa (T-008/T-032 usunięcie listy, T-058/T-059 usunięcie i opuszczenie, T-009 przyjęcie zaproszenia, T-061 imię, T-062 usunięcie konta) dopisała w swoim zadaniu własną kopię sekwencji zdarzeń w warstwie `http`, bo nie było wspólnej funkcji, do której można by sięgnąć — każde zadanie dodawało „swoje” zdarzenia obok trasy. Testy tego nie łapały, bo sprawdzają zachowanie (jakie zdarzenia dochodzą), a kopie zachowywały się poprawnie; dodatkowo `LiveClient.next(type)` bierze pierwszą wiadomość danego typu z kolejki, więc większość testów nie pilnowała nawet kolejności (`revoke` przed `lists.changed` przy usunięciu konta, przyjęcie linku).

Zmiana: `apps/api/src/modules/listy/domain/membership-events.ts` — `announceAccessChanges(live, changes, skip?)` (jedyne miejsce `list.deleted` / `revoke` / `members.changed` / `lists.changed` po zmianie dostępu) oraz `accountDeletionChanges` (decyzja „własna lista / cudza” przeniesiona z `http` do domeny) i `renameChanges`; jeden typ `ListWithPeople` (w domenie, `infra` go importuje). `http/person-events.ts` usunięty; po zmianie imienia `listsWithPeopleOf(db, userId)` zamiast `listsOf` (poza transakcją blokada `FOR UPDATE` trwa tylko do końca zapytania). Funkcja jest asynchroniczna (osoby po usunięciu członkostwa mogą jeszcze iść z bazy, `revoke` idzie bez czekania), więc `AccountDeleting` w `konta` zwraca `() => Promise<void>`, a `DELETE /me` czeka na nią przed `closeUser`.

Odstępstwo w kolejności: przy przyjęciu linku `invitations.changed` do właściciela idzie teraz przed `members.changed` (wcześniej po), bo osoby listy są potrzebne do obu i są pobierane przed wspólną funkcją. Zdarzenia są niezależne (SC-07 vs widok listy); u uczestników i u właściciela bez subskrypcji kolejność bez zmian.

Inne wystąpienia: `pozycje/http/item-events.ts` i `zaproszenia/http/routes.ts` wysyłają zdarzenia pozycji / linków, nie członkostwa — poza zakresem.

## Evidence

Refaktoryzacja bez zmiany zachowania, więc bez testu „czerwonego”; najpierw dopisane asercje kolejności (testy charakteryzujące), zielone przed i po zmianie:

- `live.delete-account.test.ts` › „sends list.deleted and lists.changed to the participants…” — `["subscribed", "list.deleted", "access.revoked", "lists.changed"]`;
- `live.delete-account.test.ts` › „tells the other lists of the account members.changed…” — `["subscribed", "members.changed", "lists.changed"]`;
- `live.lists.test.ts` › „accepting a link: …” — uczestnik `["subscribed", "members.changed", "lists.changed"]`, właściciel `["invitations.changed", "lists.changed"]`.

Przed zmianą: `pnpm vitest run --project api live` — 16 plików, 58 testów zielonych. Po zmianie: to samo; `pnpm check` (format, lint, typy, depcruise, backlog, 1165 testów) i `pnpm build` zielone.

## Prevention

Linia w `backend.md`: zdarzenia członkostwa tylko przez funkcję modułu `listy` (przegląd, „Proposals”).

Co by temu zapobiegło: wspólna funkcja od pierwszej ścieżki i automatyczna kontrola, że nikt nie składa sekwencji obok niej. Stan: wpis w „Pułapkach” `backend.md` jest (z przeglądu E-02, teraz z nazwą `announceAccessChanges`). Propozycja tańszej trwałej kontroli: reguła eslint `no-restricted-syntax` blokująca `*.revoke(…)` i literał `type: "members.changed"` / `"list.deleted"` poza `listy/domain/membership-events.ts`, z fixture w `scripts/test/lint-security.test.mjs` — do decyzji użytkownika.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Zakres: commity `0111821`, `7eb7bbf` (bez `ea13706` — tylko status). Przebieg QA: `pnpm install --frozen-lockfile`, `pnpm check` (format, lint, typy, depcruise, backlog, 147 plików / 1165 testów web+api, mobile 10 testów) — zielone; `pnpm vitest run --project api live` — 16 plików, 58 testów zielonych.

Kryteria:

- AC1 — pass. `DELETE` listy (`http/routes.ts:104-107`) i usunięcie konta właściciela (`accountDeletionChanges` → `list-deleted`) idą przez `announceAccessChanges`; kolejność `list.deleted` → `revoke` → `lists.changed` taka jak przed zmianą (porównanie z usuniętym `person-events.ts` i starą trasą). Nowa asercja kolejności w `live.delete-account.test.ts` i `live.revoke.test.ts` gryzie (spot-check 3).
- AC2 — pass. Usunięcie i opuszczenie (`withdrawAccess`), przyjęcie zaproszenia (`acceptAndAnnounce`), zmiana imienia (`renameChanges`) i usunięcie konta uczestnika (`members-changed` z `lostAccess`) — wszystkie przez jedną funkcję; `grep` nie znajduje innych miejsc `list.deleted` / `members.changed` / `revoke` członkostwa w `apps/api/src`. Pozostałe `lists.changed` (tworzenie, zmiana nazwy listy, pozycje) nie są zmianą dostępu — poza zakresem.
- AC3 — pass. `announceNameChanges` używa `listsWithPeopleOf`; `ListWithPeople` zdefiniowany raz (`domain/membership-events.ts:5`), `infra` go importuje; typecheck zielony, `live.name.test.ts` (osoba na kilku listach, jedno `lists.changed` na osobę) zielony.
- AC4 — pass. Wszystkie testy `live.*` oraz testy tras T-008, T-032, T-058, T-059, T-061, T-062 zielone w pełnym zestawie.

Spot-checki (każdy cofnięty `git checkout`, `git status` czysty):

1. Usunięta linia `live.revoke(change.lostAccess, …)` → 4 testy czerwone (`live.leave`, `live.remove-member`: dostęp i `members.changed`).
2. `lostAccess` nie dodawany do odbiorców `lists.changed` (T-032) → te same 4 testy czerwone.
3. Usunięte `revoke` wszystkich przy `list-deleted` → czerwone `live.delete-account` (kolejność) i `live.revoke` (TH-04).

TH-04 (MC-03): próby z drugim kontem przez działającą aplikację (Fastify + prawdziwy WebSocket + Postgres w Testcontainers) w `live.revoke`, `live.leave`, `live.remove-member`, `live.delete-account`: ponowna subskrypcja po usunięciu listy / utracie dostępu odrzucona, zapisy i odczyty byłego uczestnika odrzucone. Spot-checki potwierdzają, że testy negatywne pilnują mitygacji. Nie do wykorzystania.

Fix task: „Root cause” wyjaśnia, czemu testy nie łapały (zachowanie kopii poprawne, `next(type)` nie pilnował kolejności); testy charakteryzujące dopisane i gryzą (spot-check 3). Refaktoryzacja, więc brak czerwonego testu jest uzasadniony.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | backend / wydajność | Zmiana imienia woła teraz `listsWithPeopleOf` poza transakcją, a ta robi `SELECT … FOR UPDATE` na własnych listach osoby. `PATCH /me` czeka na ogłoszenie (`me-routes.ts:46`), więc może czekać za trwającą transakcją pozycji tej listy (`lockList`); blokada nie jest tu potrzebna. | `lists-repository.ts:66-70`, `listy/index.ts:76-78` | Odczyt bez blokady na ścieżce imienia (np. parametr / osobna funkcja bez `.for("update")`) albo świadoma decyzja w komentarzu, że czekanie jest akceptowalne. |
| 2 | note | backend / projekt | `AccessChange.people` dopuszcza `Promise` — typ domeny niesie szczegół kolejności I/O (revoke przed odczytem z bazy). Działa i jest opisane, ale jest mniej oczywiste niż np. osobny krok `revoke` przed odczytem w funkcji. | `membership-events.ts:18-23`, `routes.ts:161-165` | Do rozważenia przy kolejnej zmianie tej funkcji. |
| 3 | note | backend / zdarzenia | Przy przyjęciu linku `invitations.changed` do właściciela idzie teraz przed `members.changed` (odstępstwo opisane w „Root cause”); AC2 nie wymaga kolejności, zdarzenia dotyczą różnych widoków. | `invitation-events.ts:22-24`, `live.lists.test.ts:136-145` | Bez zmian; odnotowane. |
