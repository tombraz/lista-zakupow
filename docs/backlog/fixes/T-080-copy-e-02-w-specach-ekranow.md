---
id: T-080
title: "Copy E-02 w specyfikacjach ekranów: dopisać zatwierdzone teksty, zatwierdzić brakujące"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Tabele Copy w `docs/design/screens/SC-02`, `SC-05`, `SC-06`, `SC-07` zawierają teksty zatwierdzone w T-058 i T-060. — verified by: przegląd dokumentów
- [x] AC2: Właściciel zatwierdził albo zmienił pięć tekstów z listy; zatwierdzone są w Copy SC-03, SC-07 i w `design-system.md` (OfflineBanner), a zmienione są poprawione w kodzie i testach. — verified by: przegląd dokumentów + testy web zielone
- [x] AC3: No regression in: testy komponentów SC-03, SC-07 i OfflineBanner.

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

Copy zatwierdzane w trakcie taska (w AC albo w odpowiedzi właściciela) zostawało tylko w pliku taska. Proces nie miał kroku, który przenosi je do `docs/design/`, a implementujący dopisywali brakujące teksty błędów wzorem istniejących i nie pytali właściciela. Testy tego nie wyłapały, bo testy komponentów sprawdzają tekst w kodzie, a nie jego zgodność z tabelą Copy. Takiego sprawdzenia nie ma żaden test.

Inne wystąpienia: inne teksty błędów spoza Copy z wcześniejszych epików (np. `loadError` w SC-05, SC-06 i SC-07, błędy zapisu SC-05, SC-06 i SC-09, SC-01 i SC-02 `otherwise`, „Nie udało się utworzyć linku” i „…unieważnić linku” w SC-07). Nie było ich w zgłoszeniu P6, więc zostają poza tym taskiem. Opisuje je sekcja Prevention.

## Evidence

- Właściciel zatwierdził 2026-11-04 (w sesji `/fix`) bez zmian wszystkie pięć tekstów: SC-07 „Nie udało się opuścić listy. Spróbuj ponownie.”, SC-03 „Wpisz poprawny adres e-mail”, „Nie udało się wysłać linku. Spróbuj ponownie.”, „Nie udało się zapisać hasła. Spróbuj ponownie.” oraz OfflineBanner „Połączenie przywrócone.”. Kod i testy się nie zmieniają.
- Dopisane wiersze Copy:
  - SC-02 `invalid.hiddenChars`, SC-05 `invalid.hiddenChars`, SC-06 `invalid.hiddenChars` (T-060);
  - SC-07 `remove.error` (T-058) i `leave.error`;
  - SC-03 `step1.email.invalid`, `step1.error` i `step2.error`;
  - `design-system.md` OfflineBanner „Powrót sieci”;
  - wpis w `design-decisions.md`.
- Komentarze w `apps/web/src/screens/SC-07-uczestnicy/messages.ts` wskazują teraz klucze Copy zamiast „spoza tabeli Copy”.
- Test odtwarzający: brak, bo to zmiana dokumentów bez zmiany zachowania (TDD plan: istniejące testy). `pnpm vitest run --project web`: 36 plików i 327 testów przechodzi. `pnpm typecheck`, `pnpm lint` i `pnpm format:check` są czyste.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
