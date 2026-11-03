---
id: T-083
title: "Niestabilny test SC-07 „after a silent drop” w connection.test.tsx"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-15]
threats: []
screens: [SC-07]
related_tasks: [T-063, T-059, T-062]
---

# T-083 Niestabilny test SC-07 „after a silent drop” w connection.test.tsx

## Report

Źródło: QA T-059 (`T-059-opuszczenie-listy.md:115, 146, 168`, finding 1), QA T-062 (finding 4), ponownie przy T-073 (2026-11-02). Test pochodzi z T-063 (`7a57237`); kod produkcyjny nie jest podejrzany.

- **Actual:** `apps/web/src/live/connection.test.tsx` › „SC-07: after a silent drop (no browser event) fetches the participants again” czasem pada: `expected [ { type: 'subscribe' } ] to have a length of 2 but got 1` (QA T-059). Częstość: 1/12 osobnych przebiegów (QA T-059), 1/3 przy T-073; częściej pod obciążeniem pełnego `pnpm check`.
- **Expected:** test deterministyczny — zielony przy każdym przebiegu, także pod obciążeniem. Źródło: `docs/architecture/layers/web.md` („Testy w tej warstwie”), T-047.
- **Steps to reproduce:**
  1. `for i in $(seq 20); do pnpm vitest run --project web src/live/connection.test.tsx; done` albo pełne `pnpm check`.
- **Environment:** lokalnie (Windows 11) i w przebiegach QA, gałąź `epic/E-02-konto-i-uczestnicy`.
- **Evidence:** komunikat wyżej (QA T-059). Hipoteza QA T-059, niezweryfikowana: `LiveSocket` po zerwaniu bez zdarzenia przeglądarki czeka `1000 * 2 ** retries` ms (`apps/web/src/live/liveSocket.ts:216`, pierwsza próba po 1000 ms), a `subscribed(live, 2)` używa `waitFor` z domyślnym limitem 1000 ms, liczonym już po `findByText(OFFLINE)` — okno jest na granicy. Test „browser goes online” (ten sam plik) łączy się od razu po zdarzeniu `online`, więc prawdopodobnie nie ma tego problemu.

## Acceptance criteria

- [x] AC1: Given test „after a silent drop”, when uruchomiony 20 razy pod `--sequence.shuffle` oraz w pełnym `pnpm test`, then zielony za każdym razem; test nie zależy od rzeczywistego czasu ponownego połączenia (np. sztuczny zegar albo jawny limit `waitFor` powyżej opóźnienia pierwszej próby, z uzasadnieniem w komentarzu). — verified by: pętla przebiegów zapisana w Evidence
- [x] AC2: Test nadal sprawdza to samo zachowanie: po cichym zerwaniu pasek „Brak połączenia”, ponowna subskrypcja, ponowne pobranie uczestników i zniknięcie paska. — verified by: przegląd testu (mutacja: wyłączenie ponownego pobrania w `useLiveList` daje czerwony test)
- [x] AC3: No regression in: pozostałe testy `apps/web/src/live/`, T-063 (pasek „Brak połączenia”), T-059.

## TDD plan

**Seam:** test komponentu `connection.test.tsx` (`renderApp` + `liveServer`); kod produkcyjny `liveSocket.ts` bez zmian, chyba że przyczyna okaże się inna niż hipoteza.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | odtworzenie: ten sam test pod obciążeniem / ze sztucznie wydłużonym czasem (np. `--pool` z wieloma wątkami albo pętla), komunikat porażki zapisany z `test-results/vitest-junit.xml` | component | Vitest + RTL | przyczyna |
| 2 | poprawiony test zielony 20× pod `--sequence.shuffle` | component | Vitest + RTL | AC1 |

**Run:** `pnpm vitest run --project web src/live/connection.test.tsx`

## QA plan

- **Regression:** `apps/web/src/live/`, testy SC-07 i SC-06 korzystające z `liveServer`.
- **Edge cases:** pełny `pnpm check` (obciążenie), kolejność losowa.
- **Platforms:** web (testy jednostkowe/komponentów).

