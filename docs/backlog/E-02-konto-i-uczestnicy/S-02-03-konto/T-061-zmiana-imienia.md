---
id: T-061
title: Zmiana imienia (SC-09)
epic: E-02
story: S-02-03
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-060, T-063]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-16, N-04]
threats: [TH-29]
screens: [SC-09, SC-06, SC-07, SC-05]
---

# T-061 Zmiana imienia (SC-09)

## Goal

Domownik zmienia imię na SC-09. Nowe imię widać od razu przy jego pozycjach („dodał(a)”, „kupił(a)”), na listach uczestników i na kartach SC-05 u wszystkich osób z dostępem, w ≤ 5 s u tych, którzy mają je otwarte.

## Demo

1. Tomek: SC-09 → pole „Imię” z „Tomek” → wpisz „Tomasz” → „Zapisz imię” → Toast „Imię zmienione”.
2. Ania z otwartą „Dom”: przy pozycjach Tomka „dodał(a) Tomasz” w ≤ 5 s; na SC-07 wiersz „Tomasz”.
3. Puste imię → „Wpisz imię”; 31 znaków → „Imię może mieć najwyżej 30 znaków”.

## Context

- BRD: F-16 — „imię 1–30 znaków, widoczne przy pozycjach i na listach uczestników u wszystkich; nie musi być unikalne; puste lub za długie — czytelny komunikat”.
- Architektura: `api.md` „Konto” (`PATCH /api/v1/me { name }` → 200 `{ id, name, email }`; 400), zdarzenia na żywo: `members.changed` do list z dostępem, `lists.changed` do osób z dostępem (SC-05 pokazuje „od <imię>” i awatary); pozycje niosą `addedBy.name` / `checkedBy.name` — klient potrzebuje odświeżenia listy (wybór zdarzenia w tasku: ponowne pobranie przy `members.changed` albo nowe zdarzenie, wtedy aktualizacja `api.md`).
- Design: SC-09 — pole „Imię” (max 30, `autocomplete="given-name"`, opis „Tak zobaczą Cię inni na wspólnych listach.”), „Zapisz imię”, stany Loading, Error — imię, Error — zapis, Offline („Zapisz imię” nieaktywny), Success — imię (Toast).
- Existing code: `apps/web/src/screens/SC-09-konto/` (dziś imię jako tekst w `dl`), `apps/web/src/session/` (`useSession` — nowe imię także w sesji klienta).
- Depends on: T-060 — reguła tekstu widocznego dla innych; T-063 — stan offline.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given zalogowany domownik, when `PATCH /api/v1/me { name: " Tomasz " }`, then 200 `{ id, name: "Tomasz", email }`; `GET /api/v1/me`, `GET /api/v1/lists`, `GET …/members` i pozycje zwracają nowe imię. — verified by: test integracyjny
- [ ] AC2: Given imię puste, z samych spacji, dłuższe niż 30 znaków albo z niedozwolonymi znakami (T-060), then 400 `validation_failed` z błędem pola; imię bez zmian. — verified by: test integracyjny
- [ ] AC3: Given osoby z otwartą listą, na której domownik jest właścicielem lub uczestnikiem, when zmienia imię, then w ≤ 5 s widzą nowe imię przy jego pozycjach (SC-06), w wierszu SC-07 i na karcie SC-05. — verified by: test integracyjny WS (zdarzenia do właściwych osób) + E2E dwa konteksty
- [ ] AC4: Given SC-09, when „Zapisz imię”, then Loading w przycisku (fokus zostaje), Toast „Imię zmienione” (`role="status"`), pole z nowym imieniem, `useSession` z nowym imieniem; błąd pola — komunikat pod polem z fokusem na polu; błąd serwera — „Nie udało się zapisać. Spróbuj ponownie.”; offline — „Zapisz imię” nieaktywny. — verified by: test komponentu (MSW)
- [ ] AC5: Given SC-09 w stanach: formularz, błąd pola, błąd zapisu, offline, sukces, when E2E je odwiedza, then axe bez naruszeń; `h1` „Konto”, `h2` „Twoje dane”. — verified by: E2E + axe
- [ ] SEC1 (TH-29): Given imię „Ania‮…” albo z samym U+200B, when `PATCH /api/v1/me`, then 400 i imię bez zmian. — verified by: test integracyjny
- [ ] SEC2: Given anonim, when `PATCH /api/v1/me`, then 401; given obcy `Origin`, then 403 `invalid_origin`; żądanie z polami innymi niż `name` (np. `email`) nie zmienia ich. — verified by: test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `PATCH /api/v1/me` i WebSocket `/api/v1/live`
- ekran SC-09 z MSW
- przeglądarka (Playwright, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | zmiana imienia widoczna w `me`, listach, uczestnikach, pozycjach | integration | Vitest + Testcontainers | AC1 |
| 2 | walidacja: puste, 31 znaków, niedozwolone znaki; dodatkowe pola ignorowane | integration | Vitest + Testcontainers | AC2, SEC1, SEC2 |
| 3 | anonim 401, obcy `Origin` 403 | integration | Vitest + Testcontainers | SEC2 |
| 4 | zdarzenia na żywo do osób z dostępem (i tylko do nich) | integration | Vitest + Testcontainers + `ws` | AC3 |
| 5 | SC-09: zapis, Toast, błędy, offline, sesja klienta | component | Vitest + RTL + MSW | AC4 |
| 6 | E2E: zmiana widoczna u drugiej osoby ≤ 5 s; axe | E2E | Playwright + axe | AC3, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

**Client state during writes:** zmiana imienia — odpowiedź opóźniona (użytkownik zmienia pole dalej: po odpowiedzi pole nie nadpisuje nowszego wpisu, Toast mówi o zapisanym), utracona po zapisie (ponowienie tym samym imieniem = 200 bez skutków ubocznych), zmiana imienia w innej karcie w międzyczasie (pole pokazuje stan z serwera po fokusie / odświeżeniu sesji).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** imię dokładnie 30 znaków (z polskimi znakami i emoji); takie samo imię jak inny uczestnik; zmiana imienia przez osobę bez list; imię w zaproszeniu SC-08 („{imię} zaprasza Cię…”) po zmianie.
- **Design states:** SC-09: Loading, błąd pola, błąd zapisu, offline, Toast.
- **Platforms / devices:** telefon (Safari, Chrome), komputer, 200 %.
- **Accessibility:** etykieta i opis pola czytane, Toast ogłaszany, fokus po błędzie.
- **Security / privacy:** TH-29 ręcznie; zdarzenia nie trafiają do osób bez wspólnej listy; logi bez imienia.
- **Regression:** F-10 (kto dodał / kto kupił), SC-05 karty, SC-07, wylogowanie na SC-09.

## Implementation notes

- Logi: zmiana imienia bez imienia w logu (tylko `userId`).
- Przy wyborze zdarzenia na żywo uwzględnij, że klient ignoruje zdarzenia pozycji z nie-nowszym `updatedAt` — zmiana imienia nie zmienia `updatedAt` pozycji.

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
