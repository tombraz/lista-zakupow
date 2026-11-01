---
id: T-056
title: "Na żywo: subskrypcja nie wyprzedza odebrania dostępu; sesja sprawdzana przy subskrypcji i okresowo"
epic: E-02
story: S-02-02
status: in-qa           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: S                # S | M (L must be split)
layers: [backend]
requirements: [F-13, F-14]
threats: [TH-04, TH-28]
screens: []
---

# T-056 Na żywo: subskrypcja nie wyprzedza odebrania dostępu; sesja sprawdzana przy subskrypcji i okresowo

## Goal

Zamknąć dwie luki z QA T-009 przed usuwaniem uczestników: `subscribe`, którego sprawdzenie dostępu w bazie trwa w chwili `revoke`, nie zostawia aktywnej subskrypcji; połączenie WS sesji, która wygasła albo została usunięta w bazie, jest zamykane, a jego `subscribe` odrzucany.

## Demo

Testy integracyjne WS (dwa klienty `ws`): usunięcie członkostwa w trakcie trwającego `subscribe` — po nim żadne zdarzenie listy nie dociera. Sesja przestawiona w bazie na wygasłą (albo usunięta) — gniazdo zamyka się najpóźniej przy następnym `subscribe` lub pingu (≤ 25 s), z kodem 1008.

## Context

- BRD: F-13 — „usunięty uczestnik natychmiast traci dostęp: nie widzi dalszych zmian (MC-03)”.
- Architektura: `architecture.md` „Zmiany na żywo” (`revoke` przed rozesłaniem kolejnego zdarzenia; ping co 25 s), TH-04, TH-28 („ponowna kontrola sesji przy `subscribe` i okresowo”), `modules/na-zywo` (`LiveHub.subscribe` po asynchronicznym `requireListAccess` w `http/routes.ts`).
- Existing code: `apps/api/src/modules/na-zywo/domain/hub.ts`, `apps/api/src/modules/na-zywo/http/routes.ts`; testy `apps/api/test/live.revoke.test.ts`, `live.sign-out.test.ts`, `session-expiry.test.ts`.
- Depends on: — (E-01).

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given `subscribe` uczestnika, którego sprawdzenie dostępu jeszcze trwa, when w tym czasie `revoke(userId, listId)` (usunięcie członkostwa zatwierdzone), then po zakończeniu sprawdzenia klient dostaje `error not_found` albo `access.revoked`, a kolejne zdarzenie listy do niego nie dociera. — verified by: test integracyjny z wstrzymanym sprawdzeniem dostępu (deterministyczny, bez `sleep`)
- [x] SEC1 (TH-04): Given uczestnik z aktywną subskrypcją, when właściciel usuwa członkostwo (bezpośrednio w repozytorium + `revoke`), then następne `item.upserted` tej listy do niego nie dociera, a jego zapis przez HTTP zwraca 404. — verified by: test integracyjny `live.revoke`
- [x] SEC2 (TH-28): Given połączenie WS, którego sesja w bazie wygasła (zegar) albo została usunięta, when klient wysyła `subscribe`, then serwer zamyka gniazdo z 1008 bez `subscribed`; given brak `subscribe`, then gniazdo jest zamykane najpóźniej przy kolejnym pingu serwera (kontrola sesji co 25 s). — verified by: testy integracyjne z zegarem
- [x] AC2: Kontrola okresowa nie robi zapytania do bazy częściej niż raz na ping na połączenie i nie zatrzymuje pingów pozostałych połączeń przy wolnej bazie. — verified by: test integracyjny (licznik zapytań lub podstawiona weryfikacja sesji)

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- WebSocket `/api/v1/live` (klient `ws`) z bazą Testcontainers
- `LiveHub` (domena) dla kolejności `subscribe` / `revoke`

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `revoke` w trakcie sprawdzania dostępu przy `subscribe` → brak zdarzeń | integration | Vitest + Testcontainers + `ws` | AC1 |
| 2 | po usunięciu członkostwa kolejne zdarzenie nie dociera, zapis 404 | integration | Vitest + Testcontainers + `ws` | SEC1 |
| 3 | `subscribe` z wygasłą / usuniętą sesją → 1008 | integration | Vitest + Testcontainers + `ws` | SEC2 |
| 4 | okresowa kontrola przy pingu zamyka gniazdo wygasłej sesji | integration | Vitest + Testcontainers + `ws` (zegar) | SEC2, AC2 |

**Run:** `pnpm vitest run --project api live`

**Mocks:** zegar (wygasanie sesji, ping). Baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** wiele kart jednej sesji; dwie sesje jednego użytkownika (jedna wygasa, druga żyje); `unsubscribe` i ponowny `subscribe` w trakcie `revoke`.
- **Security / privacy:** TH-04 — ręcznie na dwóch przeglądarkach po T-058 (MC-03); TH-28 — sesja usunięta w bazie (`DELETE FROM session`) przy otwartej liście.
- **Regression:** J-05 (zmiany ≤ 5 s), limity WS (T-033, T-037, T-038), wylogowanie zamyka WS (TH-17).

