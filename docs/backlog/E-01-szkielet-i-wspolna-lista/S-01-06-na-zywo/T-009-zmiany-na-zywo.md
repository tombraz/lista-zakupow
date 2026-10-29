---
id: T-009
title: Zmiany na żywo przez WebSocket (web)
epic: E-01
story: S-01-06
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given dwóch zalogowanych klientów WS zasubskrybowanych do listy, when jeden doda, edytuje, odhaczy lub usunie pozycję albo usunie kupione przez HTTP, then drugi dostaje odpowiednio `item.upserted` (z `Item` w kształcie odpowiedzi API), `item.deleted` lub `items.cleared` w < 5 s (w teście: < 1 s). — verified by: test integracyjny `live.items.test` (dwa klienty `ws`)
- [x] AC2: Given zmiana nazwy listy, usunięcie listy, przyjęcie zaproszenia i unieważnienie linku, when operacja się zatwierdzi, then subskrybenci listy dostają `list.updated` / `list.deleted` / `members.changed`, właściciel `invitations.changed`, a kanały `user:<id>` wszystkich osób z dostępem (i nowego uczestnika) dostają `lists.changed`. — verified by: test integracyjny `live.lists.test`
- [x] AC3: Given operacja, która się nie powiedzie (np. 409 duplikat, 404), when transakcja się wycofa, then żadne zdarzenie nie jest wysłane. — verified by: test integracyjny
- [x] AC4: Given SC-06 otwarty u dwóch osób, when druga osoba zmieni pozycję, then u pierwszej zmiana pojawia się bez odświeżania, wiersz jest krótko podświetlony (bez animacji przy „ogranicz ruch”), fokus się nie zmienia, aktualizuje się region „N do kupienia”; zdarzenie z `updatedAt` nie nowszym niż stan klienta jest ignorowane. — verified by: test komponentu (podstawiony klient WS) + E2E J-05
- [x] AC5: Given SC-06 lub SC-07 otwarty u uczestnika, when właściciel usunie listę, then uczestnik od razu trafia na SC-05 z komunikatem „Lista „<nazwa>” została usunięta albo nie masz już do niej dostępu.”; when właściciel zmieni nazwę, then AppBar i `h1` pokazują nową nazwę. — verified by: test komponentu + E2E J-05
- [x] AC6: Given SC-05 otwarty, when ktoś udostępni domownikowi listę, zmieni nazwę lub stan pozycji na jego liście albo ją usunie, then karty odświeżają się bez przeładowania strony, a nowa lista jest ogłaszana `polite` „Nowa lista: <nazwa>”. — verified by: test komponentu + E2E
- [x] AC7: Given SC-07 właściciela, when ktoś przyjmie link, then link znika z sekcji „Zaproszenia” bez odświeżania. — verified by: test komponentu (podstawiony klient WS)
- [x] AC8: Given zerwane połączenie (serwer przestaje odpowiadać na ping przez 10 s albo zamyka połączenie), when połączenie wróci, then klient ponownie subskrybuje listę i pobiera jej aktualny stan; serwer wysyła ping co 25 s. — verified by: test integracyjny (ping, zegar) + test hooka `useLiveList` (podstawiony WS)
- [x] AC9: Given E2E z dwoma kontekstami przeglądarki (Ania, Tomek), when Tomek odhacza pozycję, then u Ani zmiana jest widoczna w ≤ 5 s; skan axe na SC-06 po aktualizacji na żywo bez naruszeń. — verified by: E2E Playwright J-05 + axe
- [x] SEC1 (TH-03): Given domownik B bez dostępu do listy A, when wyśle `subscribe { listId: A }`, then dostaje `error { code: "not_found", listId }`, a kolejne zmiany listy A do niego nie docierają; odmowa jest w logu `security`. — verified by: test integracyjny `live.authz.test`
- [x] SEC2 (TH-04): Given uczestnik zasubskrybowany do listy A, when właściciel ją usunie, then uczestnik dostaje `list.deleted` i `access.revoked`, jego subskrypcja jest usunięta, zanim zostanie rozesłane jakiekolwiek kolejne zdarzenie, a ponowny `subscribe` daje `not_found`; zapis na tej liście zwraca 404. — verified by: test integracyjny
- [x] SEC3 (TH-14): Given upgrade do `/api/v1/live` z nagłówkiem `Origin` spoza zaufanych (z ważnym ciasteczkiem), when serwer go odbierze, then połączenie jest odrzucone. — verified by: test integracyjny
- [x] SEC4 (TH-16): Given upgrade bez ciasteczka, z tokenem sesji w parametrze adresu (`?token=…`), when serwer go odbierze, then połączenie jest odrzucone jak bez sesji (401), a token nie trafia do logów. — verified by: test integracyjny
- [x] SEC5 (TH-17): Given otwarte połączenie WS sesji, when domownik się wyloguje, then serwer zamyka połączenia tej sesji (`closeSession`), a próba ponownego połączenia ze starym ciasteczkiem jest odrzucona. — verified by: test integracyjny
- [x] SEC6 (TH-25): Given ważna sesja, when klient otworzy więcej połączeń niż limit na sesję, wyśle więcej wiadomości na sekundę niż limit albo wiadomość ponad limit rozmiaru lub niezgodną ze schematem zod, then nadmiarowe połączenie / połączenie naruszające limit jest zamykane (wiadomość niezgodna ze schematem → `error`, bez skutków). — verified by: test integracyjny `live.limits.test`

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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence — częściowo: przewodniki warstw („Gdzie jest kod”) tak; `api.md` i `tech-stack.md` implementer w trybie autonomicznym nie może edytować, propozycje w Evidence („Odstępstwa i propozycje”)
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Implementacja 2026-10-29 (`/implement-task`, tryb autonomiczny). Zależności: `@fastify/websocket` 11.3.4 (ADR 0003, `layers/backend.md` „Technologia”), `ws` 8.22.0 + `@types/ws` 8.18.2 tylko w testach api (seam „klient `ws`” z TDD planu i `testing-strategy.md`).

