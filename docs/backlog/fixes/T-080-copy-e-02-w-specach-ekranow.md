---
id: T-080
title: "Copy E-02 w specyfikacjach ekranów: dopisać zatwierdzone teksty, zatwierdzić brakujące"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-03, F-14]
threats: []
screens: [SC-02, SC-03, SC-05, SC-06, SC-07]
related_tasks: [T-053, T-054, T-058, T-059, T-060, T-063]
---

# T-080 Copy E-02 w specyfikacjach ekranów

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P6 (minor). QA zgłaszało to w T-053, T-054, T-059 i T-063.

- **Actual:**
  - Copy zatwierdzone w taskach nie zostało dopisane do specyfikacji ekranów: `T-058-usuniecie-uczestnika.md:43` (SC-07) i `T-060-tekst-bez-znakow-sterujacych.md:43` (SC-02, SC-05, SC-06). `docs/design/` nie zmienił się w epiku.
  - Teksty w kodzie bez zatwierdzenia właściciela:
    - `apps/web/src/screens/SC-07-uczestnicy/messages.ts:58` „Nie udało się opuścić listy. Spróbuj ponownie.”
    - `apps/web/src/screens/SC-03-reset-hasla/messages.ts:9` „Wpisz poprawny adres e-mail”
    - `apps/web/src/screens/SC-03-reset-hasla/messages.ts:41` „Nie udało się zapisać hasła. Spróbuj ponownie.”
    - `apps/web/src/screens/SC-03-reset-hasla/messages.ts:48` „Nie udało się wysłać linku. Spróbuj ponownie.”
    - `apps/web/src/components/OfflineBanner/OfflineBanner.tsx:9` „Połączenie przywrócone.”
- **Expected:** każdy tekst widoczny dla użytkownika jest w tabeli Copy swojego ekranu, zatwierdzony przez właściciela.

## Acceptance criteria

- [ ] AC1: Tabele Copy w `docs/design/screens/SC-02`, `SC-05`, `SC-06`, `SC-07` zawierają teksty zatwierdzone w T-058 i T-060. — verified by: przegląd dokumentów
- [ ] AC2: Właściciel zatwierdził albo zmienił pięć tekstów z listy; zatwierdzone są w Copy SC-03, SC-07 i w `design-system.md` (OfflineBanner), a zmienione są poprawione w kodzie i testach. — verified by: przegląd dokumentów + testy web zielone
- [ ] AC3: No regression in: testy komponentów SC-03, SC-07 i OfflineBanner.

## TDD plan

**Seam:** dokumenty; przy zmianie tekstu testy komponentów RTL.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Istniejące testy tekstów po ewentualnej zmianie copy | component | Vitest + RTL | AC2, AC3 |

**Run:** `pnpm vitest run --project web`

## QA plan

- **Regression:** zgodność tekstów w kodzie z tabelami Copy.
- **Edge cases:** —
- **Platforms:** web.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
