---
id: T-031
title: "E2E j03 „500th item” czeka na pełną listę; plik zgodny z Prettierem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-07]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-023]
---

# T-031 E2E j03 „500th item” czeka na pełną listę; plik zgodny z Prettierem

## Report

Źródło: QA T-025 runda 1 #4 i runda 2 #2.

- **Actual:**
  - `apps/web/e2e/j03-pozycje.spec.ts` › „SC-06 adding the 500th item moves focus to the limit warning (T-023)” jest niestabilny: po `addViaApi(…, 499)` czeka tylko na `toBeEnabled()` pola, więc wpisuje pozycję, gdy ekran ma np. 497 z 499 pozycji (reszta dochodzi na żywo). Własna pozycja nie jest wtedy 500., limit się nie pojawia i `toBeFocused()` pada.
  - `pnpm format:check` pada na tym pliku (`getByRole("status").filter(…)` sformatowane inaczej niż Prettier), więc `pnpm check` jest czerwony.
- **Expected:** test wpisuje 500. pozycję dopiero, gdy ekran pokazuje wszystkie 499; `pnpm format:check` zielony. — source: T-023 AC1, `docs/architecture/testing-strategy.md` (testy deterministyczne, czekanie na zdarzenie, nie na czas).
- **Steps to reproduce:**
  1. `pnpm test:e2e -g T-023` kilka razy (QA: 1 z 3 uruchomień czerwone; w `error-context` „497 do kupienia”).
  2. `pnpm format:check` → „Code style issues found” w `j03-pozycje.spec.ts`.