## Root cause

Hipoteza QA T-059 potwierdzona. Po cichym zerwaniu (`live.dropAll()`, bez zdarzenia `online`) `LiveSocket.reconnect()` planuje pierwszą próbę po `1000 * 2 ** 0` = 1000 ms (`apps/web/src/live/liveSocket.ts:216`), a test czekał na drugą subskrypcję zwykłym `waitFor` z domyślnym limitem 1000 ms, liczonym od chwili pojawienia się paska OFFLINE (czyli nieco po starcie backoffu). Zapas wynosił kilkadziesiąt ms minus czas otwarcia gniazda MSW i wysłania `subscribe`; pod obciążeniem przekraczał limit. Kod produkcyjny jest poprawny.

Dlaczego testy tego nie złapały: test przechodzi w zwykłym, pojedynczym przebiegu (okno na granicy), a porażka pojawia się tylko pod obciążeniem; nic nie wymusza, by testy czekające na backoff używały sztucznego zegara albo jawnego limitu.

Inne wystąpienia tego wzorca (czekanie na ponowne połączenie z backoffem): `useLiveList.test.tsx:156` i `sessionEnded.test.tsx:98` mają jawny `timeout: 3000` — w porządku; „browser goes online” w `connection.test.tsx` łączy się od razu po zdarzeniu `online` — w porządku. Innych nie ma.

## Fix

`connection.test.tsx` › „SC-07: after a silent drop…”: sztuczny zegar (`vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] })`, jak w teście „no ping” w tym samym pliku), po pojawieniu się paska sprawdzenie, że nadal jest 1 połączenie, i jawne `vi.advanceTimersByTimeAsync(1_000)` do pierwszej próby; `afterEach(vi.useRealTimers)` w `describe("back online")`. Komentarz w teście uzasadnia zmianę. Kod produkcyjny bez zmian.

## Evidence

- **Odtworzenie (przed poprawką):** 6 równoległych przebiegów `pnpm vitest run --project web src/live/connection.test.tsx src/live/useLiveList.test.tsx src/screens/SC-07-uczestnicy --sequence.shuffle` → 1/6 czerwony: `× SC-07: after a silent drop (no browser event) fetches the participants again 1443ms`, `AssertionError: expected [ { type: 'subscribe', …(1) } ] to have a length of 2 but got 1` (`connection.test.tsx:32`, helper `subscribed`).
- **AC1 (po poprawce):** 20 przebiegów tej samej komendy z `--sequence.shuffle`, po 4 równolegle (obciążenie) → test „silent drop” zielony 20/20. Pełne `pnpm check` (format, lint, typecheck, quality, design/backlog/workflow-check, `pnpm test` 142 pliki, `test:mobile`) → exit 0.
- **AC2 (mutacja):** zakomentowanie `client.invalidateQueries({ queryKey: listKey(listId) })` w `onReconnect` (`useLiveList.ts:60`) → test czerwony: `Unable to find an element with the text: Tomek`; po przywróceniu zielony. Asercje paska OFFLINE, drugiej subskrypcji, ponownego pobrania i zniknięcia paska bez zmian.
- **AC3:** `apps/web/src/live/` i `src/screens/SC-07-uczestnicy` zielone w pętli; pełne `pnpm test` zielone.
- **Znalezisko poza zakresem (inna przyczyna):** w 1/20 przebiegów pętli AC1 padł `ParticipantsScreen.remove.test.tsx` › „makes „Usuń” inactive without a connection…” z `Unable to find role="region" and name "Na liście (1 z 20)"` (zapytanie z linii 160, poprzedni test „retries…”; prawdopodobnie domyślny limit `findByRole` po ponownej próbie usunięcia pod obciążeniem, bez backoffu). Proponowane osobne zadanie fix.

## Prevention

