---
id: T-008
title: Link zaproszenia i jego przyjęcie (web)
epic: E-01
story: S-01-05
status: in-progress         # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given właściciel listy, when `POST /api/v1/lists/:listId/invitations`, then 201 `{ id, url, expiresAt }` z `expiresAt` = teraz + 7 dni; `GET …/invitations` zwraca tylko nieużyte, nieunieważnione, niewygasłe; SC-07 pokazuje nowy InviteLinkBox na górze z fokusem na „Kopiuj”. — verified by: test integracyjny `invitations.create.test` (zegar) + test komponentu SC-07
- [x] AC2: Given aktywny link, when właściciel go unieważni (`DELETE …/invitations/:invitationId`), then 204, link znika z SC-07 (komunikat `polite` „Link unieważniony”, fokus na „Utwórz link zaproszenia”), a `GET /api/v1/invitations/:token` zwraca 410. — verified by: test integracyjny + test komponentu
- [x] AC3: Given ważny token, when ktokolwiek (także anonim) wywoła `GET /api/v1/invitations/:token`, then dostaje tylko `{ listName, ownerName }`; SC-08 pokazuje „{imię} zaprasza Cię do listy „{nazwa}”.” z fokusem na `h1` i przyciskami zależnymi od zalogowania. — verified by: test integracyjny + test komponentu SC-08
- [x] AC4: Given zalogowany domownik i ważny token, when `POST /api/v1/invitations/:token/accept`, then 200 `{ listId }`, powstaje członkostwo, link jest oznaczony jako użyty; lista jest w jego `GET /api/v1/lists` z `role: "participant"`; SC-08 przechodzi na SC-06 z komunikatem „Dołączyłeś(-aś)…”, adres zaproszenia zastąpiony w historii (`replace`). — verified by: test integracyjny `invitations.accept.test` + test komponentu SC-08
- [x] AC5: Given osoba bez konta z ważnym tokenem, when zarejestruje się z `invitationToken`, then konto powstaje i jest od razu uczestnikiem listy; given nieważny token przy rejestracji, then konto i tak powstaje, a klient pokazuje stan „Ten link nie działa”. Given „Mam konto — zaloguj się”, then po zalogowaniu SC-08 dołącza automatycznie; SC-01 / SC-02 pokazują „Info — zaproszenie” z nazwą listy, e-mail z SC-01 jest wstępnie wypełniony w SC-02. — verified by: testy integracyjne `sign-up-invitation.test` + testy komponentów + E2E J-04
- [x] AC6: Given lista ma 20 uczestników, when ktoś przyjmuje zaproszenie, then 409 `limit_reached` (`participants`), członkostwo nie powstaje, link pozostaje nieużyty; SC-08 pokazuje komunikat o limicie; SC-07 przy 20 uczestnikach pokazuje ostrzeżenie i nieaktywny „Utwórz link zaproszenia” (`POST …/invitations` → 409). — verified by: testy integracyjne + testy komponentów
- [x] AC7: Given właściciel na własnym linku albo uczestnik na liście, na której już jest, when przyjmuje, then 409 `own_list` / `already_member`, nic się nie zmienia (link nieużyty); SC-08 pokazuje „To Twoja lista…” / „Już jesteś na tej liście.” + „Otwórz listę”. — verified by: testy integracyjne + test komponentu SC-08
- [x] AC8: Given schowek niedostępny, when właściciel kliknie „Kopiuj”, then link jest zaznaczony w polu i widać „Skopiuj link ręcznie.” — verified by: test komponentu (schowek podstawiony)
- [x] AC9: Given SC-07 (pusty, z linkami, limit, błąd kopiowania) i SC-08 (każdy stan), when E2E je odwiedza, then axe bez naruszeń; Toast i komunikaty z `role="status"`. — verified by: E2E Playwright + axe
- [x] SEC1 (TH-05): Given link użyty, unieważniony albo starszy niż 7 dni (zegar), when ktoś go przyjmuje lub podgląda, then 410 `invitation_invalid` bez nazwy listy i imienia właściciela; given dwa równoległe przyjęcia jednego linku przez dwie osoby, then dokładnie jedno się udaje, drugie dostaje 410. — verified by: testy integracyjne `invitations.mc02.test`
- [x] SEC2 (TH-01): Given lista A i domownik B bez dostępu, when B wywoła `GET`, `POST` lub `DELETE` na `/api/v1/lists/<A>/invitations*`, then 404 i nic się nie zmienia; anonim 401; przyjęcie zaproszenia bez sesji → 401. — verified by: testy integracyjne `invitations.authz.test`
- [x] SEC3 (TH-02): Given uczestnik listy A, when wywoła `GET`, `POST` lub `DELETE` na zaproszeniach A, then 403 `owner_only`; SC-06 uczestnika nie pokazuje ikony „Uczestnicy”. — verified by: test integracyjny + test komponentu
- [x] SEC4 (TH-06): Given nowy link, when sprawdzę token, then ma 32 bajty z `crypto.randomBytes` zakodowane base64url (43 znaki), a dwa tokeny są różne; given zbyt wiele zapytań `GET /api/v1/invitations/:token` lub `POST …/accept` z jednego IP, then 429. — verified by: test unit generatora + test integracyjny limitu
- [x] SEC5 (TH-08): Given żądanie podglądu lub przyjęcia, when API je zaloguje, then ścieżka ma token zredagowany (np. `/api/v1/invitations/[redacted]`); SC-08 nie ładuje zasobów z zewnętrznych domen, a odpowiedź ma `Referrer-Policy: no-referrer`. — verified by: test integracyjny logów + E2E (lista żądań sieciowych strony)
- [x] SEC6 (TH-13): Given limit tworzenia linków, when właściciel (albo skrypt) tworzy linki ponad próg, then 429. — verified by: test integracyjny

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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