## Implementation notes

- Wzorce do rozważenia: wersja/epoka członkostw w hubie sprawdzana po `await`, albo rejestracja „oczekującej” subskrypcji przed zapytaniem i `revoke`, który ją też usuwa. Hub zostaje synchroniczny (ADR 0003).
- Kontrola sesji: odczyt `session.expires_at` i istnienia wiersza; wynik może być w pamięci do następnego pingu.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

**Zmiana:** `LiveHub.requestSubscription(connection, listId)` rejestruje subskrypcję przed asynchronicznym `requireListAccess`; `revoke` usuwa też oczekujące, `confirm()` po `await` zwraca `false` → klient dostaje `error not_found` (hub dalej synchroniczny, ADR 0003). `subscribe` najpierw sprawdza sesję w bazie (`Accounts.sessionActive` → `konta/infra/sessions.ts`: wiersz istnieje i `expires_at > now`, czas jak w Better Auth); brak → `detach` + zamknięcie 1008. Przy każdym pingu (`heartbeat(…, onPing)`) ta sama kontrola w tle, najwyżej jedno zapytanie naraz na połączenie; błąd bazy → wpis `live_session_check_failed` w logu, połączenie zostaje. Seam testów: `AppOptions.live` (prawdziwy hub podany przez test, żeby wołać `revoke` jak przyszła trasa T-058) i `test/gated-pool.ts` (prawdziwa baza; wynik pasującego zapytania wstrzymany po odczycie — deterministyczny wyścig bez `sleep`).

**TDD (red → green), `pnpm vitest run --project api live`:**

| # | Test | Red | Green |
| --- | --- | --- | --- |
| 1 | `live.revoke.test.ts` › „leaves no subscription when access is revoked while the subscribe check is running (AC1)” | `no "error" within 1000 ms; got [{"type":"subscribed",…}]` — najpierw ze stubem `AppOptions.live` (nieużywany), potem z podpiętym hubem (sam wyścig) | po `requestSubscription` / `confirm` |
| 2 | `live.revoke.test.ts` › „stops list events to a removed participant and refuses their writes (SEC1, TH-04)” | przeszedł od razu (zachowanie `revoke` z T-009; czerwień możliwa dopiero po seamie z testu 1). Sprawdzone, że gryzie: chwilowo wyłączony `revoke` w hubie → `no "access.revoked" within 1000 ms` (oba testy listy też padły), kod przywrócony | tak |
| 3 | `live.session.test.ts` › „closes with 1008 on subscribe when the session was expired / deleted” | `connection still open` (oba warianty) | po kontroli sesji w `handle` |
| 4a | `live.session.test.ts` › „closes with 1008 at the next ping when the session expired without a subscribe” (zegar: `vi.useFakeTimers`, 24 999 ms otwarte, 25 000 ms → 1008) | `connection still open` | po `onPing` w `heartbeat` |
| 4b | `live.session.test.ts` › „checks each session at most once per ping and keeps pinging others while the database is slow (AC2)” (2 połączenia, wyniki zapytań do `session` wstrzymane: drugi ping dociera do obu, zapytań nadal 2; po zwolnieniu i kolejnym pingu 4) | `0 of 2 results held` | tak |

**Kryteria:**

- AC1 — test 1: po `revoke` w trakcie sprawdzenia klient dostaje `error not_found`, żadnego `subscribed`, a `item.upserted` właściciela nie dociera (`expectSilence`).
- SEC1 — test 2: `access.revoked`, `item.upserted` nie dociera, zapis uczestnika przez HTTP → 404.
- SEC2 — testy 3 i 4a: wygasła (`expires_at` w przeszłości) i usunięta sesja → 1008 bez `subscribed`; bez `subscribe` zamknięcie przy pierwszym pingu (≤ 25 s).
- AC2 — test 4b (licznik zapytań przez `gatedPool`).

**Weryfikacja (ten przebieg):** `pnpm test` — 109 plików, 595 testów, wszystkie przechodzą; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd 0 klonów, depcruise bez naruszeń), `pnpm build`, `pnpm test:mobile` — OK. Losowa kolejność: `--sequence.shuffle` seed 11 i 7 — 305/305; seed 4242 — pada `database.test.ts` › „starts the next test with empty tables”, **także na czystym HEAD bez zmian T-056** (test zależny od kolejności testów w pliku; poza zakresem). Nowe pliki trzy razy z rzędu zielone.

**Layer guide (8b):** `layers/backend.md` „Gdzie jest kod” — `requestSubscription`, kontrola sesji przy `subscribe` i pingu, `Accounts.sessionActive`, `AppOptions.live`, `test/gated-pool.ts` (fakty).

**Dla QA:** `unsubscribe` w trakcie oczekującego `subscribe` nie anuluje oczekiwania (jak przed zmianą: subskrypcja powstaje) — poza kryteriami. Kontrola sesji przy `subscribe` robi jedno zapytanie na `subscribe` (ograniczone budżetem wiadomości), wynik nie jest trzymany w pamięci.
