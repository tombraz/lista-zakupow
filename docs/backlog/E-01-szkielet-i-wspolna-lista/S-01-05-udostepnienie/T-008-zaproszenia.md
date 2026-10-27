---
id: T-008
title: Link zaproszenia i jego przyjęcie (web)
epic: E-01
story: S-01-05
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-005]
size: M                # S | M (L must be split)
layers: [db, backend, web]
requirements: [F-11, F-12, F-01, N-04]
threats: [TH-01, TH-02, TH-05, TH-06, TH-08, TH-13]
screens: [SC-07, SC-08, SC-01, SC-02]
---

# T-008 Link zaproszenia i jego przyjęcie (web)

## Goal

Właściciel tworzy na SC-07 jednorazowy link zaproszenia ważny 7 dni, kopiuje go i może go unieważnić. Osoba z linkiem widzi na SC-08, kto i do jakiej listy ją zaprasza, i dołącza — od razu, po zalogowaniu albo po założeniu konta; nieważny link nie daje dostępu i nie zdradza treści listy.

## Demo

1. Ania (właściciel) na SC-06 → „Uczestnicy” → SC-07 „Utwórz link zaproszenia” → InviteLinkBox „Link jednorazowy, ważny do <data>” → „Kopiuj” → „Link skopiowany”.
2. Tomek bez konta otwiera link (inna przeglądarka): „Ania zaprasza Cię do listy „Dom”.” → „Załóż konto i dołącz” → SC-02 z informacją o zaproszeniu → po rejestracji od razu SC-06 „Dom” z „Dołączyłeś(-aś) do listy „Dom”.”; adres zaproszenia nie zostaje w historii.
3. Tomek na SC-05 widzi „Dom” z „od Ania”; Ania na SC-05 widzi awatar Tomka w karcie; wykorzystany link zniknął z SC-07.
4. Ponowne otwarcie tego samego linku: „Ten link nie działa”. Link unieważniony przez Anię i link sprzed 8 dni — to samo. Ania otwierająca własny link: „To Twoja lista — nie musisz dołączać.”

## Context

