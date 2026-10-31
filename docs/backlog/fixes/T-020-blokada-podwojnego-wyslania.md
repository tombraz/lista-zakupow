---
id: T-020
title: "Synchroniczna blokada podwójnego wysłania formularzy i akcji"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: done                # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-05, F-11]
threats: []
screens: [SC-02, SC-05, SC-06, SC-07, SC-08]
related_tasks: [T-004, T-005, T-007, T-008]
---

# T-020 Synchroniczna blokada podwójnego wysłania formularzy i akcji

## Report

- **Actual:** Ochrona przed podwójnym wysłaniem zależy tylko od przerysowania przycisku (`isPending` → `disabled`). Pod obciążeniem SC-07 utworzył link dwa razy (`ParticipantsScreen.test.tsx:79`: `expected 2 to be 1`). Ten sam wzorzec: tworzenie listy (`NewListForm.tsx:63`), rejestracja (`useSignUpForm.ts:96`), „Usuń kupione” (`confirmMutation.ts`), przyjęcie zaproszenia (`InvitationScreen.tsx:36-38`).
- **Expected:** Drugie kliknięcie / Enter przed odpowiedzią nie wysyła drugiego żądania, niezależnie od chwili przerysowania — source: T-008 AC1 („tworzy link raz”), F-05
- **Steps to reproduce:**
  1. Test komponentu: dwa `fireEvent.click` synchronicznie na „Utwórz link zaproszenia”.
  2. MSW liczy 2 żądania POST.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #C2.

## Acceptance criteria

- [ ] AC1: Given SC-07, when dwa kliknięcia synchronicznie, then jedno `POST` linku. — verified by: test komponentu z `fireEvent` ×2
- [ ] AC2: Given tworzenie listy, rejestracja, „Usuń kupione”, przyjęcie zaproszenia, when podwójne wysłanie, then jedno żądanie. — verified by: testy komponentów
- [ ] AC3: Given `layers/web.md` „Pułapki”, then opisuje wspólny mechanizm blokady. — verified by: przegląd dokumentu
- [ ] AC4: No regression in: dodawanie pozycji (idempotentne `id`, T-006) bez zmian; T-015 (aria-disabled).

## TDD plan

**Seam:** ekran z MSW (cała aplikacja, `renderApp`); wspólny mechanizm `useGuardedMutation` (`apps/web/src/api/useGuardedMutation.ts`) — zamiennik `useMutation` z blokadą w `useRef` ustawianą przed `mutate`, zwalnianą w `onSettled` hooka.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `SC-07 invitations of the owner > creates a link once when clicked twice before the button re-renders (T-020)` (odtwarza błąd) | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `SC-07 … > revokes a link once when clicked twice, and another link meanwhile (T-020)` | komponent | Vitest + RTL + MSW | AC2 (ta sama przyczyna; `lockOf` — różne linki naraz) |
| 3 | `SC-05 … new list form > creates the list once when submitted twice before the button re-renders (T-020)` | komponent | Vitest + RTL + MSW | AC2 |
| 4 | `SC-02 Rejestracja > signs up once when submitted twice before the button re-renders (T-020)` | komponent | Vitest + RTL + MSW | AC2 |
| 5 | `SC-06 „Usuń wszystkie kupione” > sends one request when confirmed twice before the button re-renders (T-020)` | komponent | Vitest + RTL + MSW | AC2 |
| 6 | `SC-08 Zaproszenie > joins once when „Dołącz do listy” is clicked twice before it re-renders (T-020)` | komponent | Vitest + RTL + MSW | AC2 |
| 7 | `SC-06 … delete > deletes once when confirmed twice before the button re-renders (T-020)` | komponent | Vitest + RTL + MSW | AC2 (ta sama przyczyna) |
| 8 | `SC-09 Konto: signing out > signs out once when clicked twice before the button re-renders (T-020)` | komponent | Vitest + RTL + MSW | AC2 (ta sama przyczyna) |

**Run:** `pnpm vitest run apps/web/src/screens -t "T-020"`; całość `pnpm vitest run --project web --project tokens`

## QA plan

