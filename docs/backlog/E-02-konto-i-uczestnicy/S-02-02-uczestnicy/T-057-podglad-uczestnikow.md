---
id: T-057
title: "Uczestnicy na SC-07: podgląd, e-maile tylko dla właściciela"
epic: E-02
story: S-02-02
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given właściciel listy z uczestnikami, when `GET /api/v1/lists/:listId/members`, then 200 `{ owner: { id, name }, participants: [{ id, name, email }] }` w kolejności dołączenia. — verified by: test integracyjny
- [ ] AC2: Given SC-07 właściciela, then nagłówek „Na liście (N z 20)” (N = liczba uczestników), wiersz właściciela „właściciel”, wiersze uczestników z e-mailem; given SC-07 uczestnika, then jego wiersz „Ty”, pozostali bez e-maila, bez sekcji „Zaproszenia”. — verified by: test komponentu (MSW)
- [ ] AC3: Given właściciel bez uczestników, then tylko jego wiersz + „Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi.”; Loading — szkielet 3 wierszy; Error — „Nie udało się wczytać uczestników.” + „Spróbuj ponownie” (ponawia, fokus zostaje na przycisku). — verified by: test komponentu
- [ ] AC4: Given otwarte SC-07 u właściciela i uczestnika, when ktoś dołącza linkiem, then `members.changed` odświeża sekcję w ≤ 5 s u obu. — verified by: test komponentu (zdarzenie na żywo) + E2E dwa konteksty
- [ ] AC5: Given SC-07 (właściciel, uczestnik, pusty, błąd), when E2E je odwiedza, then axe bez naruszeń; `h2` „Na liście”. — verified by: E2E Playwright + axe
- [ ] SEC1 (TH-19): Given uczestnik listy, when `GET …/members`, then żaden `Person` nie ma pola `email` (także właściciela i jego własny wiersz bez cudzych danych); given `GET /api/v1/lists/:listId` i `GET /api/v1/lists`, then nadal bez e-maili. — verified by: test integracyjny kształtu odpowiedzi (rozszerzenie `participant-emails.test.ts`)
- [ ] SEC2 (TH-01): Given domownik bez dostępu do listy A, when `GET /api/v1/lists/<A>/members`, then 404 `not_found` bez treści; anonim 401; niepoprawny `listId` 404. — verified by: test integracyjny autoryzacji

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