- BRD: F-11 — „jednorazowy link ważny 7 dni, kopiowany i wysyłany dowolnym kanałem; właściciel unieważnia niewykorzystany; tylko właściciel zaprasza; nieważny link — czytelny komunikat (MC-02)”; F-12 — „zalogowany przyjmuje i widzi listę; bez konta — rejestracja i od razu lista; limit 20 uczestników; właściciel / uczestnik na własnym linku — nic się nie zmienia, czytelny komunikat”; F-01 — „z linku zaproszenia po rejestracji widzi od razu listę”.
- Architektura: moduł `zaproszenia`, J-04 (sekwencja), tabela autoryzacji (podgląd publiczny z ważnym tokenem: tylko nazwa listy i imię właściciela), `api.md` „Zaproszenia” (`url` = `https://<web>/zaproszenie/<token>`, rejestracja z `invitationToken` — błąd zaproszenia nie blokuje rejestracji), `data-model.md` (`invitation`, warunkowy `UPDATE` przyjęcia, limit 20 z `FOR UPDATE`, właściciel nie jest wierszem `list_member`), ADR 0005 (token jawny), przewodnik web (token ze ścieżki, `replace` po przyjęciu).
- Design: SC-07 — w tym tasku wiersz właściciela i sekcja „Zaproszenia” (InviteLinkBox, „Kopiuj”, „Unieważnij”, „Utwórz link zaproszenia”, podpowiedź, stany Empty, Loading, Error — wczytanie / limit / kopiowanie, Toast); ikona „Uczestnicy” na SC-06 tylko dla właściciela. SC-08 — wszystkie stany. SC-01 / SC-02 — stan „Info — zaproszenie” i powrót na SC-08.
- Depends on: T-005 — `requireListAccess`, przegląd list z `role`, `owner`, `members`, ekran SC-06; (przez T-005) T-004 — rejestracja, logowanie, ekrany SC-01 / SC-02.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given właściciel listy, when `POST /api/v1/lists/:listId/invitations`, then 201 `{ id, url, expiresAt }` z `expiresAt` = teraz + 7 dni; `GET …/invitations` zwraca tylko nieużyte, nieunieważnione, niewygasłe; SC-07 pokazuje nowy InviteLinkBox na górze z fokusem na „Kopiuj”. — verified by: test integracyjny `invitations.create.test` (zegar) + test komponentu SC-07
- [ ] AC2: Given aktywny link, when właściciel go unieważni (`DELETE …/invitations/:invitationId`), then 204, link znika z SC-07 (komunikat `polite` „Link unieważniony”, fokus na „Utwórz link zaproszenia”), a `GET /api/v1/invitations/:token` zwraca 410. — verified by: test integracyjny + test komponentu
- [ ] AC3: Given ważny token, when ktokolwiek (także anonim) wywoła `GET /api/v1/invitations/:token`, then dostaje tylko `{ listName, ownerName }`; SC-08 pokazuje „{imię} zaprasza Cię do listy „{nazwa}”.” z fokusem na `h1` i przyciskami zależnymi od zalogowania. — verified by: test integracyjny + test komponentu SC-08
- [ ] AC4: Given zalogowany domownik i ważny token, when `POST /api/v1/invitations/:token/accept`, then 200 `{ listId }`, powstaje członkostwo, link jest oznaczony jako użyty; lista jest w jego `GET /api/v1/lists` z `role: "participant"`; SC-08 przechodzi na SC-06 z komunikatem „Dołączyłeś(-aś)…”, adres zaproszenia zastąpiony w historii (`replace`). — verified by: test integracyjny `invitations.accept.test` + test komponentu SC-08
- [ ] AC5: Given osoba bez konta z ważnym tokenem, when zarejestruje się z `invitationToken`, then konto powstaje i jest od razu uczestnikiem listy; given nieważny token przy rejestracji, then konto i tak powstaje, a klient pokazuje stan „Ten link nie działa”. Given „Mam konto — zaloguj się”, then po zalogowaniu SC-08 dołącza automatycznie; SC-01 / SC-02 pokazują „Info — zaproszenie” z nazwą listy, e-mail z SC-01 jest wstępnie wypełniony w SC-02. — verified by: testy integracyjne `sign-up-invitation.test` + testy komponentów + E2E J-04
- [ ] AC6: Given lista ma 20 uczestników, when ktoś przyjmuje zaproszenie, then 409 `limit_reached` (`participants`), członkostwo nie powstaje, link pozostaje nieużyty; SC-08 pokazuje komunikat o limicie; SC-07 przy 20 uczestnikach pokazuje ostrzeżenie i nieaktywny „Utwórz link zaproszenia” (`POST …/invitations` → 409). — verified by: testy integracyjne + testy komponentów
- [ ] AC7: Given właściciel na własnym linku albo uczestnik na liście, na której już jest, when przyjmuje, then 409 `own_list` / `already_member`, nic się nie zmienia (link nieużyty); SC-08 pokazuje „To Twoja lista…” / „Już jesteś na tej liście.” + „Otwórz listę”. — verified by: testy integracyjne + test komponentu SC-08
- [ ] AC8: Given schowek niedostępny, when właściciel kliknie „Kopiuj”, then link jest zaznaczony w polu i widać „Skopiuj link ręcznie.” — verified by: test komponentu (schowek podstawiony)
- [ ] AC9: Given SC-07 (pusty, z linkami, limit, błąd kopiowania) i SC-08 (każdy stan), when E2E je odwiedza, then axe bez naruszeń; Toast i komunikaty z `role="status"`. — verified by: E2E Playwright + axe
- [ ] SEC1 (TH-05): Given link użyty, unieważniony albo starszy niż 7 dni (zegar), when ktoś go przyjmuje lub podgląda, then 410 `invitation_invalid` bez nazwy listy i imienia właściciela; given dwa równoległe przyjęcia jednego linku przez dwie osoby, then dokładnie jedno się udaje, drugie dostaje 410. — verified by: testy integracyjne `invitations.mc02.test`
- [ ] SEC2 (TH-01): Given lista A i domownik B bez dostępu, when B wywoła `GET`, `POST` lub `DELETE` na `/api/v1/lists/<A>/invitations*`, then 404 i nic się nie zmienia; anonim 401; przyjęcie zaproszenia bez sesji → 401. — verified by: testy integracyjne `invitations.authz.test`
- [ ] SEC3 (TH-02): Given uczestnik listy A, when wywoła `GET`, `POST` lub `DELETE` na zaproszeniach A, then 403 `owner_only`; SC-06 uczestnika nie pokazuje ikony „Uczestnicy”. — verified by: test integracyjny + test komponentu
- [ ] SEC4 (TH-06): Given nowy link, when sprawdzę token, then ma 32 bajty z `crypto.randomBytes` zakodowane base64url (43 znaki), a dwa tokeny są różne; given zbyt wiele zapytań `GET /api/v1/invitations/:token` lub `POST …/accept` z jednego IP, then 429. — verified by: test unit generatora + test integracyjny limitu
- [ ] SEC5 (TH-08): Given żądanie podglądu lub przyjęcia, when API je zaloguje, then ścieżka ma token zredagowany (np. `/api/v1/invitations/[redacted]`); SC-08 nie ładuje zasobów z zewnętrznych domen, a odpowiedź ma `Referrer-Policy: no-referrer`. — verified by: test integracyjny logów + E2E (lista żądań sieciowych strony)
- [ ] SEC6 (TH-13): Given limit tworzenia linków, when właściciel (albo skrypt) tworzy linki ponad próg, then 429. — verified by: test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- generator tokenów (funkcja z wstrzykniętym źródłem losowości)
- HTTP API `/api/v1/lists/:listId/invitations*`, `/api/v1/invitations/:token*` i rejestracja z `invitationToken` przez `fastify.inject`
- ekrany SC-07, SC-08, SC-01, SC-02 z API podstawionym przez MSW
- przeglądarka (Playwright, dwa konteksty) dla J-04

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | token: 32 bajty, base64url, z CSPRNG | unit | Vitest | SEC4 |
| 2 | utworzenie i lista aktywnych linków (zegar 7 dni) | integration | Vitest + Testcontainers | AC1 |
| 3 | unieważnienie → 410 na podglądzie | integration | Vitest + Testcontainers | AC2 |
| 4 | podgląd ważnego tokenu: tylko nazwa listy i imię | integration | Vitest + Testcontainers | AC3 |
| 5 | przyjęcie przez zalogowanego: członkostwo, link użyty, lista w przeglądzie | integration | Vitest + Testcontainers | AC4 |
| 6 | MC-02: użyty, unieważniony, wygasły (zegar), dwa równoległe przyjęcia | integration | Vitest + Testcontainers | SEC1 |
| 7 | limit 20 (przyjęcie i tworzenie linku) | integration | Vitest + Testcontainers | AC6 |
| 8 | `own_list`, `already_member` bez skutków | integration | Vitest + Testcontainers | AC7 |
| 9 | rejestracja z ważnym / nieważnym `invitationToken` | integration | Vitest + Testcontainers | AC5 |
| 10 | autoryzacja: obcy 404, anonim 401, uczestnik 403 | integration | Vitest + Testcontainers | SEC2, SEC3 |
| 11 | limity 429 (podgląd, przyjęcie, tworzenie) | integration | Vitest + Testcontainers | SEC4, SEC6 |
| 12 | redakcja tokenu w logach | integration | Vitest | SEC5 |
| 13 | SC-07: pusty, utworzenie (fokus), kopiuj (Toast / ręcznie), unieważnij, limit | component | Vitest + RTL + MSW | AC1, AC2, AC6, AC8 |
| 14 | SC-08: każdy stan, przyciski zależne od zalogowania, `replace` po dołączeniu | component | Vitest + RTL + MSW | AC3–AC7 |
| 15 | SC-01 / SC-02: kontekst zaproszenia, powrót na SC-08, e-mail wstępnie wypełniony | component | Vitest + RTL + MSW | AC5 |
| 16 | E2E J-04: link → rejestracja drugiego konta → lista u obu → ponowne użycie linku; axe; brak żądań do obcych domen | E2E | Playwright (dwa konteksty) + axe | AC4, AC5, AC9, SEC1, SEC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** zegar (7 dni), źródło losowości w teście generatora, schowek w testach komponentów; API tylko w testach komponentów. Baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** link otwarty w aplikacji pocztowej / komunikatorze na telefonie (przeglądarka wbudowana); link skopiowany z ucięciem znaku; dwa aktywne linki naraz; „Nie teraz” — link dalej ważny; rejestracja z linkiem, który w międzyczasie wygasł; 20. i 21. uczestnik (fabryka lub kilka kont).
- **Design states:** SC-07: pusty, ładowanie, błąd, limit, kopiowanie niedostępne, sukces; SC-08: sprawdzanie, nieważny, limit, już na liście, własna lista, sieć, sukces.
- **Platforms / devices:** iPhone (Safari) i Android (Chrome) jako odbiorca linku; komputer jako właściciel; 320 px i 200 %.
- **Accessibility:** fokus na `h1` SC-08 po sprawdzeniu linku; klawiatura na SC-07 (utwórz, kopiuj, unieważnij — fokus po akcji); czytnik ekranu ogłasza Toast; brak ponownego wpisywania danych po powrocie z SC-01 / SC-02 (3.3.7).
- **Security / privacy:** MC-02 ręcznie: ponowne użycie wykorzystanego linku z drugiego konta, link unieważniony, równoległe otwarcie przez dwie osoby; TH-01 / TH-02 — drugie konto i uczestnik próbują listować i tworzyć linki cudzej listy przez API; TH-08 — logi bez tokenu, brak `Referer`; podgląd nieważnego linku nie zdradza nazwy listy.
- **Regression:** J-01 (rejestracja i logowanie bez zaproszenia), J-02 (przegląd list: „od <imię>”, awatary uczestników), usunięcie listy usuwa jej zaproszenia (kaskada).

