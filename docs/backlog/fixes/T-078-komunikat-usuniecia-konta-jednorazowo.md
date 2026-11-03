---
id: T-078
title: "SC-01: „Konto zostało usunięte.” pokazane raz, nie przy każdym późniejszym przekierowaniu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-04]
threats: []
screens: [SC-01, SC-09]
related_tasks: [T-062, T-018]
---

# T-078 SC-01: „Konto zostało usunięte.” pokazane raz

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P2 (minor). QA T-062 #3 zgłosiło to wcześniej; sprawa jest otwarta.

- **Actual:** `endSession` zapisuje powód w `SESSION_END_KEY` (`apps/web/src/session/useSession.ts:26`), a czyści go dopiero logowanie (`:37`). Po usunięciu konta każde wejście na chroniony adres, np. `/listy`, znów pokazuje komunikat na SC-01 i gubi `from`.
- **Expected:** komunikat pojawia się raz, zaraz po usunięciu konta; kolejne przekierowania z chronionego adresu działają jak zwykłe wejście bez sesji (z `from`). Źródło: `docs/design/screens/SC-09-konto.md:48`; `T-062-usuniecie-konta.md:43`.
- **Steps to reproduce:**
  1. Usuń konto: SC-01 pokazuje komunikat.
  2. Wpisz w pasku adresu `/listy`: SC-01 znów pokazuje „Konto zostało usunięte.”, a `from` przepada.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given komunikat po usunięciu konta już pokazany, when wejście na chroniony adres, then SC-01 bez tego komunikatu, z zachowanym `from`. — verified by: test ekranu/trasy
- [ ] AC2: No regression in: T-062 (komunikat po usunięciu), T-018 (wygasła sesja na SC-01), komunikat po resecie hasła.

## TDD plan

**Seam:** router aplikacji z `RequireSession` (RTL + MSW).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Usunięcie konta → SC-01 z komunikatem → wejście na `/listy` → SC-01 bez komunikatu, z `from` | component | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm vitest run --project web session`

## QA plan

- **Regression:** wygasła sesja, wylogowanie, reset hasła.
- **Edge cases:** odświeżenie strony zaraz po usunięciu; przycisk wstecz.
- **Platforms:** web.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Przegląd C12: opisać w `web.md` jeden mechanizm komunikatu po końcu sesji.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
