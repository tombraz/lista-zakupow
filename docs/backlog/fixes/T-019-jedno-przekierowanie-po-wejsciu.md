---
id: T-019
title: "Jedno przekierowanie po logowaniu/rejestracji (bez dodatkowego accept zaproszenia)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-12]
threats: []
screens: [SC-01, SC-02, SC-08]
related_tasks: [T-004, T-008, T-010]
---

# T-019 Jedno przekierowanie po logowaniu/rejestracji (bez dodatkowego accept zaproszenia)

## Report

- **Actual:** Po rejestracji z zaproszeniem cel wybierają dwa mechanizmy: formularz (`apps/web/src/screens/SC-02-rejestracja/useSignUpForm.ts:44-49`: `navigate` ze stanem `joinedListId`, potem `setSession`) i strażnik `PublicOnly` (`apps/web/src/session/guards.tsx:38-46`). Gdy strażnik zobaczy sesję przed nowym `location.state`, kieruje na SC-08 z auto-`accept` — drugi `accept` daje `already_member` zamiast „Dołączyłeś”. Objaw: `InvitationScreen.entry.test.tsx` niestabilny (`accepts.count` 1 zamiast 0), notowany też w QA T-010. Mechanizm to hipoteza przeglądu — potwierdzić.
- **Expected:** O celu po wejściu decyduje jedno miejsce; rejestracja z ważnym zaproszeniem kończy się na udostępnionej liście bez dodatkowego `accept` — source: F-12, T-008 (rejestracja z tokenem)
- **Steps to reproduce:**
  1. `InvitationScreen.entry.test.tsx` uruchamiany wielokrotnie albo równolegle z drugim przebiegiem web.
  2. Okresowo `expected 1 to be 0` (accepts).
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #C1.

## Acceptance criteria

- [ ] AC1: Given rejestracja z ważnym tokenem, when API odpowiada `invitation.listId`, then klient przechodzi na SC-06 tej listy i nie wysyła `accept`; test stabilny w 50 powtórzeniach. — verified by: `InvitationScreen.entry.test.tsx` z powtórzeniami
- [ ] AC2: Given logowanie z SC-08, when sesja ustawiona, then dokładnie jeden `accept`. — verified by: test komponentu
- [ ] AC3: No regression in: powrót na chroniony ekran po logowaniu, zalogowany na SC-01 → SC-05, E2E J-03.

## TDD plan

**Seam:** cała aplikacja (`renderApp`, router + formularze SC-01 / SC-02 + strażnik `PublicOnly`) z MSW. Kolejność „sesja przed przejściem routera” wymusza test: `notifyManager.setScheduler` (publiczne API TanStack Query) powiadamia synchronicznie, więc przerysowanie sesji wyprzedza przejście routera (`startTransition`) — kolejność możliwa w przeglądarce pod obciążeniem.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `SC-08 → SC-01 / SC-02 → the shared list > sign up: no second accept when the session renders before the navigation (T-019)` (odtwarza błąd) | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `… > sign up: the request carries the token and the new account lands on the list` (istniejący, niestabilny) | komponent | Vitest + RTL + MSW | AC1 (50 powtórzeń) |
| 3 | `… > sign in: SC-01 says why, then joins automatically and the link leaves history` (istniejący) | komponent | Vitest + RTL + MSW | AC2 (`accepts.count` = 1) |

**Run:** `pnpm vitest run apps/web/src/screens/SC-08-zaproszenie`; 50 powtórzeń: tymczasowa kopia pliku z `{ repeats: 49 }` przy testach 1 i 2

## QA plan

- **Regression:** powrót na chroniony ekran po logowaniu, zalogowany na SC-01 → SC-05, E2E J-03
- **Edge cases:** sesja przerysowana przed przejściem routera (test 1); rejestracja z martwym linkiem — bez `joinedListId`, strażnik → SC-08 z błędem (istniejący test „link that stopped working”); `flushSync` działa tylko z `RouterProvider` z `react-router/dom` (w `main.tsx` i `test/render.tsx`); z `RouterProvider` z `react-router` RR tylko ostrzega i wraca do `startTransition` — test 1 wtedy czerwony.
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

Od T-008 (`0f997f6`) `useSignedUp` zapisuje `joinedListId` w stanie trasy (`await navigate(…)`), a potem ustawia sesję; o celu decyduje `PublicOnly` z `afterEntry(location.state)`. `RouterProvider` aktualizuje stan w `React.startTransition` (react-router 8.5, `lib/components.js:153`), więc `await navigate` kończy się przed zatwierdzeniem nowego stanu, a ustawienie sesji (`useSyncExternalStore`, pas synchroniczny) może się przerysować wcześniej. Strażnik widzi wtedy sesję ze starym stanem bez `joinedListId` i kieruje na SC-08 z `join` → drugi `accept` (`already_member` w prawdziwym API). Testy tego nie łapały, bo kolejność zależała od wyścigu `setTimeout(0)` (planista Query) z zadaniem planisty React: zwykle wygrywał router, pod obciążeniem — nie; niestabilność uznano za problem czasu (C3).