### Testy z planu (red → green)

| # | Test | Red (pierwsze uruchomienie) | Teraz |
| --- | --- | --- | --- |
| 1 | `packages/shared/test/live.test.ts` | `expected null to deeply equal { type: 'subscribe', …}`; `expected {} to deeply equal { connectionsPerSession: 5, …}` | ✔ 6 |
| 2 | `apps/api/test/live.upgrade.test.ts` | `expected 404 to be 101 / 401 / 403`; po trasie: log zawierał token z `?token=` | ✔ 4 |
| 3 | `apps/api/test/live.authz.test.ts` | obsługa `subscribe` powstała razem z trasą (krok 2), więc red sprawdzony wyłączeniem `requireListAccess`: `no "error" within 1000 ms; got [{"type":"subscribed",…}]` | ✔ 3 |
| 4 | `apps/api/test/live.items.test.ts` | `no "item.upserted" / "item.deleted" within 1000 ms` | ✔ 4 |
| 5 | `apps/api/test/live.rollback.test.ts` | publikacja po commit z kroku 4, red sprawdzony usunięciem `if (created)`: `unexpected messages: [item.upserted, lists.changed]` | ✔ 1 |
| 6 | `apps/api/test/live.lists.test.ts` | `no "list.updated" / "list.deleted" / "members.changed" / "invitations.changed" within 1000 ms` | ✔ 5 |
| 7 | `apps/api/test/live.revoke.test.ts` | bez `revoke`: `no "access.revoked" within 1000 ms` | ✔ 1 |
| 8 | `apps/api/test/live.sign-out.test.ts` | `connection still open` | ✔ 1 |
| 9 | `apps/api/test/live.limits.test.ts` | limity wpisane w hubie przed testem; red sprawdzony wyłączeniem limitów (połączenia, wiadomości/s, `maxPayload`, `error`): 4 z 6 testów czerwone | ✔ 6 |
| 10 | `apps/api/test/live.heartbeat.test.ts` (`vi.useFakeTimers` dla `setInterval` / `setTimeout`) | red sprawdzony interwałem 30 s i bez `terminate`: oba czerwone | ✔ 2 |
| 11 | `apps/web/src/live/useLiveList.test.tsx` (MSW `ws.link`) | `expected [] to have a length of 1`; `expected [ …3 ] to deeply equal [ …2 ]` (stub hooka) | ✔ 6 |
| 12 | `apps/web/src/screens/SC-06-lista/ListScreen.live.test.tsx` | 8 × `expected [] to deep equally contain { type: 'subscribe' }`; później dodany test fokusu przy własnym zdarzeniu: `expect(element).toHaveFocus()` i brak podświetlenia własnej zmiany: `.not.toHaveAttribute("data-highlighted")` | ✔ 9 |
| 13 | `apps/web/src/screens/SC-05-moje-listy/ListsScreen.live.test.tsx` | `Unable to find role "status"` (ogłoszenie); odświeżenie kart sprawdzone wyłączeniem obsługi `lists.changed`: 2 czerwone | ✔ 4 |
| 14 | `apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.live.test.tsx` | 3 × `expected [] to deep equally contain { type: 'subscribe' }` | ✔ 3 |
| 15 | `apps/web/e2e/j05-na-zywo.spec.ts` (telefon + komputer) | z wyłączonym `live.start()`: `getByText('1 do kupienia')` not found | ✔ 2 |

