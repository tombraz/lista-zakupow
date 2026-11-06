---
id: T-103
title: "Teksty okna „Opuść listę” w pliku komunikatów i w Copy SC-06/SC-07; test Copy łapie teksty w .tsx"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-13]
threats: []
screens: [SC-06, SC-07]
related_tasks: [T-094, T-100, T-059]
---

# T-103 Teksty okna „Opuść listę” w pliku komunikatów i w Copy SC-06/SC-07; test Copy łapie teksty w .tsx

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-06-1.md`, S1 (major) i P1 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** T-094 przeniósł teksty okna „Opuść listę” z `SC-07-uczestnicy/messages.ts` do obiektu `leaveMessages` i funkcji `leaveErrorText` w `apps/web/src/lists/LeaveListDialog.tsx:9-19`. Chodzi o `question`, `consequence`, `confirm: "Opuść"`, `cancel` i `otherwise`. Test zgodności Copy z T-100 pomija każdy literał w pliku `.tsx` (`apps/web/test/copyRegister.ts:160-165`, `if (file.endsWith(".tsx")) return [];`). Dlatego tych tekstów nie sprawdza ani dla SC-06, ani dla SC-07. Skutki:
  - Etykieta przycisku „Opuść” nie występuje w żadnej tabeli Copy w `docs/design/`.
  - `leave.confirm` w Copy SC-07 (`docs/design/screens/SC-07-uczestnicy.md:81`) to jedna komórka, a kod dzieli tekst na pytanie i konsekwencję. `remove.confirm.*` jest już podzielone na wiersze.
  - Copy SC-06 ma tylko `menu.leave` i odsyłacz „→ jak na SC-07” (`SC-06-lista.md:26`, `:102`). Nie ma wierszy okna ani `leave.error`.

  Test jest zielony.
- **Expected:**
  - Teksty ekranu są w plikach komunikatów (`docs/architecture/layers/web.md:76`).
  - Każdy widoczny tekst ma wiersz Copy każdego ekranu, który go pokazuje (`web.md:102-103`).
  - Test zgodności nie daje się obejść przez położenie tekstu w `.tsx`.

  Źródło: `web.md:76`, `:102`, `:103`; T-100 AC1.
- **Steps to reproduce:**
  1. `grep -rn "Opuść\b" docs/design` nie zwraca etykiety przycisku.
  2. Zmienić `confirm: "Opuść"` w `LeaveListDialog.tsx` na dowolny tekst i uruchomić `pnpm vitest run --project web copyRegister`: test przechodzi.
- **Environment:** lokalnie, commit `120e478`.
- **Evidence:** `docs/reviews/E-02-2026-11-06-1.md`, S1 i P1.

## Acceptance criteria

- [ ] AC1: Given teksty okna „Opuść listę”, then są w pliku `.ts` modułu `lists/` (np. `lists/leaveList.ts`, wzorem `lists/listName.ts`), a `LeaveListDialog.tsx` tylko je importuje. — verified by: przegląd QA
- [ ] AC2: Given Copy SC-07 i SC-06, then każdy tekst okna ma tam wiersz zatwierdzony przez właściciela, z datą i ID taska: pytanie, konsekwencja, etykieta „Opuść”, „Anuluj” (albo wiersz w Copy ConfirmDialog w `design-system.md`) i `leave.error`. Tekstów brakujących w specyfikacji nie wymyślać, tylko zapytać właściciela (`web.md:103`). — verified by: test zgodności Copy (`copyRegister.test.ts`)
- [ ] AC3: Given plik `.tsx` poza `screens/`, który eksportuje obiekt tekstów (albo tekst, który test uznałby za tekst interfejsu), when uruchamia się test zgodności Copy, then test jest czerwony z komunikatem wskazującym plik. Test ma fixture tego przypadku, a zakres opisany w `web.md:102` i w nagłówku testu jest z nim zgodny. — verified by: test jednostkowy `copyRegister` z fixture
- [ ] AC4: Given zmiana dowolnego tekstu okna „Opuść listę” w kodzie, when uruchamia się test zgodności, then test jest czerwony. — verified by: test zgodności Copy (sprawdzone w Evidence ręczną zmianą)
- [ ] AC5: No regression in: T-094 (SC-06: menu uczestnika i wyjście), T-059 (wyjście z SC-07), T-100 (test zgodności Copy), `ListScreen.leave.test.tsx`, `ParticipantsScreen.*.test.tsx`.

## TDD plan

**Seam:** test zgodności Copy (`apps/web/src/screens/copyRegister.test.ts`, logika w `apps/web/test/copyRegister.ts`) i ekrany SC-06, SC-07.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | fixture: `.tsx` poza `screens/` eksportuje obiekt tekstów → błąd ze wskazaniem pliku | unit | Vitest | AC3 |
| 2 | test zgodności na repo po przeniesieniu tekstów: czerwony, dopóki Copy SC-06 i SC-07 nie ma wierszy okna | unit | Vitest | AC2, AC4 |
| 3 | istniejące testy wyjścia z SC-06 i SC-07 bez zmian | component | Vitest + RTL + MSW | AC5 |

**Run:** `pnpm vitest run --project web`

## QA plan

- **Regression:** SC-06 menu uczestnika → „Opuść listę” → okno → „Opuść” / „Anuluj”; SC-07 „Opuść listę”; błąd serwera w oknie (`leave.error`).
- **Edge cases:** tekst w `.tsx` innego wspólnego modułu (`lists/ListNameField.tsx`, `components/`); dopisek ` (zatwierdzone …)` w komórce Copy.
- **Platforms:** web (testy komponentów); E2E `sc07-uczestnicy.spec.ts` bez zmian.

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

Propozycja z przeglądu: AC3 (test Copy zgłasza teksty w `.tsx`). Zaakceptowana przez właściciela 2026-11-06 razem z tym zadaniem.

<!-- QA rounds are appended below by /qa-task -->