## Implementation notes

- Przyjęcie w jednej transakcji: warunkowy `UPDATE invitation … RETURNING list_id`, blokada listy, sprawdzenie limitu 20, `INSERT list_member`; `own_list` i `already_member` sprawdzane przed oznaczeniem linku jako użytego (link zostaje ważny).
- Tylko `requireListAccess(…, "owner")` dla tras właściciela; podgląd i przyjęcie bez `requireListAccess` (token jest uprawnieniem), z limitem `@fastify/rate-limit` per IP.
- Próg limitu tworzenia linków i zapytań o token ustalić w tasku (propozycja: 20 linków / h na właściciela, 30 zapytań / min per IP) i zapisać w jednym miejscu.
- Token ze ścieżki `/zaproszenie/:token`; kontekst zaproszenia przy przejściu na SC-01 / SC-02 bez zapisu tokenu w `localStorage` (np. w stanie nawigacji lub w adresie powrotu).
- Sekcja „Na liście” SC-07 (uczestnicy z e-mailami dla właściciela, usuwanie, opuszczanie) — E-02 (S-02-02); tu tylko wiersz właściciela.
- Fabryka `createInvitation(list)`.
- Zdarzenia `invitations.changed`, `members.changed`, `lists.changed` — T-009.

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

<!-- QA rounds are appended below by /qa-task -->