Uczciwie: w krokach 3, 5, 9 i 10 kod produkcyjny powstał przed testem (razem z trasą z kroku 2); każdy z tych testów sprawdzony „na ugryzienie” przez czasowe zepsucie zachowania i przywrócenie kodu.

### Kryteria akceptacji

- AC1 — `live.items.test`: `item.upserted` z `Item` równym treści odpowiedzi HTTP (dodanie, edycja, odhaczenie z `checkedBy` Tomka), `item.deleted`, `items.cleared` (`itemIds` = `deletedIds`), dostarczenie < 1 s; zdarzenie także do autora.
- AC2 — `live.lists.test`: `list.updated` + `lists.changed` (właściciel i uczestnik), `list.deleted` + `lists.changed` do byłego uczestnika, przyjęcie linku (trasą i przy rejestracji z linku): `members.changed`, `invitations.changed` tylko do właściciela, `lists.changed` do wszystkich i nowego uczestnika; unieważnienie: `invitations.changed` do właściciela, uczestnik nic.
- AC3 — `live.rollback.test`: 409 duplikat, 404 pozycja / cudza lista, 400, 403 i powtórzone dodanie (200) — brak wiadomości.
- AC4 — `ListScreen.live.test`: odhaczenie Tomka → „1 do kupienia”, wiersz w „Kupione” z „kupił(a) Tomek” i `data-highlighted`, fokus bez zmian; dodanie innej osoby zmienia tylko licznik (bez „Dodano …”); przy `prefers-reduced-motion: reduce` bez podświetlenia; `useLiveList.test` — zdarzenie z nie nowszym `updatedAt` ignorowane. E2E J-05: zmiana u Ani ≤ 5 s + axe.
- AC5 — `ListScreen.live.test` / `ParticipantsScreen.live.test`: `list.deleted` lub `access.revoked` → SC-05 z komunikatem; nowa nazwa w `h1` AppBar; właściciel usuwający listę nie dostaje komunikatu. E2E J-05: zmiana nazwy u Tomka, usunięcie → SC-05 z komunikatem, axe.
- AC6 — `ListsScreen.live.test`: `lists.changed` odświeża karty (nazwa, licznik, zniknięcie listy); nowa udostępniona lista ogłaszana „Nowa lista: Działka” w `role="status"` bez zmiany fokusu; pierwsze wczytanie bez ogłoszenia.
- AC7 — `ParticipantsScreen.live.test`: `invitations.changed` → link znika; `members.changed` → „Na liście (1 z 20)”.
- AC8 — `live.heartbeat.test`: ping co 25 s, pong utrzymuje połączenie, bez ponga 10 s → zamknięcie (1006); `useLiveList.test`: po zerwaniu ponowne połączenie, `subscribe` i drugie `GET` listy; bez pingu 35 s → ponowne połączenie.
- AC9 — `j05-na-zywo.spec.ts` (oba viewporty) z `expectNoAxeViolations` na SC-06 Ani po zmianie na żywo i SC-05 Tomka.
- SEC1 — `live.authz.test`: `error not_found` dla cudzej, nieistniejącej i nie-UUID listy; wpis `list_access_denied` w logu `security`; zmiana listy nie dociera.
- SEC2 — `live.revoke.test`: kolejność `list.deleted`, `access.revoked`, `lists.changed`; ponowny `subscribe` → `not_found`; `POST` pozycji → 404; subskrypcja innej listy działa dalej. Hub synchroniczny: `revoke` kończy się przed kolejnym `publish`.
- SEC3 — `live.upgrade.test`: obcy `Origin` i brak `Origin` przy ważnym ciasteczku → 403.
- SEC4 — `live.upgrade.test`: `?token=…` i `?session_token=…` bez ciasteczka → 401; wartość tokenu nie występuje w logu (`redactedUrl` redaguje parametry z „token” w nazwie).
- SEC5 — `live.sign-out.test`: obie karty sesji zamknięte (1008), druga sesja tego konta zostaje, stare ciasteczko → 401.
- SEC6 — `live.limits.test`: 6. połączenie sesji zamknięte (1008), zwolnione miejsce działa; 21 wiadomości/s → 1008, 20 przechodzi; wiadomość > 4 kB → 1009; nie-JSON / dodatkowe pole / nieznany typ → `error validation_failed`, bez subskrypcji.

