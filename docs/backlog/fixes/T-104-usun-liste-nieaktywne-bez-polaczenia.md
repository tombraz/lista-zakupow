---
id: T-104
title: "SC-06: „Usuń listę” w menu nieaktywne bez połączenia, jak inne wyzwalacze akcji destrukcyjnych"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-15, F-05]
threats: []
screens: [SC-06]
related_tasks: [T-063, T-094, T-005]
---

# T-104 SC-06: „Usuń listę” w menu nieaktywne bez połączenia, jak inne wyzwalacze akcji destrukcyjnych

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-06-1.md`, K3 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** w menu „Więcej opcji” na SC-06 pozycja uczestnika „Opuść listę” ma `writes: true` (`apps/web/src/screens/SC-06-lista/ListScreen.tsx:205-207`), więc bez połączenia jest nieaktywna (`aria-disabled`, opis paska). Pozycja właściciela „Usuń listę” (`ListScreen.tsx:179-183`) nie ma `writes`. Okno usunięcia otwiera się bez połączenia, a zapis blokuje dopiero przycisk w oknie. Pozostałe wyzwalacze okien destrukcyjnych mają `writes`: SC-07 „Opuść listę” i „Usuń”, SC-09 „Usuń konto”. Reguła nie jest nigdzie zapisana.
- **Expected:** bez połączenia wyzwalacz akcji zapisu jest nieaktywny w ten sam sposób na każdym ekranie. Źródło: F-15 (zapisy zablokowane bez połączenia), T-063, zachowanie T-094 dla uczestnika.
- **Steps to reproduce:**
  1. Zaloguj się jako właściciel i otwórz SC-06.
  2. Przełącz przeglądarkę w tryb offline.
  3. Otwórz „Więcej opcji” → „Usuń listę”: okno się otwiera.
- **Environment:** lokalnie, commit `120e478`.
- **Evidence:** `docs/reviews/E-02-2026-11-06-1.md`, K3.

## Acceptance criteria

- [ ] AC1: Given właściciel na SC-06 bez połączenia, when otwiera „Więcej opcji”, then „Usuń listę” jest nieaktywne (`aria-disabled`, `aria-describedby` paska „Brak połączenia”) i nie otwiera okna. — verified by: test komponentu (MSW, offline)
- [ ] AC2: Given decyzja, czy „Zmień nazwę listy” też ma `writes` (zapis), then decyzja i reguła są zapisane w `docs/architecture/layers/web.md`: „wyzwalacz akcji zapisu w menu ma `writes`”. Jeśli „Zmień nazwę listy” dostaje `writes`, to z testem jak w AC1. — verified by: przegląd QA
- [ ] AC3: No regression in: T-005 (menu właściciela, usunięcie listy online), T-094 (menu uczestnika), T-063 (pasek „Brak połączenia”).

## TDD plan

**Seam:** ekran SC-06 z MSW i stanem połączenia offline.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | właściciel offline → „Usuń listę” `aria-disabled`, klik nie otwiera okna | component | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm vitest run --project web SC-06`

## QA plan

- **Regression:** usunięcie listy online; menu uczestnika offline i online.
- **Edge cases:** utrata połączenia przy otwartym menu; powrót połączenia.
- **Platforms:** web.

## Root cause

Menu właściciela SC-06 powstało w T-005, przed trybem offline. T-063 dodał `writes` do `Button`, a T-094 dodał `writes` do `MoreMenu`, ale tylko dla nowej pozycji uczestnika „Opuść listę”. Pozycji właściciela („Zmień nazwę listy”, „Usuń listę”) nikt nie przejrzał, bo reguła „wyzwalacz akcji zapisu ma `writes`” nie była nigdzie zapisana. Okna blokowały zapis tylko przyciskiem w środku (`ConfirmDialog`, `RenameSheet`: `Button writes`).

Dlaczego testy nie złapały: testy offline T-063 sprawdzały przyciski zapisu (w tym te w oknach), a T-094 tylko menu uczestnika. Nie było testu offline menu właściciela.

Inne wystąpienia: `MoreMenu` jest używane tylko na SC-06. Pozostałe wyzwalacze okien i formularzy zapisu mają już `writes` (SC-05 „+ Nowa lista”, SC-07 `LeaveList`, `Members`, `ParticipantsScreen`, SC-09 `DeleteAccount`). Edycja pozycji (`ItemRow`) jest nieaktywna bez połączenia od T-063.

Decyzja AC2: „Zmień nazwę listy” też dostaje `writes`. Otwiera arkusz, którego jedynym celem jest zapis (`PATCH`), tak samo jak SC-05 „+ Nowa lista” otwiera formularz i ma `writes`. Reguła w `web.md` → „Konwencje”.

Zmiany: `ListScreen.tsx` (`OwnerMenu`: `writes: true` dla obu pozycji), `ListScreen.test.tsx` (test offline dla obu pozycji), `docs/architecture/layers/web.md` („Konwencje”, historia zmian).

## Evidence

Red: `SC-06 Lista > menu „Więcej opcji” > makes the owner's „Usuń listę” inactive without a connection and opens nothing (T-063)` oraz ten sam test dla „Zmień nazwę listy”: oba padają na `expect(item).toHaveAttribute("aria-disabled", "true")` (atrybutu brak). W tym samym DOM `Dodaj pozycję` ma `aria-disabled="true"`, więc stan offline działa. `Tests 2 failed | 18 skipped`.

Green: `pnpm vitest run --project web src/screens/SC-06-lista`: `Test Files 9 passed`, `Tests 109 passed`.

Pełne sprawdzenie: `pnpm check` exit 0 (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, `Test Files 154 passed`, `Tests 1247 passed`, test:mobile). `pnpm build` exit 0.

## Prevention

Reguła w `web.md` (AC2), propozycja z przeglądu zaakceptowana przez właściciela 2026-11-06.

<!-- QA rounds are appended below by /qa-task -->