- **Regression:** dodawanie pozycji (idempotentne `id`, T-006) bez zmian; T-015 (aria-disabled)
- **Edge cases:** dwa `fireEvent.click` bez `await` (przed przerysowaniem); unieważnianie dwóch różnych linków naraz — oba wysłane, ten sam link raz (`lockOf`); po błędzie zapisu blokada zwolniona, ponowienie działa (istniejące testy „spróbuj ponownie”: SC-08 brak sieci, SC-06 błąd usunięcia, SC-05 błąd tworzenia); po odmontowaniu (np. przejście po sukcesie) blokadę zwalnia `onSettled` z opcji hooka, nie z `mutate`; świadomie bez blokady: dodawanie pozycji (idempotentne `id`; wpisywanie i Enter w trakcie zapisu, T-006) i checkbox (`useCheckItem` blokuje na pozycję przez stan `saving`, który zawsze przerysowuje); `mutateAsync` nie jest blokowany (nieużywany w `apps/web`).
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

Od T-004 (`Button` z `disabled` przy `loading`) i dalej (T-005, T-007, T-008) jedyną ochroną przed podwójnym wysłaniem był przycisk w stanie zapisu, a ten blokuje dopiero po przerysowaniu z `isPending`; TanStack Query powiadamia komponent asynchronicznie, więc drugie kliknięcie albo Enter przed przerysowaniem wywołuje `mutate` drugi raz. Istniejące testy klikały przez `userEvent` z `await` między kliknięciami, co daje czas na przerysowanie; w formularzach (SC-01, SC-02, SC-05) dodatkowo `submit()` ustawia stan przed `mutate`, więc `act` przerysowuje przycisk synchronicznie i ochrona działa przypadkiem — testy 3 i 4 przechodzą także bez poprawki.

Inne wystąpienia (ta sama przyczyna, ta sama warstwa, poprawione tutaj): logowanie (SC-01), usunięcie listy (SC-06), zapis i usunięcie pozycji w „Edytuj pozycję” (SC-06), unieważnienie linku (SC-07), wylogowanie (SC-09). Bez zmian: dodawanie pozycji (idempotentne `id`, T-006) i checkbox (blokada na pozycję w `useCheckItem`).

## Evidence

- Czerwone przed poprawką: #1 `expected 2 to be 1` (`ParticipantsScreen.test.tsx:127`, liczba `POST`); #2 `expected [ 'a', 'a', 'b' ] to deeply equal [ 'a', 'b' ]`; #5 `expected [ 'POST', 'POST' ] to deeply equal [ 'POST' ]`; #6, #7, #8 `expected 2 to be 1`. #3 i #4 zielone także przed poprawką (zob. Root cause) — zostają jako testy regresji; w jednym przebiegu przed poprawką #4 przekroczył limit 5 s pod obciążeniem (T-021).
- Po poprawce: 8/8 testów T-020 zielone; web + tokens 24 pliki / 184 testy; `pnpm test` 89 plików / 418 testów (w pierwszym przebiegu 1 czerwony: `InvitationScreen.entry.test.tsx > sign up: the request carries the token…`, w izolacji 3/3 zielony i zielony bez poprawki 2/2 — znany wyścig przekierowania C1, T-019; drugi pełny przebieg 418/418); `pnpm typecheck`, `pnpm lint`, Prettier, `pnpm design-check`, `pnpm quality` czyste; build web OK. E2E nie uruchamiane (zmiana w hookach, pokryta testami komponentów).

## Prevention

Co by zapobiegło: jeden wspólny hook zapisu od początku i test podwójnego kliknięcia bez `await` przy każdym przycisku zapisu. Wpis w „Pułapkach” `layers/web.md` istniał od przeglądu E-01, ale nie wskazywał mechanizmu.