### TDD (red → green)

| # | Test | Red (pierwszy przebieg, przed kodem) | Teraz |
| --- | --- | --- | --- |
| 1 | `apps/api/test/invitations.token.test.ts` (2) | `Error: not implemented` (stub `invitationToken`) | pass |
| 2 | `invitations.create.test.ts` (2, zegar) | `expected 404 to be 201`, `expected 404 to be 200` (moduł niezarejestrowany) | pass |
| 3 | `invitations.revoke.test.ts` (2) | `expected 404 to be 200` (brak podglądu / unieważnienia); test „404 dla nieznanego / unieważnionego / nie-UUID” przeszedł od razu (fallback 404) | pass |
| 4 | `invitations.preview.test.ts` (2) | `TypeError: createInvitation is not a function` (brak fabryki; podgląd powstał w teście 3, który wymaga 200 przed unieważnieniem). Sprawdzenie, że gryzie: dodatkowe pole w odpowiedzi → `expected { leaked: true, listName: 'Dom', …(1) } to deeply equal { listName: 'Dom', ownerName: 'Ania' }`, kod przywrócony | pass |
| 5 | `invitations.accept.test.ts` (1) | `expected 404 to be 200` | pass |
| 6 | `invitations.mc02.test.ts` (4: użyty, unieważniony, wygasły z zegarem, 2 równoległe) | przeszedł od razu (warunkowy `UPDATE` z testu 5). Sprawdzenie: `UPDATE` bez warunku ważności → 4 × fail, kod przywrócony | pass |
| 7 | `invitations.limit.test.ts` (3) | `expected 200 to be 409` (przyjęcie przy 20), `expected 201 to be 409` (tworzenie przy 20); 20. uczestnik przeszedł | pass |
| 8 | `invitations.own-member.test.ts` (2) | `expected 200 to be 409` (właściciel dopisany jako uczestnik!), `expected 500 to be 409` (naruszenie PK) | pass |
| 9 | `sign-up-invitation.test.ts` (3) | `expected undefined to deeply equal { listId }`, `expected undefined to deeply equal { error }`; bez tokenu przeszedł | pass |
| 10 | `invitations.authz.test.ts` (3) | przeszedł od razu (`requireListAccess(…, "owner")` od testu 2). Sprawdzenie: rola `member` → `GET …/invitations: expected 200 to be 403`, kod przywrócony | pass |
| 11 | `invitations.rate-limit.test.ts` (3) | `expected 410 to be 429` (podgląd, przyjęcie), `expected 201 to be 429` (tworzenie) | pass |
| 12 | `invitations.logs.test.ts` (1) | `expected '{"level":30,…' not to contain '88tRrjCY…'` (token w `req.url`) | pass |
| 13 | `apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.test.tsx` (12, w tym ikona SC-06) | 12 × `Unable to find … heading "Uczestnicy"` / `link "Uczestnicy"` (stub) | pass |
| 14 | `SC-08-zaproszenie/InvitationScreen.test.tsx` (11) | 11 × fail na stubie (brak `h1`, tekstów i przycisków) | pass |
| 15 | `SC-08-zaproszenie/InvitationScreen.entry.test.tsx` (4: SC-01 → auto-dołączenie, SC-01 → SC-02 z e-mailem, rejestracja z tokenem, rejestracja z nieważnym tokenem) | `Unable to find … „Zaloguj się, żeby dołączyć do listy „Dom”.”`, `… „Po założeniu konta dołączysz…”`, `Unable to find role="heading" … "Ten link nie działa"` | pass |
| 16 | `apps/web/e2e/j04-zaproszenie.spec.ts` (3 × telefon/komputer) | napisany po zachowaniu na szybszych seamach; pierwszy przebieg: błąd w samym teście (sprawdzanie originu przy `about:blank`), poprawiony | pass |