- **Environment:** lokalnie (Windows), gałąź `epic/E-01-szkielet-i-wspolna-lista` @ `387a8e8`.
- **Evidence:** raporty QA w `T-025-fokus-przy-limicie-list-i-uczestnikow.md` (runda 1 #4, runda 2 #2).

## Acceptance criteria

- [ ] AC1: Given lista z 499 pozycjami dodanymi przez API, when test wpisuje 500. pozycję, then robi to dopiero, gdy ekran pokazuje 499 pozycji, i test przechodzi w 5 kolejnych uruchomieniach. — verified by: E2E J-03 T-023 (`--repeat-each 5`)
- [ ] AC2: `pnpm format:check` zielony. — verified by: CI / `pnpm check`
- [ ] AC3: No regression in: J-03, T-023.

## TDD plan

**Seam:** E2E (Playwright), ekran SC-06

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `SC-06 adding the 500th item moves focus to the limit warning (T-023)` z czekaniem na 499 pozycji | E2E | Playwright | AC1 |

**Run:** `pnpm test:e2e -g T-023 --repeat-each 5`; `pnpm format:check`

## QA plan

- **Regression:** J-03, „SC-06 at 500 items…” (ten sam plik, ta sama metoda `addViaApi`).
- **Edge cases:** to samo czekanie w innych testach po `addViaApi` przy otwartej liście.
- **Platforms:** Chromium telefon i komputer (projekty Playwright), Windows i CI Linux.

## Root cause

Nie opóźnienie ekranu: AddBar włącza się dopiero po jednym `GET` listy ze wszystkimi pozycjami, więc „497 do kupienia” znaczy, że na serwerze było mniej pozycji. `addViaApi` wysyłał po 50 `POST` naraz i nie sprawdzał odpowiedzi. API ma pulę 10 połączeń z limitem czekania 3 s (`db/pool.ts`), a zapisy pozycji idą po kolei przez blokadę listy (`lockList`). Część żądań czeka na połączenie zbyt długo i dostaje `500 internal`, którego test nie widział. Lokalnie najwolniejsze żądanie w paczce 50 trwało ~4,4 s, czyli blisko progu. Na obciążonej maszynie (QA) kilka żądań przekracza próg. Przyczynę 500 (czekanie na pulę) wywnioskowano z konfiguracji, bo log API nie trafia do wyjścia Playwright. Samo 500 pod obciążeniem jest potwierdzone.

Dlaczego testy tego nie złapały: przygotowanie danych nie sprawdzało statusów, a czekanie na `toBeEnabled()` nie sprawdzało liczby pozycji, więc błąd przygotowania wyglądał jak błąd fokusu.

Poprawka (tylko test): `addViaApi` wysyła najwyżej 10 żądań naraz (rozmiar puli; zapisy i tak są szeregowane blokadą, więc czas bez zmian: 7,8 → 8,2 min dla 10 przebiegów), wymaga `201` od każdego i po przeładowaniu czeka na „N do kupienia”. Format zgodny z Prettierem.

Inne wystąpienia: pozostałe wywołania API w `e2e/` (j01, j02, j04, j05) to pojedyncze żądania po kolei, bez obciążenia, po których asercje UI padają jawnie. To nie ta sama przyczyna, więc bez zmian. Zachowanie API (500 zamiast czekania przy >10 równoległych zapisach do jednej listy) nie jest zmieniane: w produkcji jedna lista nie dostaje dziesiątek zapisów naraz (F-07). Do rozważenia przy pracy nad wydajnością.

## Evidence

- Red (AC2): `prettier --check apps/web/e2e/j03-pozycje.spec.ts` → „Code style issues found”.
- Red (AC1): niestabilności nie udało się odtworzyć powtórzeniami. `pnpm test:e2e -g T-023 --repeat-each 5` przed poprawką: 10/10 zielonych (7,8 min). Mechanizm odtworzono doraźnym spec (usunięty): 499 `POST` po 50 naraz → wszystkie 201, najwolniejsze 4,2–4,5 s. Po 150 naraz → 242× 201, 257× `500 {"error":{"code":"internal"}}`, a test tego nie widzi. Z nową asercją statusów i paczką 150 test T-023 pada już w `addViaApi` (`expect(received).toEqual(expected)`: statusy ≠ 201), nie na fokusie.
- Green: `pnpm test:e2e -g T-023 --repeat-each 5` → 10 passed (telefon 5, komputer 5; 8,2 min). `format:check`, `lint`, `typecheck`, `quality`, `design-check` → OK. Zmiana dotyczy tylko `e2e/`, więc `pnpm test` (Vitest) jej nie obejmuje. Cały `j03-pozycje.spec.ts` (oba projekty): 10 passed (5,1 min).

## Prevention

Co by zapobiegło: przygotowanie danych, które samo sprawdza statusy i czeka na stan ekranu, w jednym wspólnym miejscu zamiast w każdym spec.

Przyjęte przez użytkownika (2026-10-30), oba:

1. `addViaApi` przeniesiony do `apps/web/e2e/lists.ts` (wspólny helper: statusy 201, najwyżej 10 żądań naraz, czekanie na „N do kupienia”).
2. `layers/web.md` „Pułapki” — dane E2E przez API: sprawdzone statusy, najwyżej 10 żądań naraz, czekanie na stan ekranu.

Odrzucone: sprawdzanie statusu w ogólnym `api()` — część testów celowo oczekuje odmowy (np. limit zaproszeń w J-04).

## Incident note

<Nie dotyczy.>

## QA round 1 (2026-10-30)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | API / performance | When the pool runs out (more than 10 parallel writes to one list), the API returns `500 internal` instead of making the request wait or returning 503. The fix covers only the test, as the root cause says. | Spot-check with `PARALLEL_ADDS = 150`: 65 of 150 responses were not 201. | Consider for performance work: 503 + `Retry-After`, or a longer queue. |
| 2 | note | Test | After `addViaApi`, the line `await expect(page.getByLabel(NAME)).toBeEnabled()` in the T-023 test is now redundant, because the wait for „499 do kupienia” is stronger. It does no harm. | `j03-pozycje.spec.ts:128` | Can stay or be removed. |
| 3 | note | Environment | About 50 leftover testcontainers containers (`docker ps`) are running on the local machine and add load during E2E runs. | `docker ps` | Clean up the environment or fix where Vitest/testcontainers leak containers. |
| 4 | note | TDD | The original red state (flakiness) was not reproduced with repetitions. Only the mechanism was reproduced. That is acceptable for a test-only fix: the spot-check confirms that the new status check catches the problem in data setup. | Evidence section; QA spot-check below. | — |

**Reproduction (QA):**
- `pnpm format:check` → „All matched files use Prettier code style!” (AC2 pass).
- `pnpm lint`, `pnpm typecheck`, `pnpm quality` → OK; `backlog-check` → OK (2 WARNs about TH-10/TH-18, not related).
- `pnpm test:e2e -g T-023 --repeat-each 5` → 10 passed (5 telefon + 5 komputer, 8.9 min) (AC1 pass).
- `pnpm test:e2e j03-pozycje` → 10 passed (5.3 min): J-03, deleted item, 500 items, T-023, AddBar (AC3 pass).
- Vitest not run: the change touches only `apps/web/e2e/`, which Vitest does not cover.

**Spot-check:** `PARALLEL_ADDS = 150` → the T-023 test fails in `addViaApi` (`expect(received).toEqual(expected)`, 65 statuses other than 201, line 102), not on focus. Reverted with `git checkout`; `git status` is clean.

**Code review:** scope limited to the helper in the test; the constant has a comment explaining why. The wait is on an event (text „N do kupienia”), not on a timeout, as `testing-strategy.md` requires. The other `addViaApi` callers (500, 30) run correctly with the new wait. The root cause explains why the tests missed the problem.

**Security:** not applicable (test only, `threats: []`).
