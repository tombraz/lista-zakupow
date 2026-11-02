---
id: T-084
title: "Niestabilny test SC-07 „Usuń” bez połączenia w ParticipantsScreen.remove.test.tsx"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-15]
threats: []
screens: [SC-07]
related_tasks: [T-083, T-015, T-063]
---

# T-084 Niestabilny test SC-07 „Usuń” bez połączenia w ParticipantsScreen.remove.test.tsx

## Report

Źródło: pętla weryfikacji AC1 w T-083 (2026-11-02), 1/20 przebiegów. Kod produkcyjny nie jest podejrzany.

- **Actual:** `apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.remove.test.tsx` › „makes „Usuń” inactive without a connection and opens no dialog (T-015, T-063)” padł raz: `TestingLibraryElementError: Unable to find role="region" and name "Na liście (1 z 20)"` (stos: `ParticipantsScreen.remove.test.tsx:166:38`). To zapytanie jest w linii 160, w poprzednim teście „retries…” (`findByRole` po ponownej próbie usunięcia) — możliwe, że porażka jednego testu jest przypisana do następnego albo dotyczy helpera `ownersParticipants`. QA T-083 nie odtworzyło jej w 20 przebiegach.
- **Expected:** test deterministyczny — zielony przy każdym przebiegu, także pod obciążeniem. Źródło: `docs/architecture/layers/web.md` („Testy w tej warstwie”).
- **Steps to reproduce:**
  1. Kilka równoległych przebiegów (np. 4 naraz, 20 razy): `pnpm vitest run --project web src/live/connection.test.tsx src/live/useLiveList.test.tsx src/screens/SC-07-uczestnicy --sequence.shuffle`.
- **Environment:** lokalnie (Windows 11), gałąź `epic/E-02-konto-i-uczestnicy`, commit `d40fe21`.
- **Evidence:** komunikat wyżej; log przebiegu nie został zachowany w repozytorium. Hipoteza (niezweryfikowana): domyślny limit 1000 ms `findByRole` / `waitFor` po ponownym zapisie pod obciążeniem — bez backoffu `LiveSocket`, więc inna przyczyna niż w T-083.

## Acceptance criteria

- [ ] AC1: Given testy `ParticipantsScreen.remove.test.tsx`, when uruchomione 20 razy pod `--sequence.shuffle`, po kilka równolegle, oraz w pełnym `pnpm check`, then zielone za każdym razem. — verified by: pętla przebiegów zapisana w Evidence
- [ ] AC2: Testy nadal sprawdzają to samo zachowanie (ponowna próba usunięcia, „Usuń” nieaktywne bez połączenia). — verified by: przegląd testu i mutacja
- [ ] AC3: No regression in: pozostałe testy `src/screens/SC-07-uczestnicy`, T-015, T-063.

## TDD plan

**Seam:** test komponentu `ParticipantsScreen.remove.test.tsx` (`renderApp` + MSW); kod produkcyjny bez zmian, chyba że przyczyna okaże się inna.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | odtworzenie pod obciążeniem (pętla wyżej), komunikat z `test-results/vitest-junit.xml` | component | Vitest + RTL | przyczyna |
| 2 | poprawione testy zielone 20× pod `--sequence.shuffle` | component | Vitest + RTL | AC1 |

**Run:** `pnpm vitest run --project web src/screens/SC-07-uczestnicy/ParticipantsScreen.remove.test.tsx`

## QA plan

- **Regression:** `src/screens/SC-07-uczestnicy`.
- **Edge cases:** pełny `pnpm check` (obciążenie), kolejność losowa.
- **Platforms:** web (testy komponentów).

## Root cause

<Do uzupełnienia: ustalić, który test naprawdę pada (stos wskazuje 166, zapytanie jest w 160) i dlaczego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