Dodane do planu w trakcie: 20. uczestnik dołącza (granica limitu); limit tworzenia linków — okno godzinowe przesuwa się z zegarem i dotyczy jednej listy; SC-07 — zerwana odpowiedź przy tworzeniu i unieważnieniu pokazuje stan z serwera; 409 `limit_reached` przy tworzeniu odświeża listę; SC-08 — 410 przy dołączaniu (link użyty w międzyczasie), brak sieci przy dołączaniu; SC-01 → SC-02 zachowuje kontekst i e-mail.

Zmienione istniejące pliki testowe (bez zmiany asercji): `apps/web/test/render.tsx` — `renderApp` przyjmuje też historię (tablica wpisów); `apps/api/test/factories.ts` — fabryka `createInvitation`.

### Kryteria akceptacji

- [x] AC1: `invitations.create.test` — 201 `{ id, url, expiresAt }` (tylko te klucze), `url` = `<APP_ORIGIN>/zaproszenie/<43 znaki>`, `expiresAt` = zegar + 7 dni; `GET` pomija użyte, unieważnione i wygasłe (dokładnie po 7 dniach), od najnowszego. `ParticipantsScreen.test` — nowy InviteLinkBox na górze, fokus na „Kopiuj”, dwa kliknięcia w trakcie zapisu = jedno żądanie.
- [x] AC2: `invitations.revoke.test` (204, pusta lista, podgląd 410) + `ParticipantsScreen.test` (link znika, „Link unieważniony” w `role="status"`, fokus na „Utwórz link zaproszenia”) + E2E („SC-08 own link and a revoked link”).
- [x] AC3: `invitations.preview.test` — anonim, inny domownik i właściciel dostają tylko `{ listName, ownerName }`; `InvitationScreen.test` — „Ania zaprasza Cię do listy „Dom”.”, fokus na `h1`, przyciski zależne od sesji.
- [x] AC4: `invitations.accept.test` (200 `{ listId }`, członkostwo, `used_by`, lista z `role: "participant"`, właściciel widzi uczestnika, link znika z aktywnych) + `InvitationScreen.test` (SC-06 z „Dołączyłeś(-aś)…”, `historyAction = REPLACE`, wstecz → wpis sprzed SC-08) + E2E (po `goBack` adres bez `/zaproszenie/`).
- [x] AC5: `sign-up-invitation.test` (ważny token → uczestnik od razu, nieważny / zły format → konto powstaje, `invitation: { error: { code: "invitation_invalid" } }`) + `InvitationScreen.entry.test` (info na SC-01 i SC-02, e-mail z SC-01 w SC-02, po logowaniu auto-dołączenie, rejestracja wysyła `invitationToken` i bez drugiego żądania trafia na SC-06, nieważny link → „Ten link nie działa”) + E2E J-04.
- [x] AC6: `invitations.limit.test` (409 `limit_reached` `participants`, brak członkostwa, link nadal aktywny; tworzenie linku przy 20 → 409) + `InvitationScreen.test` (komunikat o limicie) + `ParticipantsScreen.test` (ostrzeżenie, przycisk nieaktywny; także po 409 z API).
- [x] AC7: `invitations.own-member.test` (409 `own_list` / `already_member` z `listId`, członkostwa bez zmian, `used_at` null) + `InvitationScreen.test` („To Twoja lista…” / „Już jesteś na tej liście.” + „Otwórz listę” → `/listy/<listId>`) + E2E (właściciel na własnym linku).
- [x] AC8: `ParticipantsScreen.test` — schowek odrzuca → pole z fokusem, zaznaczenie 0…długość linku, „Skopiuj link ręcznie.”, bez Toastu; E2E (schowek podstawiony w `addInitScript`).
- [x] AC9: E2E axe bez naruszeń: SC-07 pusty, z linkiem, Toast „Link skopiowany”, limit + błąd kopiowania; SC-08 zaproszenie, SC-02 z info, SC-06 po dołączeniu, nieważny link, własna lista, limit, już na liście, brak sieci (telefon 390 × 844 i komputer 1280 × 800). Toast i komunikaty w `role="status"` (test komponentu).
- [x] SEC1 (TH-05): `invitations.mc02.test` — użyty, unieważniony, wygasły (zegar: 1 s przed 7 dniami działa, po — nie) → 410 `invitation_invalid` bez „Dom” i „Ania” w treści; 2 równoległe przyjęcia → `[200, 410]`, jedno członkostwo.
- [x] SEC2 (TH-01): `invitations.authz.test` — inny domownik: `GET` / `POST` / `DELETE` → 404 `not_found`, nic się nie zmienia; anonim → 401 (także przyjęcie, link nieużyty).
- [x] SEC3 (TH-02): `invitations.authz.test` — uczestnik → 403 `owner_only`; `ParticipantsScreen.test` — ikona „Uczestnicy” tylko u właściciela.
- [x] SEC4 (TH-06): `invitations.token.test` — 32 bajty ze źródła losowości, base64url (43 znaki), produkcja = `crypto.randomBytes`, dwa tokeny różne; `invitations.rate-limit.test` — 31. zapytanie z IP w minucie → 429 `rate_limited` (osobno podgląd i przyjęcie), inne IP działa.
- [x] SEC5 (TH-08): `invitations.logs.test` — w logach brak tokenu, `req.url` = `/api/v1/invitations/[redacted]…`; E2E — `Referrer-Policy: no-referrer` na odpowiedzi SC-08, zero żądań do innych originów z karty odbiorcy.
- [x] SEC6 (TH-13): `invitations.rate-limit.test` — 21. link listy w godzinie → 429; inna lista i link po upływie godziny działają.