### Przebiegi (2026-10-29)

- `pnpm vitest run --project api --project shared`: 64 pliki, 233 testy ✔.
- `pnpm test` (cały monorepo): 86 plików, 395 testów ✔ (dwa kolejne przebiegi; jeden wcześniejszy przebieg pod pełnym obciążeniem miał 7 przekroczeń czasu w testach formularzy SC-01 / SC-02 / SC-08 — patrz uwagi dla QA).
- `pnpm test:mobile`: 10 ✔. `pnpm test:e2e`: 34 ✔ (6,8 min, Windows, 1 worker).
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality` (0 klonów, 0 naruszeń dependency-cruiser), `pnpm design-check`, `node scripts/backlog-check.mjs` — OK.

### Zmiany poza nowymi plikami (regresje wyłapane w E2E)

- `useCheckItem`: cel fokusu po odhaczeniu liczony w chwili kliknięcia — zdarzenie własnej zmiany przychodzi przed odpowiedzią API i przenosiło fokus na złą pozycję (J-03); test w `ListScreen.live.test`.
- Podświetlenie pomijane, gdy trwa własny zapis (`isMutating`), i nazwa odhaczonej w podświetlonym wierszu w `text.secondary` — `text.muted` na `bg.subtle` ma 4,34:1 (axe w J-03).
- `useEditItem`: arkusz pokazuje „Ta pozycja została usunięta przez inną osobę.”, gdy pozycja zniknie na żywo (Demo 2); E2E `j03-pozycje` „deleted by someone else” oczekuje teraz komunikatu bez zapisu (ścieżkę zapisu → 404 dalej sprawdza test komponentu).
- E2E `j03-kupione` i J-05 czekają między dodaniami na ogłoszenie „Dodano …” zamiast na wiersz (wiersz może przyjść na żywo przed odpowiedzią API, a AddBar ignoruje Enter w czasie zapisu — zachowanie sprzed T-009).
- `.visuallyHidden` przeniesione do `styles/page.module.css` (trzecie użycie, SC-05).

### Odstępstwa i propozycje do dokumentów architektury (bez edycji — tryb autonomiczny)

- `api.md` „Zmiany na żywo”: (1) `error` ma też `code: "validation_failed"` (bez `listId`) dla wiadomości niezgodnej ze schematem; (2) ping / pong to wiadomości JSON `{ "type": "ping" }` / `{ "type": "pong" }` (przeglądarka nie widzi ramek ping WebSocket), klient bez pingu przez 25 + 10 s łączy się ponownie; (3) `invitations.changed` idzie kanałem `user:<id>` właściciela (nie kanałem listy); (4) upgrade bez `Origin` = 403 (web); mobile dostanie wyjątek z nagłówkiem tokenu w E-04 (S-04-03); (5) progi `LIVE_LIMITS` w `packages/shared/src/limits.ts`: 5 połączeń na sesję, 20 wiadomości/s, 4096 B.
- `tech-stack.md` „Narzędzia uruchomieniowe”: proponowany wiersz `@fastify/websocket` 11.3.4 + `ws` (testy).
- Przewodniki warstw: zaktualizowane tylko „Gdzie jest kod” (backend: moduł `na-zywo`, `requireSession`, `peopleWithAccess`, `test/live.ts`, `LIVE_LIMITS`; web: `src/live/`, helpery testów, J-05, `visuallyHidden`). Propozycja do „Pułapek” web: zdarzenie własnej zmiany przychodzi przed odpowiedzią API — cel fokusu i podświetlenie nie mogą zależeć od kolejności zdarzenie / odpowiedź.

### Uwagi dla QA

- Wyścig `subscribe` ↔ `revoke`: sprawdzenie dostępu jest asynchroniczne; `revoke` w trakcie sprawdzenia zostawi subskrypcję. Dla usuniętej listy bez skutków (nic już nie publikuje), ale przy usuwaniu uczestnika (E-02, S-02-02) trzeba to domknąć.
- Po wygaśnięciu sesji klient łączy się ponownie co ≤ 10 s (upgrade 401) do przeładowania strony.
- Pełny `pnpm test` jest wolniejszy (~230 s) — testy WS startują prawdziwy serwer; raz pod obciążeniem przekroczenia czasu w testach formularzy web.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

Niezależna weryfikacja (świeża sesja QA, tryb autonomiczny). Commit implementacji: `35e0400`.

**Przebiegi (uruchomione przez QA):** `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych; `format:check`, `lint`, `typecheck`, `quality`, `design-check`, `backlog-check` — OK. `pnpm test`: przebieg 1 — 399/400 (1 niestabilny test SC-08, patrz #2), przebieg 2 — 396/396 ✔. `pnpm test:mobile` 10 ✔. `pnpm test:e2e` 34 ✔ + 2 własne scenariusze QA ✔ (oba viewporty).

**Spot-checki (zepsucie → czerwony test → przywrócenie, `git status` czysty):** `LiveHub.revoke` jako no-op → `live.revoke.test` czerwony; usunięty warunek `Origin` → `live.upgrade.test` (CSWSH) czerwony; `upsertNewer` bez porównania `updatedAt` → `useLiveList.test` czerwony; podświetlenie bez `prefers-reduced-motion` → `ListScreen.live.test` czerwony.

**Próby nadużyć (lokalnie, prawdziwy serwer + `ws`, konta z fabryk testowych; plik roboczy usunięty):** `Origin` podobny (`http://localhost:5173.evil.com`, inny port, `null`, z ukośnikiem) → 403; token sesji w `Authorization: Bearer` bez ciasteczka → 401; obce konto: `subscribe`/`unsubscribe`/`subscribe` cudzej listy → tylko `error not_found`, brak zdarzeń; uczestnik listy A subskrybujący listę B tego samego właściciela → `not_found`, zmiany i zmiana nazwy B nie docierają; po `unsubscribe` brak zdarzeń listy (zostaje tylko `lists.changed` kanału użytkownika); nazwy pozycji nie trafiają do logów. W E2E: adresy WS w przeglądarce bez tokenu (`ws://…/api/v1/live`).

**Własne E2E (dwa konteksty, Ania + Tomek):** przyjęcie linku → na SC-07 Ani link znika i licznik uczestników rośnie ≤ 5 s; na SC-05 Tomka karta „Dom” pojawia się bez odświeżania z ogłoszeniem `status` „Nowa lista: Dom”; zmiana nazwy → nowa nazwa na SC-05 Tomka ≤ 5 s; Ania usuwa pozycję edytowaną przez Tomka → w arkuszu „Ta pozycja została usunięta przez inną osobę.”; Ania usuwa listę przy otwartym SC-05 Tomka → karta znika ≤ 5 s; ponowne otwarcie adresu usuniętej listy → stan „brak dostępu” z „Wróć do moich list”. Skany axe (SC-07, SC-05, arkusz) bez naruszeń.

| Kryterium | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | `live.items.test` przeczytany i uruchomiony; E2E J-05 |
| AC2 | pass | `live.lists.test`; własne E2E (SC-07, SC-05) |
| AC3 | pass | `live.rollback.test` |
| AC4 | pass | `ListScreen.live.test`, `useLiveList.test` (spot-check), E2E J-05 |
| AC5 | pass | `ListScreen.live.test`, `ParticipantsScreen.live.test`, E2E J-05 |
| AC6 | pass | `ListsScreen.live.test` + własne E2E QA (brak E2E w repo, #3) |
| AC7 | pass | `ParticipantsScreen.live.test` + własne E2E QA |
| AC8 | pass | `live.heartbeat.test`, `useLiveList.test` |
| AC9 | pass | E2E J-05 z axe (oba viewporty) |
| SEC1–SEC6 | pass | testy integracyjne + próby nadużyć powyżej |

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security / na-zywo | Wyścig `subscribe` ↔ `revoke`: `requireListAccess` jest asynchroniczne, `revoke` w trakcie sprawdzenia zostawia subskrypcję. Bez skutków dla usuniętej listy, ale przy usuwaniu uczestnika (E-02, S-02-02) uczestnik dostawałby dalej zdarzenia. | `na-zywo/http/routes.ts` `handle` (sam autor zgłasza w „Uwagi dla QA”) | Przed `hub.subscribe` ponowne sprawdzenie / znacznik „revoked” w hubie; zaplanować w S-02-02 |
| 2 | minor | tests (flaky) | `InvitationScreen.entry.test.tsx` „sign up: … lands on the list” raz padł w pełnym `pnpm test` (`expected 1 to be +0` dla `accepts.count`) — asercja, nie przekroczenie czasu; 5× osobno i w drugim pełnym przebiegu zielony. Kod SC-08 / strażników wejścia z T-008; możliwy wyścig przekierowania po rejestracji, które woła dodatkowo `accept`. | `scratchpad/test.log` przebiegu 1 | Zbadać wyścig (strażnik gościa vs. nawigacja po rejestracji), test stabilny |
| 3 | minor | tests | AC6 i AC7 deklarują „E2E”, w repo nie ma E2E odświeżania SC-05 / SC-07 na żywo (J-05 sprawdza tylko powrót na SC-05 po usunięciu). QA potwierdził zachowanie własnym E2E. | `apps/web/e2e/` | Dopisać scenariusz do J-05 |
| 4 | minor | docs | Odstępstwa od `api.md` / `tech-stack.md` (JSON `ping`/`pong`, `error validation_failed`, `invitations.changed` kanałem `user:<id>`, `LIVE_LIMITS`, `@fastify/websocket`) tylko w Evidence; punkt DoD niezaznaczony. | sekcja „Odstępstwa i propozycje” | Wpisać do `api.md` i `tech-stack.md` (decyzja użytkownika) |
| 5 | note | backend | Publikacja po zatwierdzeniu czeka na `peopleWithAccess` (zapytanie do bazy); błąd tego zapytania da 500 mimo zapisanej zmiany. `DELETE` listy czyta uczestników przed usunięciem poza transakcją (dołączający w tej chwili nie dostanie `lists.changed`). | `pozycje/http/item-events.ts`, `listy/http/routes.ts` | Rozważyć odporne rozsyłanie (błąd zdarzenia nie zmienia odpowiedzi) |
| 6 | note | security | Otwarte połączenie WS żyje po wygaśnięciu sesji (zamyka je tylko wylogowanie); klient po 401 ponawia co ≤ 10 s do przeładowania. | `liveSocket.ts`, `routes.ts` | Okresowe sprawdzenie sesji / zatrzymanie ponowień po 401 |
| 7 | note | a11y | Ręczne sprawdzenia (czytnik ekranu, tylko klawiatura, powiększenie, Safari/telefon, pomiar ≤ 5 s na staging) niewykonalne w trybie autonomicznym; automatyczne axe zielone. | — | Sprawdzić w UAT epiku |

**Story S-01-06:** wszystkie zadania `done`; kryteria biznesowe sprawdzone end to end (J-05 i własne E2E QA: zmiany ≤ 5 s, usunięcie wygrywa z edycją z komunikatem, zmiana nazwy / usunięcie listy u uczestnika, brak zdarzeń dla osoby bez dostępu; „ostatni zapis wygrywa” — serwer nadpisuje, klient stosuje zdarzenie z nowszym `updatedAt`, `useLiveList.test`). Story → `done`.
