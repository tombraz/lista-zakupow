---
id: T-096
title: "Copy SC-09 i SC-03 dla brakujących tekstów; UAT E-02 aktualny"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-03, F-16]
threats: []
screens: [SC-03, SC-09]
related_tasks: [T-054, T-060, T-061, T-080]
---

# T-096 Copy SC-09 i SC-03 dla brakujących tekstów; UAT E-02 aktualny

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, P3 i P6 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - „Usuń niewidoczne lub specjalne znaki.” pod polem „Imię” na SC-09 (`apps/web/src/session/personName.ts:7`, `SC-09-konto/NameForm.tsx:134`) nie ma wpisu w Copy `docs/design/screens/SC-09-konto.md:57-76`. SC-02, SC-05 i SC-06 ten wpis mają.
  - „Hasło może mieć najwyżej 128 znaków” na SC-03, krok 2 (`apps/web/src/screens/SC-03-reset-hasla/messages.ts:24`) nie ma wpisu w `SC-03-reset-hasla.md:61-78`.
  - `docs/backlog/E-02-konto-i-uczestnicy/UAT.md:31` podaje T-070–T-072, T-074 i T-076–T-082 jako `todo` (wszystkie są `done`), a `:3` odsyła do przeglądu z werdyktem `fail` z 2026-11-02.
- **Expected:** każdy tekst widoczny dla użytkownika ma wpis w tabeli Copy swojego ekranu (cel T-080); UAT pokazuje stan na dziś.

## Acceptance criteria

- [ ] AC1: Copy SC-09 ma `name.invalid.hiddenChars` (lub klucz zgodny z SC-02) z dopiskiem „zatwierdzone <data>, T-060”; Copy SC-03 ma tekst limitu 128 znaków. Teksty zatwierdza właściciel przed wpisem. — verified by: przegląd QA (porównanie `messages.ts` z tabelami Copy SC-03 i SC-09)
- [ ] AC2: `UAT.md` podaje aktualne statusy poprawek i odsyła do najnowszego przeglądu (`E-02-2026-11-04-1.md`) oraz otwartych zadań z niego. — verified by: przegląd QA
- [ ] AC3: No regression in: teksty w kodzie bez zmian (zmienia się tylko dokumentacja).

## TDD plan

Zadanie dokumentacyjne, bez testu automatycznego.

## QA plan

- **Regression:** brak zmian w kodzie (`git diff --stat` tylko w `docs/`).
- **Edge cases:** inne teksty SC-03 i SC-09 z `messages.ts` bez wpisu w Copy — wymienić w Evidence.
- **Platforms:** —

## Root cause

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
