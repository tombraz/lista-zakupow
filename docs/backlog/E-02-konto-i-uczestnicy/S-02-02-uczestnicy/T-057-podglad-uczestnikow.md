---
id: T-057
title: "Uczestnicy na SC-07: podgląd, e-maile tylko dla właściciela"
epic: E-02
story: S-02-02
status: done           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-13, N-02, N-04]
threats: [TH-01, TH-19]
screens: [SC-07]
---

# T-057 Uczestnicy na SC-07: podgląd, e-maile tylko dla właściciela

## Goal

SC-07 pokazuje sekcję „Na liście (N z 20)” z właścicielem i wszystkimi uczestnikami. Właściciel widzi e-maile uczestników, uczestnik — nie widzi cudzych e-maili; dołączenie nowej osoby pojawia się na żywo.

## Demo

1. Ania (właściciel „Dom”, uczestnicy Tomek i Ola) otwiera SC-07: „Na liście (2 z 20)”, wiersze: Ania „właściciel”, Tomek z e-mailem, Ola z e-mailem.
2. Tomek otwiera SC-07 tej listy: Ania „właściciel”, Tomek „Ty”, Ola — bez e-maila; brak sekcji „Zaproszenia”.
3. Kasia dołącza linkiem — u Ani i Tomka pojawia się w ≤ 5 s, licznik „3 z 20”.

## Context