Co by zapobiegło: reguła, że test czekający na ponowne połączenie z backoffem nie polega na domyślnym limicie `waitFor`. Automatyczny check (lint) nie odróżni statycznie takiego czekania, więc najtańsze trwałe rozwiązanie to wpis w „Pułapkach” warstwy. Użytkownik zaakceptował (2026-11-02): wpis w `docs/architecture/layers/web.md` („Pułapki” + historia zmian). Helpera w `test/live.ts` nie zamawiano.

Po QA (finding 1, minor, decyzja użytkownika): usunięta asercja `expect(live.connections()).toBe(1)` przed przesunięciem zegara — przy `shouldAdvanceTime` zależała od czasu rzeczywistego. Niestabilność `ParticipantsScreen.remove.test.tsx` → T-084.

## Incident note

Nie dotyczy (tylko test).

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-02)

Verdict: pass

Zakres: commit `d40fe21` (tylko `apps/web/src/live/connection.test.tsx`, +9 linii; kod produkcyjny bez zmian).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | test | Nowa asercja `expect(live.connections()).toBe(1)` po `findByText(OFFLINE)` zależy od czasu rzeczywistego: przy `shouldAdvanceTime: true` sztuczny zegar płynie razem z realnym, więc gdyby pojawienie się paska trwało ponad 1000 ms (skrajne obciążenie), próba połączenia odpaliłaby wcześniej i asercja byłaby czerwona. W praktyce pasek pojawia się od razu po `markDropped`; 20/20 zielonych. | `connection.test.tsx:168` | Ewentualnie `shouldAdvanceTime: false` dla tego testu albo pominięcie asercji; nie blokuje. |
| 2 | note | test (poza zakresem) | Autor zgłosił drugi niestabilny test: `ParticipantsScreen.remove.test.tsx` › „makes „Usuń” inactive without a connection…” (1/20). W moich 20 przebiegach (w tym pliki SC-07) i w pełnym `pnpm check` nie wystąpił. | Evidence autora | Osobne zadanie fix, jeśli użytkownik zdecyduje. |

Weryfikacja:

- **Step 3:** `pnpm check` (format, lint, typecheck, quality, design/backlog/workflow-check, `pnpm test` 142 pliki / 1106 testów, `test:mobile` 10 testów) → exit 0.
- **AC1 — pass:** 20 przebiegów `pnpm vitest run --project web src/live/connection.test.tsx src/live/useLiveList.test.tsx src/screens/SC-07-uczestnicy --sequence.shuffle`, po 4 równolegle (obciążenie) → 20/20 exit 0 (każdy 7 plików, 61 testów). Test nie zależy od realnego czasu połączenia: jawne `vi.advanceTimersByTimeAsync(1_000)` + komentarz z uzasadnieniem.
- **AC2 — pass:** asercje paska OFFLINE, drugiej subskrypcji, pobrania „Tomek” i zniknięcia paska bez zmian. Mutacja 1: zakomentowanie `invalidateQueries` w `onReconnect` (`useLiveList.ts:60`) → czerwony `Unable to find an element with the text: Tomek`. Mutacja 2: opóźnienie pierwszej próby w `liveSocket.ts` 1000 → 5000 ms → czerwony `expected [ { type: 'subscribe', …(1) } ] to have a length of 2 but got 1` (test pilnuje też opóźnienia z backoffu). Oba przywrócone, `git status` czysty.
- **AC3 — pass:** `src/live/` i `src/screens/SC-07-uczestnicy` zielone w pętli; pełne `pnpm test` zielone.
- **Root cause (fix task):** wyjaśnia, dlaczego testy nie złapały (okno na granicy, porażka tylko pod obciążeniem) i przegląda inne wystąpienia wzorca. Czerwony dowód odtworzenia przed poprawką jest w Evidence (1/6). `afterEach(vi.useRealTimers)` dodane w `describe("back online")` — brak wycieku sztucznego zegara do innych testów.
- **Security / design / a11y:** nie dotyczy (zmiana tylko w teście, `threats: []`).
