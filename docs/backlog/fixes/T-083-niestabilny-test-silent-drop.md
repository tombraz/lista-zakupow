---
id: T-083
title: "Niestabilny test SC-07 „after a silent drop” w connection.test.tsx"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given test „after a silent drop”, when uruchomiony 20 razy pod `--sequence.shuffle` oraz w pełnym `pnpm test`, then zielony za każdym razem; test nie zależy od rzeczywistego czasu ponownego połączenia (np. sztuczny zegar albo jawny limit `waitFor` powyżej opóźnienia pierwszej próby, z uzasadnieniem w komentarzu). — verified by: pętla przebiegów zapisana w Evidence
- [ ] AC2: Test nadal sprawdza to samo zachowanie: po cichym zerwaniu pasek „Brak połączenia”, ponowna subskrypcja, ponowne pobranie uczestników i zniknięcie paska. — verified by: przegląd testu (mutacja: wyłączenie ponownego pobrania w `useLiveList` daje czerwony test)
- [ ] AC3: No regression in: pozostałe testy `apps/web/src/live/`, T-063 (pasek „Brak połączenia”), T-059.

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

<Do uzupełnienia przez implementującego: potwierdzić albo obalić hipotezę z Report, na podstawie komunikatu z junit. Sprawdzić, czy inne testy z `liveServer` czekają na ponowne połączenie z backoffem tym samym domyślnym `waitFor`.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