- BRD: F-13 — „właściciel i uczestnik widzą imiona właściciela i wszystkich uczestników; właściciel widzi też e-mail uczestnika (uczestnik nie widzi e-maili innych osób)”.
- Architektura: `api.md` „Listy” (`GET /api/v1/lists/:listId/members` → `{ owner: Person, participants: [Person] }`, `email` tylko gdy pyta właściciel; 404), `members.changed` (`api.md` „Zmiany na żywo”), `requireListAccess`, TH-01, TH-19, `testing-strategy.md` „Testy bezpieczeństwa”.
- Design: SC-07 — sekcja „Na liście (N z 20)” (Avatar 32 px, imię, „właściciel” / „Ty” / e-mail), stany Empty („Nikt jeszcze nie dołączył…”), Loading (szkielet 3 wierszy), Error — wczytanie, Success, No permission; Accessibility (`h2` „Na liście”).
- Existing code: `apps/web/src/screens/SC-07-uczestnicy/` (sekcja „Zaproszenia” i wiersz właściciela z T-008), `packages/shared/src/api/person.ts`, `apps/api/test/participant-emails.test.ts`.
- Depends on: — (E-01).

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given właściciel listy z uczestnikami, when `GET /api/v1/lists/:listId/members`, then 200 `{ owner: { id, name }, participants: [{ id, name, email }] }` w kolejności dołączenia. — verified by: test integracyjny
- [x] AC2: Given SC-07 właściciela, then nagłówek „Na liście (N z 20)” (N = liczba uczestników), wiersz właściciela „właściciel”, wiersze uczestników z e-mailem; given SC-07 uczestnika, then jego wiersz „Ty”, pozostali bez e-maila, bez sekcji „Zaproszenia”. — verified by: test komponentu (MSW)
- [x] AC3: Given właściciel bez uczestników, then tylko jego wiersz + „Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi.”; Loading — szkielet 3 wierszy; Error — „Nie udało się wczytać uczestników.” + „Spróbuj ponownie” (ponawia, fokus zostaje na przycisku). — verified by: test komponentu
- [x] AC4: Given otwarte SC-07 u właściciela i uczestnika, when ktoś dołącza linkiem, then `members.changed` odświeża sekcję w ≤ 5 s u obu. — verified by: test komponentu (zdarzenie na żywo) + E2E dwa konteksty
- [x] AC5: Given SC-07 (właściciel, uczestnik, pusty, błąd), when E2E je odwiedza, then axe bez naruszeń; `h2` „Na liście”. — verified by: E2E Playwright + axe
- [x] SEC1 (TH-19): Given uczestnik listy, when `GET …/members`, then żaden `Person` nie ma pola `email` (także właściciela i jego własny wiersz bez cudzych danych); given `GET /api/v1/lists/:listId` i `GET /api/v1/lists`, then nadal bez e-maili. — verified by: test integracyjny kształtu odpowiedzi (rozszerzenie `participant-emails.test.ts`)
- [x] SEC2 (TH-01): Given domownik bez dostępu do listy A, when `GET /api/v1/lists/<A>/members`, then 404 `not_found` bez treści; anonim 401; niepoprawny `listId` 404. — verified by: test integracyjny autoryzacji

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `GET /api/v1/lists/:listId/members` przez `fastify.inject`
- ekran SC-07 z API podstawionym przez MSW i podstawionym kanałem na żywo
- przeglądarka (Playwright, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | właściciel dostaje uczestników z e-mailami w kolejności dołączenia | integration | Vitest + Testcontainers | AC1 |
| 2 | uczestnik dostaje uczestników bez e-maili | integration | Vitest + Testcontainers | SEC1 |
| 3 | obcy 404, anonim 401, zły `listId` 404 | integration | Vitest + Testcontainers | SEC2 |
| 4 | SC-07 właściciela i uczestnika: wiersze, „Ty”, e-maile, licznik | component | Vitest + RTL + MSW | AC2 |
| 5 | SC-07: pusty, Loading, błąd z ponowieniem | component | Vitest + RTL + MSW | AC3 |
| 6 | `members.changed` odświeża sekcję | component | Vitest + RTL + MSW | AC4 |
| 7 | E2E: dołączenie widoczne u obu; axe w każdym stanie | E2E | Playwright + axe | AC4, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** 20 uczestników (przewijanie, licznik „20 z 20” razem z ostrzeżeniem limitu z T-008); bardzo długie imię i e-mail (zawijanie na 320 px); usunięty użytkownik nie jest na liście.
- **Design states:** pusty, Loading, błąd, właściciel, uczestnik, limit.
- **Platforms / devices:** telefon (Safari, Chrome), komputer, 200 %.
- **Accessibility:** czytnik ekranu czyta wiersz jako imię + rola / e-mail; nagłówki `h1` / `h2`.
- **Security / privacy:** jako uczestnik przejrzyj odpowiedzi sieciowe SC-07 i SC-06 — nigdzie e-maili innych osób (TH-19); trzecie konto podmienia `listId` (TH-01).
- **Regression:** sekcja „Zaproszenia” (T-008), limit uczestników i fokus (T-025), `members.changed` na SC-05 (awatary).

## Implementation notes

- E-mail w odpowiedzi tylko z gałęzi „pyta właściciel” — typ `Person` z opcjonalnym `email` już jest; test kształtu odpowiedzi uczestnika ma sprawdzać brak klucza, nie `undefined`.
- Akcje „Usuń” i „Opuść listę” — T-058, T-059.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

### Tests (red → green)

| # | Test | Red (before the code) | Now |
| --- | --- | --- | --- |
| 1 | `apps/api/test/lists.members.test.ts` „gives the owner the participants with e-mails, in the order they joined” | `expected 404 to be 200` (no route) | pass |
| 2 | same file „gives a participant everyone without an email key, including the owner and themselves” + `participant-emails.test.ts` (now also `GET …/members` as Tomek) | written after the role branch existed; red proven by temporarily returning the records with e-mails to a participant: `expected {…} to deeply equal {…}` and `expected '{"owner":…' not to contain 'user-…@example.com'`; restored | pass |
| 3 | same file „answers 404 to someone without access and to a bad listId, 401 to an anonymous request” | red proven by temporarily skipping `requireListAccess` in the route: `expected 200 to be 404`; restored | pass |
| 4 | `ParticipantsScreen.members.test.tsx` „shows the owner every participant with their e-mail and the count”, „shows a participant „Ty” in their row, nobody's e-mail and no invitations” | `expected [ 'AAniawłaściciel · Ty' ] to deeply equal [ …(3) ]` / `[ 'AAniawłaściciel' ]` | pass |
| 5 | same file „SC-07 Na liście states”: empty, skeleton of 3 rows, error + retry with focus kept | against the HEAD screen: skeleton and retry tests fail (region not found, timeout); empty state passed already (T-008 behaviour, now fed from `/members`). With the first implementation the retry test failed on `toHaveFocus()` (refetch of a query without data goes back to `pending` → skeleton → focus on `body`); fixed with `useRetry` | pass |
| 6 | `ParticipantsScreen.live.test.tsx` „shows a person who joined to the owner / a participant after members.changed” | red with the `membersKey` invalidation removed from `useLiveList`: `Unable to find role="region" and name "Na liście (2 z 20)"`; restored | pass |
| 7 | `apps/web/e2e/sc07-uczestnicy.spec.ts`: „SC-07 shows who is on the list, e-mails only to the owner, joins live” (Ania + Tomek + Kasia, three contexts, `≤ 5 s`), „SC-07 empty and load error states pass axe” | written after the behaviour worked at the faster seams (plan order) | pass |

Also changed: `logs.content.test.ts` reads `GET …/members` as owner and as guest (TH-21: new route with personal data); `j04-zaproszenie.spec.ts` „SC-07 and SC-08 states pass axe” now also fills `GET …/members` with 20 participants (the counter and limit come from that response).

### Commands (this run)

- `pnpm vitest run` — 111 files, 605 tests passed; `pnpm vitest run --project api --sequence.shuffle --sequence.seed=7` and `=42` — 308 passed.
- `pnpm test:e2e` — 58 passed (whole suite, Windows, 1 worker).
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm quality` (0 clones, no dependency violations), `pnpm design-check`, `pnpm workflow-check`, `pnpm test:mobile`, web and API build — OK.

### Acceptance criteria

- AC1 — test 1 (`toEqual` with exact shape and join order).
- AC2 — test 4; E2E test 7 (rows of Tomek's view: `AAniawłaściciel`, `TTomekTy`; no `@example.com` on his screen; no „Zaproszenia”).
- AC3 — test 5.
- AC4 — test 6 and E2E test 7 (Kasia joins → „Na liście (2 z 20)” at Ania and Tomek within 5 s).
- AC5 — E2E: axe in owner, participant, empty, load-error states (test 7) and limit state (J-04); `h2` „Na liście (N z 20)”.
- SEC1 — test 2 (`Object.keys(person)` = `["id","name"]` for owner and every participant; body contains no e-mail) and `participant-emails.test.ts` (members, lists, list details, WS).
- SEC2 — test 3.

### Decisions for QA

- Type: `Person` stays `{ id, name }` (other routes cannot carry an e-mail by type); new `Participant extends Person { email? }` and `ListMembers` in `packages/shared/src/api/lists.ts`. `api.md` describes it as `Person = { id, name, email? }` — same wire shape; `api.md` not edited (out of my scope).
- The e-mail is chosen in the domain (`membersOf`, branch on `access.role`), the repository always reads it (`peopleOf`).
- Owner's own row keeps the T-008 text „właściciel · Ty” in the owner view; participants' rows show „Ty” for the viewer, otherwise e-mail (owner view) or nothing.
- SC-07 counter and the 20-participant limit (Invitations) now come from `GET …/members`, not from `members` of the list details.
- Long name / e-mail wrap with `overflow-wrap: anywhere` (`.who`) — QA plan check at 320 px.
- Layer guides: „Gdzie jest kod” in `backend.md` and `web.md` updated (facts).

## QA round 1 (2026-11-01)

Verdict: pass

Środowisko: Windows 11, Docker (Postgres, Mailpit), `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych.

**Reprodukcja:** `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, vitest 111 plików / 605 testów, mobile 10 testów) — zielone. `pnpm test:e2e` — 58 passed (w tym `sc07-uczestnicy.spec.ts` ×2, `j04-zaproszenie.spec.ts` „SC-07 and SC-08 states pass axe”).

**Kryteria akceptacji:**

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | test 1 (`toEqual` z dokładnym kształtem i kolejnością); na żywo: właściciel dostał `participants` z `email` w kolejności dołączenia |
| AC2 | pass | test komponentu + E2E; na żywo w Chromium 320 px: właściciel „Ania właściciel · Ty”, uczestnicy z e-mailem; uczestnik „Ania właściciel”, „Tomek Ty”, inni bez e-maila, brak „Zaproszenia” |
| AC3 | pass | testy komponentu (pusty, szkielet 3 wierszy, błąd + ponowienie z fokusem) i E2E (pusty, błąd 500 → ponowienie) |
| AC4 | pass | test komponentu (właściciel i uczestnik) + E2E trzy konteksty ≤ 5 s |
| AC5 | pass | E2E axe: właściciel, uczestnik, pusty, błąd, limit (J-04); `h2` „Na liście (N z 20)” |
| SEC1 (TH-19) | pass | test 2 (`Object.keys` = `["id","name"]`) i `participant-emails.test.ts`; na żywo: odpowiedzi API SC-07 i SC-06 uczestnika zawierają tylko jego własny e-mail (z `/me`), `GET /lists` i `GET /lists/:id` bez e-maili |
| SEC2 (TH-01) | pass | test 3; na żywo: obcy 404 `{"error":{"code":"not_found"}}` identyczny z losowym UUID, `nie-uuid` / wstrzyknięcie w `listId` 404, anonim 401; odmowy w logu `security` (`list_access_denied`) |

**Spot-checki (przywrócone, `git status` czysty):**

- `membersOf` zwraca e-mail także uczestnikowi → padają `lists.members.test.ts` (participant) i `participant-emails.test.ts`.
- trasa `/members` bez `requireListAccess` → padają testy SEC1/SEC2.
- usunięta inwalidacja `membersKey` w `useLiveList` → padają 3 testy „members.changed” (i 2 testy limitu/fokusu zależne od odświeżenia).

**Eksploracja:** długie imię (30 znaków) i e-mail (~80 znaków) na 320 px — zawijanie, brak przewijania w poziomie (`scrollWidth` = 320); log API (`test-results/api.log`) bez e-maili po przebiegu; brak pól wrażliwych w odpowiedziach dla uczestnika.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | docs | `api.md` „Listy” opisuje `Person = { id, name, email? }`, kod rozdziela `Person` / `Participant` (`packages/shared/src/api/lists.ts`); autor świadomie nie zmienił `api.md` | Evidence „Decisions for QA” | jedna linijka w `api.md` o typie `Participant` / `ListMembers` |
| 2 | minor | tests | Brak dowodu „red” dla E2E (test 7) — napisany po działającym zachowaniu; red dla testów 2, 3, 6 pokazany przez celowe zepsucie (potwierdzone moimi spot-checkami) | Evidence, tabela testów | akceptowalne; odnotowane |
| 3 | note | design | Wiersz właściciela w jego widoku „właściciel · Ty” (zachowanie T-008), spec SC-07 wymienia „właściciel” / „Ty” rozłącznie | `ParticipantsScreen.tsx` `Members` | do potwierdzenia przez projekt; nie blokuje |
| 4 | note | a11y | Manualne sprawdzenie czytnika ekranu / 200 % / Safari nie wykonane (brak narzędzi w trybie autonomicznym); automatyczny axe zielony | — | sprawdzić w UAT |
