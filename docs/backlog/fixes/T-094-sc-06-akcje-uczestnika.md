---
id: T-094
title: "SC-06: uczestnik ma ikonę „Uczestnicy” i „Opuść listę” w menu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: done                 # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-13]
threats: [TH-04]
screens: [SC-06, SC-07]
related_tasks: [T-005, T-057, T-059]
---

# T-094 SC-06: uczestnik ma ikonę „Uczestnicy” i „Opuść listę” w menu

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, P1 (blocker). Gałąź: `epic/E-02-konto-i-uczestnicy` (po merge PR #14 zsynchronizowana z `main`).

- **Actual:** na SC-06 akcje AppBar (ikona „Uczestnicy” → SC-07 i menu „Więcej opcji”) są tylko dla `role === "owner"` (`apps/web/src/screens/SC-06-lista/ListScreen.tsx:44-54`). SC-05 nie linkuje do SC-07. Uczestnik dojdzie do SC-07 (lista uczestników, „Opuść listę”) tylko przez wpisanie adresu; E2E T-059 też wchodzi przez `goto` (`apps/web/e2e/sc07-uczestnicy.spec.ts:154`).
- **Expected:**
  - SC-06, Layout pkt 1: AppBar ma ikony „Uczestnicy” → SC-07 i „Więcej opcji” dla każdej osoby z dostępem (`docs/design/screens/SC-06-lista.md:19`).
  - Menu uczestnika zawiera „Opuść listę” (→ jak na SC-07) (`SC-06-lista.md:26`, Copy `menu.leave` `:102`).
  - Źródło: F-13 (`docs/product/BRD.md:229`, `:232`); E-01 przekazał to do E-02 (`T-005-moje-listy.md:175`).
- **Steps to reproduce:**
  1. Tomek przyjmuje zaproszenie Ani do „Dom” i otwiera SC-06 tej listy.
  2. W AppBar nie ma ani ikony „Uczestnicy”, ani „Więcej opcji”.
- **Environment:** lokalnie, web; `f7485f3`.

## Acceptance criteria

- [ ] AC1: Given uczestnik na SC-06, then AppBar ma ikonę „Uczestnicy” prowadzącą do SC-07 tej listy; given właściciel, then bez zmian. — verified by: test komponentu (MSW)
- [ ] AC2: Given uczestnik na SC-06, when otwiera „Więcej opcji”, then widzi tylko „Opuść listę” (bez „Zmień nazwę listy” i „Usuń listę”). — verified by: test komponentu
- [ ] AC3: Given uczestnik, when „Opuść listę” → ConfirmDialog „Opuścić listę „{nazwa}”? Żeby wrócić, potrzebujesz nowego zaproszenia.” → „Opuść”, then zachowanie jak na SC-07 (T-059 AC3): przejście na SC-05 przez `replace`, bez tej listy; „Anuluj” zwraca fokus na „Więcej opcji”; błąd serwera — komunikat `leave.error` w oknie, okno zostaje; offline — pozycja nieaktywna. Logika wyjścia jest jedna dla SC-06 i SC-07 (`useLeaveList`). — verified by: test komponentu (MSW)
- [ ] AC4: Given E2E podróży uczestnika, when wchodzi z SC-06 na SC-07 kliknięciem ikony „Uczestnicy” i opuszcza listę z menu SC-06, then oba przejścia działają bez `goto` na ekran docelowy; axe bez naruszeń na otwartym menu. — verified by: E2E Playwright + axe
- [ ] AC5: No regression in: T-057 (podgląd uczestników), T-059 (wyjście z SC-07, druga karta), menu właściciela na SC-06 (T-005).

## TDD plan

**Seam:** ekran SC-06 z MSW; E2E `sc07-uczestnicy.spec.ts`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | uczestnik widzi ikonę „Uczestnicy” i menu z samym „Opuść listę” | component | Vitest + RTL + MSW | AC1, AC2 |
| 2 | „Opuść listę” z SC-06: sukces, Anuluj, błąd, offline | component | Vitest + RTL + MSW | AC3 |
| 3 | podróż uczestnika przez UI (bez `goto` na SC-07) | e2e | Playwright + axe | AC4 |

**Run:** `pnpm vitest run --project web SC-06 && pnpm -C apps/web e2e sc07-uczestnicy`

## QA plan

- **Regression:** J-04, T-057, T-059, T-005 (menu właściciela), T-063 (offline na SC-06).
- **Edge cases:** rola zmienia się na żywo (usunięcie uczestnika przy otwartym menu); lista się jeszcze ładuje (`list` undefined) — bez akcji.
- **Platforms:** web, szerokość telefonu.

## Root cause

T-005 (E-01) zbudował menu „Więcej opcji” tylko dla właściciela, bo uczestników jeszcze nie było, a wyjście z listy przekazał do E-02. T-008 dodał ikonę „Uczestnicy” wewnątrz tego samego warunku `role === "owner"`; T-057/T-059 zbudowały SC-07 uczestnika, ale nie wróciły do SC-06. Testy nie złapały, bo utrwalały błąd: `ListScreen.test.tsx` („does not offer a participant rename or delete”) i `ParticipantsScreen.test.tsx` („absent for a participant”) sprawdzały **brak** akcji u uczestnika, a E2E T-059 wchodziło na SC-07 przez `goto`.

Inne wystąpienia: brak (jedyne akcje AppBar zależne od roli są w `ListScreen.tsx`). `MoreMenu` nie miał stanu „bez połączenia” — dodany `writes` w akcji (jak `Button`), użyty tylko dla „Opuść listę”; pozycje właściciela otwierają arkusz/okno, w którym zapis jest już blokowany offline.

## Evidence

- Red: `ListScreen.leave.test.tsx` — 7/7 failed, np. `Unable to find an accessible element with the role "link" and name "Uczestnicy"`, `… role "button" and name "Więcej opcji"`.
- Green: 7/7 passed. Poprawione testy utrwalające błąd: `ListScreen.test.tsx` (SEC2 — uczestnik ma menu tylko z „Opuść listę”), `ParticipantsScreen.test.tsx` („SC-06 Uczestnicy icon” — link także dla uczestnika).
- Wyjście: jedno okno `LeaveListDialog` (`SC-07-uczestnicy/LeaveList.tsx`) z `useLeaveList` dla SC-07 i SC-06.
- Pełny Vitest: 152 pliki, 1191 testów passed; `pnpm typecheck`, `pnpm lint`, `pnpm design-check`, build web — OK.
- E2E `sc07-uczestnicy`, `j02-listy`, `brak-polaczenia`: 24 passed (nowy „SC-06 participant leaves the list from „Więcej opcji”” z axe na otwartym menu; T-057 wchodzi na SC-07 przez SC-05 → SC-06 → ikona).
- QA runda 1 (poprawki): `pnpm format:check` przed poprawką — 4 pliki niesformatowane (red), po `prettier --write` — „All matched files use Prettier code style!”. `LeaveListDialog` i `useLeaveList` przeniesione do `apps/web/src/lists/` (bez importu SC-06 → SC-07); komentarz w `ParticipantsScreen.test.tsx` poprawiony; `web.md` „Gdzie jest kod” zaktualizowany. Vitest 1191 passed, typecheck, lint, build OK; E2E `sc07-uczestnicy` 10 passed (`E2E_MAILPIT_PORT=3135` — port 3125 zajęty przez pozostawiony kontener Mailpit).

## Prevention

Propozycje z przeglądu (P1): kontrola przekazań „to E-xx” w `backlog-check` (T-099) i E2E przez UI zamiast `goto`.

Co by zapobiegło: (1) testy interfejsu zależnego od roli pisane według specyfikacji dla każdej roli — dwa testy utrwalały brak akcji uczestnika; (2) `format:check` przed commitem — runda 1 QA padła na Prettierze, którego nie uruchomiono lokalnie.

Przyjęte przez użytkownika (2026-11-05):
- „Pułapki” w `docs/architecture/layers/web.md`: interfejs zależny od roli testowany dla każdej roli, test braku akcji cytuje linię specyfikacji, E2E do ekranu docelowego przez UI, nie `goto`.
- `pnpm format:check` w kroku weryfikacji `/fix` (Step 6) i `/implement-task` — jak w CI.
- Do zrobienia przez użytkownika: zadanie na stabilny pełny przebieg Vitest (13 przekroczeń czasu przy domyślnej liczbie workerów, QA runda 2) przez `/plan-backlog`. Przyczynę procesową (przekazanie E-01 → E-02 bez odbiorcy) pokrywa T-099.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: fail

Środowisko: lokalnie, Windows, `24d4c6d`, `pnpm install --frozen-lockfile`, `pnpm services:up` (Postgres, Mailpit), build web + api.

Wyniki: Vitest 152 pliki / 1191 testów passed; `pnpm typecheck`, `pnpm lint`, `pnpm quality` (jscpd 0 klonów, depcruise 0 naruszeń), `pnpm design-check` (0 HARD-CODED), `pnpm test:mobile` (10) — OK. E2E `sc07-uczestnicy`, `j02-listy`, `brak-polaczenia` (komputer + telefon): 24 passed. **`pnpm format:check` (krok CI „Format (Prettier)”, `.github/workflows/ci.yml:90`) — czerwony** dla zatwierdzonej treści `ListScreen.tsx` (sprawdzone na blobie z `HEAD` przez `prettier --stdin-filepath`, więc nie wynika z CRLF w lokalnym checkout).

Kryteria:
- AC1 — pass: `ListScreen.leave.test.tsx` „links „Uczestnicy” to SC-07” (href `/listy/{id}/uczestnicy`); właściciel bez zmian (`ParticipantsScreen.test.tsx`, `ListScreen.test.tsx`).
- AC2 — pass: menu uczestnika tylko „Opuść listę”; E2E też sprawdza brak „Zmień nazwę listy” / „Usuń listę”.
- AC3 — pass: sukces (`REPLACE` na `/listy`, „Dom” znika), „Anuluj” → fokus na „Więcej opcji”, 500 → `leave.error` w oknie i ponowienie, błąd sieci → „Brak połączenia”, offline → `aria-disabled` + opis bannera, bez okna. Jedno `LeaveListDialog` + `useLeaveList` dla SC-06 i SC-07.
- AC4 — pass: oba E2E wchodzą przez UI (SC-05 → SC-06 → ikona / menu), axe na otwartym menu i po wyjściu, bez `goto` na ekran docelowy.
- AC5 — pass: E2E T-057, T-059 (druga karta), J-02 (menu właściciela), F-15 offline zielone.

Spot-checki (przywrócone, `git status` czysty): przywrócenie warunku `list?.role === "owner" &&` w `ListBar` → 7/7 testów `ListScreen.leave.test.tsx` czerwonych; `const offline = false` w `MoreMenu` → test offline czerwony. Testy gryzą.

Eksploracja / TH-04 (tymczasowy spec Playwright, usunięty): po „Opuść listę” z menu SC-06 były uczestnik dostaje `GET /lists/{id}` 404, `POST …/items` 404, `GET …/members` 404, ponowne `POST …/leave` 404; „Wstecz” w przeglądarce zostaje na SC-05. Właściciel usuwa uczestnika przy otwartym menu SC-06 → uczestnik ląduje na SC-05 (≤ 5 s). Lista w trakcie ładowania: `list &&` — brak akcji AppBar. Mitygacji nie da się obejść; negatywne testy API (`lists.leave.authz.test.ts`, `live.leave.test.ts`) zielone.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | CI / format | Zatwierdzony `apps/web/src/screens/SC-06-lista/ListScreen.tsx` nie przechodzi Prettiera; krok CI „Format (Prettier)” będzie czerwony. Evidence taska nie wymienia `format:check`. | `git show HEAD:…/ListScreen.tsx \| prettier --stdin-filepath …` → linie 53–57: trójargumentowy z `( <OwnerMenu …/> ) : ( <ParticipantMenu …/> )` Prettier składa do jednej linii `{list.role === "owner" ? <OwnerMenu list={list} /> : <ParticipantMenu list={list} />}` | `pnpm format:check` zielony (uruchom `pnpm exec prettier --write apps/web/src/screens/SC-06-lista/ListScreen.tsx`) |
| 2 | minor | Testy / komentarz | Nieaktualny komentarz nad `describe("SC-06 Uczestnicy icon")`: „SEC3 (TH-02): ikona „Uczestnicy” na SC-06 tylko dla właściciela.” — po T-094 ikona jest dla każdej osoby z dostępem. | `ParticipantsScreen.test.tsx:474` | Komentarz zgodny z SC-06 Layout pkt 1 |
| 3 | minor | Architektura / granice modułów | SC-06 importuje `LeaveListDialog` z katalogu innego ekranu (`../SC-07-uczestnicy/LeaveList`) — jedyny taki import między ekranami. Wspólne okno wyjścia lepiej trzymać poza ekranami (np. `lists/`), razem z `useLeaveList`. | `ListScreen.tsx:12`; `grep 'from "../SC-' apps/web/src/screens` | Wspólny kod dwóch ekranów poza `screens/SC-xx` |
| 4 | note | Dokumentacja | `docs/architecture/layers/web.md` nie wspomina `LeaveListDialog` (SC-07) ani nowego `writes` w `MenuAction` (`MoreMenu`). | `web.md:26` | Mapa modułów aktualna |

Do zmiany (fail): nr 1 — sformatować `ListScreen.tsx` Prettierem i potwierdzić `pnpm format:check`. Nr 2–4 opcjonalnie w tej samej rundzie.

## QA round 2 (2026-11-04)

Verdict: pass

Środowisko: lokalnie, Windows, `75cac70`, `pnpm install --frozen-lockfile` (bez zmian w plikach śledzonych), Postgres + Mailpit z `docker compose`, `pnpm build`.

Wyniki: `pnpm format:check` — „All matched files use Prettier code style!” (nr 1 z rundy 1 naprawiony); `pnpm typecheck`, `pnpm lint`, `pnpm quality` (jscpd 0 klonów, depcruise 0 naruszeń), `pnpm design-check` (0 hard-coded) — OK. Vitest `--maxWorkers=4`: 152 pliki / 1191 testów passed. E2E `sc07-uczestnicy`, `j02-listy`, `brak-polaczenia` (komputer + telefon): 24 passed.

Zmiany rundy (`18d5762`): Prettier na `ListScreen.tsx`; `LeaveListDialog` + `leaveMessages`/`leaveErrorText` i `useLeaveList` przeniesione do `apps/web/src/lists/` — SC-06 nie importuje już z katalogu SC-07 (`grep` potwierdza brak importów między ekranami); komentarz w `ParticipantsScreen.test.tsx` poprawiony; `web.md` zaktualizowany. Testy nie zostały osłabione (jedyna zmiana w testach to komentarz).

Kryteria: AC1–AC5 — pass (zachowanie bez zmian względem rundy 1, potwierdzone ponownie testami komponentu i E2E przez UI, z axe na otwartym menu).

Spot-check (przywrócony, `git status` czysty): `onConfirm` w `lists/LeaveListDialog.tsx` bez `leave.mutate()` → 10 testów `ListScreen.leave` + `ParticipantsScreen.leave` czerwonych. Wspólne okno jest pokryte z obu ekranów.

TH-04: mitygacja sprawdzona w rundzie 1 (404 na odczyt/zapis/`members`/`leave` po wyjściu); ta runda nie zmienia API ani autoryzacji — negatywne testy API zielone w pełnym przebiegu.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | Testy / stabilność | Pełny `pnpm vitest run` z domyślną liczbą wątków na tej maszynie dał raz 13 niepowodzeń przez timeouty (5 s test / 10 s hook, np. `ListScreen.check.test.tsx`, `sessionEnded.test.tsx`, `AccountScreen.delete.test.tsx`) — pliki niezwiązane z taskiem; z `--maxWorkers=4` wszystko zielone. | JUnit: `tests="1194" failures="13"`, komunikaty „Test timed out in 5000ms”, „Hook timed out in 10000ms” | Stabilny pełny przebieg niezależnie od obciążenia (limit wątków lub `pool: 'vmThreads'` w `vitest.config.ts`) |
