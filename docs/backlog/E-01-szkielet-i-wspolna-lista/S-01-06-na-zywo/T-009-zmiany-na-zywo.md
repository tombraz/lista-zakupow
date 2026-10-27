---
id: T-009
title: Zmiany na żywo przez WebSocket (web)
epic: E-01
story: S-01-06
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-007, T-008]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-14, F-05, N-06, N-04]
threats: [TH-03, TH-04, TH-14, TH-16, TH-17, TH-25]
screens: [SC-05, SC-06, SC-07]
---

# T-009 Zmiany na żywo przez WebSocket (web)

## Goal

Przy otwartej liście zmiany innych osób (pozycje, nazwa listy, usunięcie listy, wykorzystane linki) pojawiają się w ≤ 5 s bez odświeżania, a SC-05 odświeża się, gdy zmienia się coś na listach domownika. Połączenie WebSocket jest uwierzytelnione sesją, sprawdza dostęp przy subskrypcji, ma limity i jest zamykane przy wylogowaniu; po usunięciu listy uczestnik natychmiast traci subskrypcję.

## Demo

1. Ania (komputer) i Tomek (telefon) mają otwartą listę „Dom”. Tomek odhacza „Mleko” → u Ani w ≤ 5 s „Mleko” przechodzi do „Kupione” z „kupił(a) Tomek”, wiersz krótko podświetlony, licznik „N do kupienia” się zmienia; fokus Ani nie ucieka.
2. Ania dodaje „Chleb”, Tomek widzi go bez odświeżania; Ania usuwa pozycję, którą Tomek właśnie edytuje → Tomek widzi „Ta pozycja została usunięta przez inną osobę.”
3. Ania zmienia nazwę listy na „Dom i działka” → nowa nazwa u Tomka w AppBar i na SC-05. Ania usuwa listę → Tomek od razu wraca na SC-05 z „Lista „Dom i działka” została usunięta albo nie masz już do niej dostępu.”
4. Cecylia przyjmuje nowy link Ani → na SC-07 Ani link znika w ≤ 5 s; na SC-05 Cecylii lista pojawia się bez odświeżania.

## Context