### Przebiegi (ten przebieg)

- `pnpm test` — 72 pliki, 340 testów, pass; `pnpm test:mobile` — 10 pass.
- `pnpm test:e2e` — 32 pass (w tym 6 nowych), 5,8 min, Windows 1 worker.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd 0 klonów — trzecie powtórzenie blokady wiersza listy wydzielone do `listy.lockList`; dependency-cruiser bez naruszeń), `pnpm design-check`, `pnpm build` — OK.

### Decyzje i odstępstwa (do przeniesienia do `docs/architecture/` przez właściciela — implementer ich nie edytuje)

- **`api.md`, „Zaproszenia”:** 409 `own_list` / `already_member` mają w błędzie `listId` (SC-08 „Otwórz listę”; domownik i tak ma dostęp do tej listy). Odpowiedź rejestracji z `invitationToken` ma pole `invitation`: `{ listId }` albo `{ error: { code, limit? } }` (typ `SignUpResponse` w `packages/shared`). `DELETE` linku użytego, wygasłego lub już unieważnionego → 404 `not_found`.
- **Progi (jedno miejsce: `RATE_LIMITS` w `packages/shared/src/limits.ts`):** podgląd i przyjęcie — po 30 / min per IP (osobne liczniki tras, `@fastify/rate-limit` w pamięci, ADR 0003); tworzenie — **20 linków / h na listę** (liczone w bazie pod blokadą listy, więc steruje nim zegar domeny). Propozycja z taska mówiła „na właściciela”; per lista nie wymaga dotykania tabel innych list ani sesji w `keyGenerator`, a właściciel ma najwyżej 50 list.
- **Tabela `invitation`:** dodatkowy indeks `used_by` (kaskada `SET NULL` przy usunięciu konta). Sprzątanie linków 30 dni po wygaśnięciu (inwentarz danych) — nie w tym tasku (brak zadania dziennego).
- **Granice modułów:** członkostwo dopisuje `listy` (`Lists.join` w transakcji `zaproszenia`; błąd wycofuje oznaczenie linku). Blokada wiersza `shopping_list` dla `pozycje` i `zaproszenia` idzie przez `listy.lockList`. Rejestracja (`konta`) przyjmuje zaproszenie przez `Accounts.acceptInvitationsOnSignUp` (podawane przez `zaproszenia` po utworzeniu — bez cyklu zależności).
- **Web:** kontekst zaproszenia (token, nazwa listy) w stanie nawigacji, nie w `localStorage`; SC-08 → SC-01 / SC-02 przez `replace`, więc adres z tokenem nie zostaje w historii. Po zalogowaniu `PublicOnly` wraca na SC-08 z `join` (auto-dołączenie); po rejestracji z udanym dołączeniem — od razu SC-06.
- **Teksty spoza tabel „Copy”** (do potwierdzenia w designie): SC-07 „Utworzono zbyt wiele linków. Spróbuj ponownie za godzinę.”, „Nie udało się utworzyć linku. Spróbuj ponownie.”, „Nie udało się unieważnić linku. Spróbuj ponownie.”; SC-08 „Zbyt wiele prób. Spróbuj ponownie za minutę.”, „Coś poszło nie tak. Spróbuj ponownie.”; wiersz właściciela „właściciel · Ty”; data w InviteLinkBox „9 listopada” (`Intl.DateTimeFormat("pl-PL", { day, month: "long" })`). Nagłówek „Na liście (N z 20)” liczy uczestników bez właściciela; pełna lista uczestników — E-02.
- **Layer guides (fakty):** `db.md`, `backend.md`, `web.md` — „Gdzie jest kod” i „Historia zmian” uzupełnione o T-008.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: fail