- Zrobione w tym zadaniu (AC3): „Pułapki” i „Gdzie jest kod” w `layers/web.md` wskazują `useGuardedMutation`, wyjątki i to, że test może przejść bez blokady.
- Przyjęte przez użytkownika (2026-10-29): reguła lint `no-restricted-imports` w `eslint.config.js` zabrania `useMutation` z `@tanstack/react-query` w `apps/web/src` poza `api/useGuardedMutation.ts`; wyjątki `useAddItem` i `useCheckItem` z `eslint-disable-next-line … --` i uzasadnieniem. Sprawdzone: bez wyjątków `pnpm lint` pada na obu plikach (2 błędy), z nimi czysty.

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Testy | Testy #3 (SC-05 tworzenie listy) i #4 (SC-02 rejestracja) nie gryzą: przechodzą także bez blokady, bo `submit()` ustawia stan przed `mutate` i `act` przerysowuje przycisk. Dla tych dwóch ekranów AC2 dowodzi przegląd kodu (`useListNameForm`, `useSignUpForm` używają `useGuardedMutation`) i spot-check mechanizmu na pozostałych ekranach. Autor to opisał (Root cause, „Pułapki”). | Spot-check: wyłączona linia `if (locked.current.has(lock)) return;` → 6/8 testów T-020 czerwone (#1, #2, #5, #6, #7, #8), #3 i #4 zielone. | Test, który bez blokady jest czerwony (np. wywołanie `mutate` dwa razy bez zmiany stanu), albo jawne oznaczenie #3/#4 jako testów regresji. |
| 2 | note | Testy | Pełny `pnpm test`: w 1. przebiegu 1 czerwony `InvitationScreen.entry.test.tsx:112` (pathname po rejestracji z zaproszeniem), 2. przebieg 418/418; plik osobno 3× → 1 czerwony. Znany wyścig C1 śledzony w T-019 (`todo`), niezwiązany z tą zmianą (autor: czerwony także bez poprawki). | `pnpm test`: 417/418, potem 418/418. | Naprawa w T-019. |
| 3 | note | Kod | Importy `useGuardedMutation` dopisane na końcu bloku importów (po importach lokalnych tego samego poziomu) — lint i Prettier ich nie porządkują. | np. `useSignInForm.ts`, `ClearBoughtDialog.tsx`. | Kosmetyka; ewentualnie reguła `import/order`. |

**Reprodukcja:** `pnpm install --frozen-lockfile` bez zmian w plikach; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd, depcruise: 0 naruszeń), `pnpm design-check` (0 błędów) czyste. `pnpm vitest run apps/web/src/screens -t "T-020"`: 8/8 zielone.

**Kryteria akceptacji:**

- AC1 — pass: test #1 (`ParticipantsScreen.test.tsx`) liczy `POST` po dwóch synchronicznych `fireEvent.click`; czerwony bez blokady.
- AC2 — pass: „Usuń kupione” (#5), przyjęcie zaproszenia (#6), usunięcie listy (#7), wylogowanie (#8), unieważnienie linku z `lockOf` (#2: ten sam link raz, inny link wysłany) — wszystkie czerwone bez blokady. Tworzenie listy i rejestracja — zob. #1 (minor).
- AC3 — pass: `layers/web.md` „Pułapki” i „Gdzie jest kod” opisują `useGuardedMutation`, `lockOf`, wyjątki i test, który przechodzi bez blokady.
- AC4 — pass: `useAddItem` i `useCheckItem` nie zmienione (jedyne pozostałe `useMutation` w `apps/web/src` poza hookiem); testy T-006 i T-015 (aria-disabled) zielone w pełnym przebiegu.

**Przegląd kodu:** `onSettled` zwalnia blokadę z opcji hooka (TanStack Query 5.105: indeks 2 = `variables`; wywołania z opcji hooka przychodzą też po odmontowaniu), błąd zapisu zwalnia blokadę (istniejące testy ponowienia zielone). Nowa tożsamość `mutate` w każdym renderze: jedyny `useEffect` z `join` (`useAutoJoin`) ma własny `started` ref — bez podwójnego `accept`. Fix: Root cause wyjaśnia, dlaczego testy przepuściły błąd (`userEvent` z `await`); test odtwarzający (#1) czerwony bez poprawki (spot-check). Spot-check cofnięty, `git status` czysty.

**Bezpieczeństwo:** zmiana tylko po stronie klienta, brak `threats:`; bez sekretów i danych osobowych w logach. Przeglądarka i E2E nie uruchamiane (zmiana w hookach, pokryta testami komponentów).