- BRD: F-14 — „zmiana widoczna w ≤ 5 s bez odświeżania; ostatnia zapisana zmiana wygrywa; usunięcie wygrywa z edycją; zmiana nazwy / usunięcie listy widoczne u uczestnika”; N-06; F-05 — „nowa nazwa widoczna u wszystkich uczestników; usunięta lista znika u wszystkich”.
- Architektura: „Zmiany na żywo” (kanały `user:<id>` i `list:<id>`, `subscribe` z `requireListAccess`, publikacja po zatwierdzeniu transakcji, `revoke`, `closeSession`, ping 25 s / 10 s bez ponga), ADR 0003 (jedna instancja, rozsyłanie w pamięci), `api.md` „Zmiany na żywo” (typy wiadomości, ignorowanie zdarzeń z nie nowszym `updatedAt`), moduł `na-zywo`, przewodnik backend (Origin, token nigdy z query, publikacja po commit).
- Design: SC-06 stan „Live update” (podświetlenie wyłączone przy „ogranicz ruch”), „Dostęp odebrany / lista usunięta”, a11y — zmiany innych nie przenoszą fokusu, aktualizuje się tylko region „N do kupienia”; SC-05 — zmiany innych w ≤ 5 s, ogłoszenie `polite` „Nowa lista: <nazwa>”, stan „Info — usunięto dostęp”; SC-07 — wykorzystany link znika w ≤ 5 s.
- Depends on: T-007 — pełny zestaw operacji na pozycjach (dodanie, edycja, odhaczenie, usunięcie, usuń kupione), które publikują zdarzenia; T-008 — zaproszenia i przyjęcie (zdarzenia `invitations.changed`, `members.changed`, `lists.changed`); przez nie T-005 (zmiana nazwy, usunięcie listy) i T-004 (sesja, wylogowanie).

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given dwóch zalogowanych klientów WS zasubskrybowanych do listy, when jeden doda, edytuje, odhaczy lub usunie pozycję albo usunie kupione przez HTTP, then drugi dostaje odpowiednio `item.upserted` (z `Item` w kształcie odpowiedzi API), `item.deleted` lub `items.cleared` w < 5 s (w teście: < 1 s). — verified by: test integracyjny `live.items.test` (dwa klienty `ws`)
- [ ] AC2: Given zmiana nazwy listy, usunięcie listy, przyjęcie zaproszenia i unieważnienie linku, when operacja się zatwierdzi, then subskrybenci listy dostają `list.updated` / `list.deleted` / `members.changed`, właściciel `invitations.changed`, a kanały `user:<id>` wszystkich osób z dostępem (i nowego uczestnika) dostają `lists.changed`. — verified by: test integracyjny `live.lists.test`
- [ ] AC3: Given operacja, która się nie powiedzie (np. 409 duplikat, 404), when transakcja się wycofa, then żadne zdarzenie nie jest wysłane. — verified by: test integracyjny
- [ ] AC4: Given SC-06 otwarty u dwóch osób, when druga osoba zmieni pozycję, then u pierwszej zmiana pojawia się bez odświeżania, wiersz jest krótko podświetlony (bez animacji przy „ogranicz ruch”), fokus się nie zmienia, aktualizuje się region „N do kupienia”; zdarzenie z `updatedAt` nie nowszym niż stan klienta jest ignorowane. — verified by: test komponentu (podstawiony klient WS) + E2E J-05
- [ ] AC5: Given SC-06 lub SC-07 otwarty u uczestnika, when właściciel usunie listę, then uczestnik od razu trafia na SC-05 z komunikatem „Lista „<nazwa>” została usunięta albo nie masz już do niej dostępu.”; when właściciel zmieni nazwę, then AppBar i `h1` pokazują nową nazwę. — verified by: test komponentu + E2E J-05
- [ ] AC6: Given SC-05 otwarty, when ktoś udostępni domownikowi listę, zmieni nazwę lub stan pozycji na jego liście albo ją usunie, then karty odświeżają się bez przeładowania strony, a nowa lista jest ogłaszana `polite` „Nowa lista: <nazwa>”. — verified by: test komponentu + E2E
- [ ] AC7: Given SC-07 właściciela, when ktoś przyjmie link, then link znika z sekcji „Zaproszenia” bez odświeżania. — verified by: test komponentu (podstawiony klient WS)
- [ ] AC8: Given zerwane połączenie (serwer przestaje odpowiadać na ping przez 10 s albo zamyka połączenie), when połączenie wróci, then klient ponownie subskrybuje listę i pobiera jej aktualny stan; serwer wysyła ping co 25 s. — verified by: test integracyjny (ping, zegar) + test hooka `useLiveList` (podstawiony WS)
- [ ] AC9: Given E2E z dwoma kontekstami przeglądarki (Ania, Tomek), when Tomek odhacza pozycję, then u Ani zmiana jest widoczna w ≤ 5 s; skan axe na SC-06 po aktualizacji na żywo bez naruszeń. — verified by: E2E Playwright J-05 + axe
- [ ] SEC1 (TH-03): Given domownik B bez dostępu do listy A, when wyśle `subscribe { listId: A }`, then dostaje `error { code: "not_found", listId }`, a kolejne zmiany listy A do niego nie docierają; odmowa jest w logu `security`. — verified by: test integracyjny `live.authz.test`
- [ ] SEC2 (TH-04): Given uczestnik zasubskrybowany do listy A, when właściciel ją usunie, then uczestnik dostaje `list.deleted` i `access.revoked`, jego subskrypcja jest usunięta, zanim zostanie rozesłane jakiekolwiek kolejne zdarzenie, a ponowny `subscribe` daje `not_found`; zapis na tej liście zwraca 404. — verified by: test integracyjny
- [ ] SEC3 (TH-14): Given upgrade do `/api/v1/live` z nagłówkiem `Origin` spoza zaufanych (z ważnym ciasteczkiem), when serwer go odbierze, then połączenie jest odrzucone. — verified by: test integracyjny
- [ ] SEC4 (TH-16): Given upgrade bez ciasteczka, z tokenem sesji w parametrze adresu (`?token=…`), when serwer go odbierze, then połączenie jest odrzucone jak bez sesji (401), a token nie trafia do logów. — verified by: test integracyjny
- [ ] SEC5 (TH-17): Given otwarte połączenie WS sesji, when domownik się wyloguje, then serwer zamyka połączenia tej sesji (`closeSession`), a próba ponownego połączenia ze starym ciasteczkiem jest odrzucona. — verified by: test integracyjny
- [ ] SEC6 (TH-25): Given ważna sesja, when klient otworzy więcej połączeń niż limit na sesję, wyśle więcej wiadomości na sekundę niż limit albo wiadomość ponad limit rozmiaru lub niezgodną ze schematem zod, then nadmiarowe połączenie / połączenie naruszające limit jest zamykane (wiadomość niezgodna ze schematem → `error`, bez skutków). — verified by: test integracyjny `live.limits.test`

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- WebSocket `/api/v1/live` przez prawdziwego klienta `ws` + HTTP przez `fastify.inject` / prawdziwy port
- hook `useLiveList` i ekrany SC-05, SC-06, SC-07 z podstawionym klientem WS i API (MSW)
- przeglądarka (Playwright, dwa konteksty) dla J-05

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | schematy wiadomości WS (`packages/shared/src/api/live.ts`) | unit | Vitest | SEC6 |
| 2 | upgrade: bez sesji 401, token w query odrzucony, obcy `Origin` odrzucony | integration | Vitest + Testcontainers + `ws` | SEC3, SEC4 |
| 3 | `subscribe` własnej listy → `subscribed`; cudzej → `not_found`, brak zdarzeń | integration | Vitest + Testcontainers + `ws` | SEC1 |
| 4 | zdarzenia pozycji u drugiego klienta (< 1 s) | integration | Vitest + Testcontainers + `ws` | AC1 |
| 5 | brak zdarzeń przy wycofanej transakcji | integration | Vitest + Testcontainers + `ws` | AC3 |
| 6 | zdarzenia listy, zaproszeń i kanału użytkownika | integration | Vitest + Testcontainers + `ws` | AC2 |
| 7 | usunięcie listy: `access.revoked` i brak kolejnych zdarzeń; zapis 404 | integration | Vitest + Testcontainers + `ws` | SEC2 |
| 8 | wylogowanie zamyka połączenia sesji | integration | Vitest + Testcontainers + `ws` | SEC5 |
| 9 | limity połączeń, wiadomości i rozmiaru | integration | Vitest + Testcontainers + `ws` | SEC6 |
| 10 | ping co 25 s (zegar) | integration | Vitest + `ws` | AC8 |
| 11 | `useLiveList`: zastosowanie zdarzeń, ignorowanie starszych, ponowna subskrypcja i pobranie stanu po zerwaniu | component | Vitest + RTL (podstawiony WS) | AC4, AC8 |
| 12 | SC-06: podświetlenie, fokus bez zmian, region licznika, nowa nazwa, lista usunięta → SC-05 | component | Vitest + RTL + MSW | AC4, AC5 |
| 13 | SC-05: odświeżenie kart, ogłoszenie nowej listy, komunikat o usuniętej liście | component | Vitest + RTL + MSW | AC6 |
| 14 | SC-07: wykorzystany link znika | component | Vitest + RTL + MSW | AC7 |
| 15 | E2E J-05: dwie osoby, zmiana ≤ 5 s, usunięcie listy u uczestnika; axe | E2E | Playwright (dwa konteksty) + axe | AC9, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** zegar (ping); klient WS i API tylko w testach komponentów. Baza i serwer WS prawdziwe w integracji.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** dwie osoby edytują tę samą pozycję naraz (ostatni zapis wygrywa u obu); jedna usuwa, druga edytuje; szybka seria odhaczeń; karta w tle przez kilka minut (telefon zablokowany) i powrót — stan aktualny; ponowne otwarcie listy po jej usunięciu przez właściciela.
- **Design states:** SC-06: live update, edycja usuniętej pozycji, lista usunięta; SC-05: nowa udostępniona lista, usunięta lista; SC-07: wykorzystany link.
- **Platforms / devices:** dwa urządzenia (telefon + komputer, Safari i Chrome); pomiar opóźnienia stoperem (≤ 5 s) na staging, nie tylko lokalnie.
- **Accessibility:** czytnik ekranu: zmiany innych nie przerywają czytania i nie przenoszą fokusu, ogłaszany jest tylko licznik / nowa lista; „ogranicz ruch” wyłącza podświetlenie i animację.
- **Security / privacy:** TH-03 — drugie konto subskrybuje cudzą listę (DevTools: wysłanie `subscribe` z obcym `listId`); TH-04 — po usunięciu listy uczestnik nie dostaje już zdarzeń (karta WS w DevTools); TH-14 — połączenie z innego originu; TH-16 — w zakładce sieci brak tokenu w adresie WS; logi bez treści pozycji.
- **Regression:** J-02, J-03, J-04 (wszystkie operacje HTTP działają tak samo, także gdy WS jest niedostępny — po odświeżeniu stan aktualny).