Środowisko: lokalnie (Windows, Docker/Testcontainers). `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych · `typecheck`, `lint` (0 ostrzeżeń), `format:check`, `quality` (jscpd, dependency-cruiser), `design-check`, `build` ✔ · `pnpm test` — 72 pliki / 340 testów ✔ · `pnpm test:mobile` ✔ · `pnpm test:e2e` — 28 passed; 4 testy `j04-zaproszenie.spec.ts` czerwone w pierwszym przebiegu z powodu **mojego** spot-checku (build E2E skompilował zmutowane `invitations-repository.ts`); po przywróceniu kodu i ponownym buildzie `j04-zaproszenie.spec.ts` — 6 passed (telefon + komputer).

Kryteria akceptacji: AC1 pass · AC2 pass · AC3 pass · AC4 pass · AC5 pass · AC6 pass (integracja; tworzenie przy 20 → 409) · AC7 pass (ręcznie: `own_list` / `already_member` z `listId`) · AC8 pass (komponent + E2E) · AC9 pass (axe w E2E) · SEC1 pass (ręcznie: użyty link → 410 bez nazwy i imienia; 2 równoległe przyjęcia → `[200, 410]`) · SEC2 pass (ręcznie: obcy GET/POST/DELETE → 404, także DELETE linku Ani przez ścieżkę własnej listy; anonim 401, przyjęcie bez sesji 401) · SEC3 pass (ręcznie: uczestnik → 403 `owner_only`) · SEC4 pass (token 43 znaki; 32 × podgląd z jednego IP → 30 × 410, potem 429) · **SEC5 fail w zakresie TH-08** — patrz #1 (trasy `/api/v1/invitations/…` są redagowane poprawnie, 42 wpisy `[redacted]`; `Referrer-Policy: no-referrer` na SC-08 i API potwierdzone) · SEC6 pass (21. link listy w godzinie → 429).

Spot-checki (przywrócone `git checkout`, `git status` czysty):
- `invitations-repository.ts`: warunek `isActive(now)` usunięty z `accept` (i `activeListOf`) → `invitations.mc02.test` 4 × czerwony.
- `lists-repository.ts` `insertParticipant`: usunięte sprawdzenie `own_list` → `invitations.own-member.test` „the owner: 409 own_list…” czerwony.

Exploity (zbudowane API `dist/server.js` + własny kontener PostgreSQL, konta przez `POST /api/auth/sign-up/email`): wyniki jak wyżej; obcy `Origin` przy przyjęciu → 403 `invalid_origin`; tokeny wrogie (`x`, 43 × `A`, `' OR 1=1--`, 5000 znaków) → 410 / 404; rejestracja z tokenem nieprawidłowym i 15 000-znakowym → konto powstaje, `invitation.error.code = invitation_invalid`; z ważnym → od razu `role: "participant"`.

