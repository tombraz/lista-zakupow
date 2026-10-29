---
id: T-015
title: "Przycisk w stanie zapisu zachowuje fokus (aria-disabled zamiast disabled)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: in-qa           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [N-04]
threats: []
screens: [SC-06, SC-07, SC-09]
related_tasks: [T-005, T-007, T-008]
---

# T-015 Przycisk w stanie zapisu zachowuje fokus (aria-disabled zamiast disabled)

## Report

- **Actual:** `Button` z `loading` dostaje `disabled` (`apps/web/src/components/Button/Button.tsx:19`). Przycisk z fokusem traci go w czasie zapisu; w `ConfirmDialog` fokus wypada z pułapki dialogu (np. „Usuń listę”, „Usuń kupione”), tak samo „Utwórz link zaproszenia” i „Wyloguj”.
- **Expected:** W czasie zapisu przycisk ma `aria-disabled="true"` i `aria-busy`, ignoruje kliknięcia i Enter, a fokus zostaje na nim — source: `accessibility.md` „Build” (zarządzanie fokusem), WCAG 2.4.3 / 2.1.2
- **Steps to reproduce:**
  1. SC-06 → „Więcej opcji” → „Usuń listę” → Enter na „Usuń” przy wolnym API.
  2. `document.activeElement` to `body`, poza dialogiem.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #S3.

## Acceptance criteria

- [ ] AC1: Given ConfirmDialog z wolnym zapisem, when użytkownik zatwierdzi klawiaturą, then fokus zostaje na przycisku w dialogu. — verified by: test komponentu SC-06
- [ ] AC2: Given SC-07 i SC-09, when trwa zapis, then przycisk ma `aria-disabled="true"` i fokus. — verified by: testy komponentów
- [ ] AC3: No regression in: wszystkie przyciski z `loading`; styl nieaktywnego przycisku (kontrast `color.action.disabled`); współgra z T-020 (blokada podwójnego wysłania).

## TDD plan

**Seam:** komponent `Button` i ekrany go używające

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `Button loading > keeps focus and announces busy and unavailable instead of becoming disabled` (odtwarza błąd) | komponent | Vitest + RTL | AC1, AC2 |
| 2 | `Button loading > ignores clicks, Enter and Space while loading` | komponent | Vitest + RTL | AC3, T-020 |
| 3 | `Button loading > does not submit its form while loading, also by Enter in a field` | komponent | Vitest + RTL | AC3 (niejawne wysłanie formularza) |
| 4 | `Button loading > stays really disabled when disabled is passed` | komponent | Vitest + RTL | AC3 (limit, wczytywanie) |
| 5 | `SC-06 … delete dialog > keeps focus on „Usuń listę” inside the dialog while deleting` | komponent (cała aplikacja) | Vitest + RTL + MSW | AC1 |
| 6 | `SC-07 … > keeps focus on „Utwórz link zaproszenia” while saving` | komponent | Vitest + RTL + MSW | AC2 |
| 7 | `SC-09 Konto: signing out > keeps focus on „Wyloguj się” while signing out` | komponent | Vitest + RTL + MSW | AC2 |
| 8 | J-02: Enter na „Usuń listę” przy wstrzymanym `DELETE` → przycisk ma fokus i `aria-disabled` | E2E | Playwright | AC1 w prawdziwej przeglądarce |

**Run:** `pnpm vitest run apps/web/src/components/Button apps/web/src/screens/SC-06-lista/ListScreen.test.tsx apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.test.tsx apps/web/src/screens/SC-09-konto/AccountScreen.test.tsx`; E2E `pnpm test:e2e` (J-02)

## QA plan

- **Regression:** wszystkie przyciski z `loading`; styl nieaktywnego przycisku (kontrast `color.action.disabled`); współgra z T-020 (blokada podwójnego wysłania)
- **Edge cases:** `type="submit"` w stanie ładowania: kliknięcie i Enter w polu formularza (niejawne wysłanie przechodzi przez kliknięcie przycisku) nie wysyłają formularza — `onClick` Buttona robi `preventDefault`; jawne `disabled` (limit 20 uczestników / 500 pozycji, AddBar przed wczytaniem listy, drugi przycisk `EditItemSheet`) zostaje prawdziwym `disabled`; styl `[aria-disabled="true"]` = styl `:disabled` (`color.action.disabled`, kursor domyślny); jsdom nie zdejmuje fokusu z elementu `disabled`, więc fokus w prawdziwej przeglądarce sprawdza tylko E2E J-02 (#8).
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

`Button` od T-004 (`dbca17a`) w stanie `loading` ustawiał `disabled`; przeglądarka zdejmuje wtedy fokus z przycisku (na `body`, poza pułapkę `Modal`). Testy go nie złapały, bo żaden nie sprawdzał fokusu w czasie zapisu, a jsdom — w przeciwieństwie do przeglądarki — zostawia fokus na elemencie `disabled` (brak seamu w testach komponentów; łapie to dopiero E2E).

Inne wystąpienia: pozostałe `disabled` w `apps/web/src` to trwała niedostępność (limit, wczytywanie), nie stan zapisu — bez zmian. Pokrewne, inna przyczyna: gdy własne dodanie osiągnie limit 500, `AddItemBar` dostaje `disabled` i fokus z pola „Co kupić?” spada na `body` — do oceny w osobnym zadaniu.

## Evidence

- Czerwone przed poprawką: `Button loading > keeps focus …` — `expect(element).not.toBeDisabled()` / „Received element is disabled: <button aria-busy="true" … disabled="">”; testy SC-06, SC-07, SC-09 — `expect(element).toHaveAttribute("aria-disabled", "true")` nie spełnione; E2E J-02 (telefon i komputer) — `expect(locator).toBeFocused() failed`, „Received: inactive” (`j02-listy.spec.ts:93`).
- Po poprawce: web + tokens 24 pliki / 176 testów zielone; `pnpm typecheck`, `pnpm lint`, `pnpm design-check` czyste; build OK; E2E 35/36.
- E2E „SC-06 at 500 items shows the limit” (`j03-pozycje.spec.ts:102`) niestabilny niezależnie od T-015: w nieudanym przebiegu ekran pokazuje „491 do kupienia” — `addViaApi` nie sprawdza statusów, a API zwróciło 10× 500 (`pg-pool` timeout połączenia przy 50 równoległych `POST`, `apps/web/test-results/api.log`). Ta sama przyczyna co T-021 (pula z `connectionTimeoutMillis` 3 s).

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