## Implementation notes

- Moduł `na-zywo`: `LiveHub` w pamięci (ADR 0003), interfejs zdefiniowany w domenie, adapter `ws` w `infra`; moduły publikują wyłącznie przez `publish` / `revoke` / `closeSession` z `index.ts` i dopiero po zatwierdzeniu transakcji.
- `revoke(userId, listId)` w tej samej operacji co usunięcie listy (dla wszystkich uczestników), przed rozesłaniem kolejnego zdarzenia; wylogowanie (Better Auth hook) wywołuje `closeSession`.
- Uwierzytelnienie upgrade: web — ciasteczko sesji + sprawdzenie `Origin`. Nagłówek z tokenem dla mobile dochodzi w E-04 (S-04-03).
- Progi limitów WS (propozycja: 5 połączeń na sesję, 20 wiadomości / s, 4 kB na wiadomość) ustalić w tasku i zapisać w jednym miejscu.
- Klient: jedno połączenie po zalogowaniu (kanał `user:<id>` automatycznie); subskrypcja listy w jednym hooku `useLiveList` dla SC-06 i SC-07; dane przez TanStack Query (zdarzenia aktualizują cache).
- Pasek „brak połączenia” i blokada zapisów bez sieci (F-15) — E-02 (S-02-04); tu tylko ponowne połączenie i odświeżenie stanu.
- Utrata dostępu przez usunięcie uczestnika / opuszczenie listy — E-02 (S-02-02), z tym samym `revoke`.

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