Ręczne sprawdzenia dostępności i urządzeń (VoiceOver / TalkBack, iPhone Safari, Android Chrome, przeglądarka wbudowana komunikatora, 320 px / 200 %): nie wykonane (brak narzędzi w trybie autonomicznym); częściowo pokryte E2E telefon/komputer z axe i asercjami fokusu. Do UAT.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | bezpieczeństwo (TH-08) | Token zaproszenia trafia do logów API w pełnej postaci. API serwuje też SPA (ADR 0006), więc otwarcie linku `GET /zaproszenie/<token>` loguje się jako `"req":{"method":"GET","url":"/zaproszenie/<token>"}` — redakcja `redactedUrl` obejmuje tylko `/api/v1/invitations/…`. Każdy otwarty link w produkcji zostawia ważny (do 7 dni, jeśli jeszcze nieużyty — np. „Nie teraz”) token w logach Fly. | Własny serwer: 1 wpis z pełnym tokenem `wuTdve…rbT8` przy `GET /zaproszenie/…`; E2E `apps/web/test-results/api.log` — 14 wpisów `"url":"/zaproszenie/<43 znaki>"`. `apps/api/src/logging.ts` `INVITATION_TOKEN_PATH`. | Redakcja także ścieżki `/zaproszenie/:token` (np. `/zaproszenie/[redacted]`) w serializerze żądań; test w `invitations.logs.test` dla żądania strony SC-08 (z `webDistDir` albo samym serializerem). |
| 2 | minor | dokumentacja | DoD „Architecture docs updated” nieodhaczony: odstępstwa z „Decyzji” nie są w `api.md` (409 `own_list` / `already_member` z `listId`, pole `invitation` w odpowiedzi rejestracji, `DELETE` nieaktywnego linku → 404, limit tworzenia 20 / h **na listę** zamiast „na właściciela”), a `backend.md` / `threat-model.md` opisują redakcję tylko `/invitations/:token`. | `docs/architecture/api.md:63-73`; Evidence, „Decyzje i odstępstwa”. | Dopisać do `api.md` i (z #1) do `backend.md` „Security rules”. |
| 3 | minor | backend | Błąd inny niż `DomainError` przy przyjęciu zaproszenia w rejestracji (np. baza) daje 500 po utworzeniu konta i ustawieniu ciasteczek — klient widzi błąd rejestracji, choć konto istnieje. | `zaproszenia/http/sign-up.ts` (`throw error`), `konta/http/auth-routes.ts` `relay(…, extra)`. | Zwrócić konto z `invitation: { error: { code: "internal" } }` albo udokumentować. |
| 4 | minor | walidacja | `invitationToken` w `signUpRequestSchema` bez limitu długości (15 000 znaków przyjęte; ogranicza tylko `bodyLimit` 16 kB). | `packages/shared/src/api/account.ts`. | `z.string().max(64)` albo regex formatu — błąd nadal nie blokuje rejestracji, jeśli tak zdecydowano. |
| 5 | note | design | Teksty spoza tabel „Copy” (limit tworzenia, błędy tworzenia / unieważnienia, 429 na SC-08, „właściciel · Ty”) i nagłówek „Na liście (N z 20)” liczący bez właściciela — do potwierdzenia w designie (zgłoszone przez implementera). | Evidence, „Teksty spoza tabel”. | Decyzja projektowa. |
| 6 | note | dane | Sprzątanie linków 30 dni po wygaśnięciu (inwentarz danych) nie zrealizowane — brak zadania w backlogu. | Evidence, „Tabela `invitation`”. | Zadanie w backlogu (np. z zadaniem dziennym). |
| 7 | note | testy | TDD: czerwone przebiegi udokumentowane dla testów 1–15; testy 6 i 10 przeszły od razu, z udokumentowanym sprawdzeniem, że gryzą (potwierdzone moim spot-checkiem dla 6). Testy na seamach, bez mocków własnych modułów. | Evidence, tabela TDD. | — |

Do zmiany przed kolejną rundą: #1 (redakcja `/zaproszenie/:token` w logu żądań + test).
