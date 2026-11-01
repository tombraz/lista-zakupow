---
id: T-056
title: "Na żywo: subskrypcja nie wyprzedza odebrania dostępu; sesja sprawdzana przy subskrypcji i okresowo"
epic: E-02
story: S-02-02
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given `subscribe` uczestnika, którego sprawdzenie dostępu jeszcze trwa, when w tym czasie `revoke(userId, listId)` (usunięcie członkostwa zatwierdzone), then po zakończeniu sprawdzenia klient dostaje `error not_found` albo `access.revoked`, a kolejne zdarzenie listy do niego nie dociera. — verified by: test integracyjny z wstrzymanym sprawdzeniem dostępu (deterministyczny, bez `sleep`)
- [ ] SEC1 (TH-04): Given uczestnik z aktywną subskrypcją, when właściciel usuwa członkostwo (bezpośrednio w repozytorium + `revoke`), then następne `item.upserted` tej listy do niego nie dociera, a jego zapis przez HTTP zwraca 404. — verified by: test integracyjny `live.revoke`
- [ ] SEC2 (TH-28): Given połączenie WS, którego sesja w bazie wygasła (zegar) albo została usunięta, when klient wysyła `subscribe`, then serwer zamyka gniazdo z 1008 bez `subscribed`; given brak `subscribe`, then gniazdo jest zamykane najpóźniej przy kolejnym pingu serwera (kontrola sesji co 25 s). — verified by: testy integracyjne z zegarem
- [ ] AC2: Kontrola okresowa nie robi zapytania do bazy częściej niż raz na ping na połączenie i nie zatrzymuje pingów pozostałych połączeń przy wolnej bazie. — verified by: test integracyjny (licznik zapytań lub podstawiona weryfikacja sesji)

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

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