Poprawka: `navigate(…, { flushSync: true })` — stan trasy zatwierdzony synchronicznie przed sesją; `RouterProvider` z `react-router/dom` (dostarcza `ReactDOM.flushSync`) w `main.tsx` i `test/render.tsx`. O celu nadal decyduje tylko `PublicOnly` / `afterEntry`. Logowanie nie zmienia stanu trasy, więc nie miało wyścigu.

Inne wystąpienia: wylogowanie w SC-09 (`AccountScreen.tsx:20-21`: `setSession(null)`, potem `navigate("/logowanie")`) ściga się z `RequireSession`; oba kończą na `/logowanie`, różnica tylko w `from` (po ponownym zalogowaniu `/konto` zamiast `/listy`) — bez szkody, bez zmian.

## Evidence

- Czerwone przed poprawką (3/3 przebiegi): test 1 `AssertionError: expected 1 to be +0` (`InvitationScreen.entry.test.tsx`, `accepts.count`) — hipoteza przeglądu potwierdzona.
- Po poprawce: plik 5/5; testy 1 i 2 po 50 powtórzeń zielone (`repeat x49`, 132 s); `pnpm test` 89 plików / 419 testów; `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm quality`, `pnpm design-check`, `pnpm workflow-check` czyste; build web OK.
- E2E `j01 j03 j04` (Windows): 20 zielonych, 2 czerwone — `j03-pozycje.spec.ts:102` „SC-06 at 500 items…” (komputer, telefon); w osobnym przebiegu zielony. Nie dotyczy ścieżki wejścia (zob. T-021).

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

Zakres: commit `48f5e78` (4 pliki: `useSignUpForm.ts`, `main.tsx`, `test/render.tsx`, `InvitationScreen.entry.test.tsx`).

**Kryteria:**

- AC1 — pass. Test 1 (T-019) zielony; testy 1 i 2 z `{ repeats: 49 }` (tymczasowa zmiana, cofnięta): 5/5, 50 powtórzeń każdy, 121 s. Test asertuje `accepts.count === 0`, tekst „Dołączyłeś(-aś)…” i ścieżkę `/listy/:id`.
- AC2 — pass. „sign in: SC-01 says why…” asertuje `accepts.count === 1` i usunięcie linku z historii.
- AC3 — pass. `routes.test.tsx` (powrót na chroniony adres, zalogowany na SC-01/SC-02 → `/listy`), `SignInScreen.test.tsx` AC4 zielone; E2E `j01 j03 j04` (Windows, port 3197): 21/22, jedna czerwień niezwiązana (#1); po powtórce 3×2 zielone.

**Reprodukcja:** `pnpm format:check`, `lint`, `typecheck`, `quality`, `design-check`, `workflow-check` czyste; `pnpm test` 89 plików / 419 testów zielone.

**Spot-checki (cofnięte, `git status` czysty):**

- bez `flushSync: true` w `useSignUpForm.ts` → test 1 czerwony `AssertionError: expected 1 to be +0` (odtwarza błąd z raportu),
- `RouterProvider` z `react-router` zamiast `react-router/dom` w `test/render.tsx` → test 1 czerwony tak samo (potwierdza uwagę z QA planu).

**Fix-specific:** sekcja „Root cause” wyjaśnia, czemu testy nie łapały błędu (wyścig `setTimeout(0)` planisty Query z planistą React); test odtwarzający jest czerwony bez poprawki. Evidence pokazuje czerwień przed poprawką. O celu po wejściu nadal decyduje tylko `PublicOnly` / `afterEntry`. Zmiana minimalna, bez scope creep; nadpisanie planisty Query przywracane w `finally`.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | E2E / stabilność | `j03-pozycje.spec.ts:6` [telefon] raz czerwony: po `Tab` fokus poza arkuszem „Edytuj pozycję” (linia 41). Niezwiązane ze ścieżką wejścia; inny test niż ten w Evidence (`:102`). | pełny przebieg 21/22; `--repeat-each 3` 6/6 zielone | test stabilny — do T-021 albo osobnego zadania |
| 2 | minor | Zapobieganie | Poprawka zależy od importu `RouterProvider` z `react-router/dom` w `main.tsx`; test komponentu chroni tylko `test/render.tsx`. Powrót do `react-router` w `main.tsx` nie zostanie wykryty (RR tylko ostrzega). | spot-check 2; brak testu dla `main.tsx` | reguła ESLint `no-restricted-imports`: `RouterProvider` tylko z `react-router/dom` |
| 3 | note | Dokument | Sekcja „Prevention” zawiera nadal placeholder szablonu. | plik zadania | uzupełnić (np. reguła z #2) |
