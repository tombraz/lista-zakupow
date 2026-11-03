---
id: T-079
title: "SC-07: błąd usunięcia uczestnika pokazuje tekst według kodu błędu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-14]
threats: []
screens: [SC-07]
related_tasks: [T-058, T-059]
---

# T-079 SC-07: błąd usunięcia uczestnika pokazuje tekst według kodu błędu

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, S9 (minor).

- **Actual:** `useRemoveParticipant` zapamiętuje tylko `person.id` (`apps/web/src/screens/SC-07-uczestnicy/useRemoveParticipant.ts:21`, `:37-39`, `:48`). Każdy błąd, także `network` i `rate_limited`, kończy się ogólnym „Nie udało się usunąć. Spróbuj ponownie.”. `LeaveList` na tym samym ekranie mapuje kod przez `leaveErrorText(code)`.
- **Expected:** klient mapuje `code` na tekst w jednym miejscu, przez `errorText`. Źródło: `CODING_STANDARDS.md:35`; `web.md:30`.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given usunięcie uczestnika kończy się `rate_limited` albo błędem sieci, then przy wierszu osoby pojawia się tekst dla tego kodu (wspólny z `errorText`), a nie ogólny. — verified by: test ekranu (MSW)
- [ ] AC2: No regression in: T-058 (wszystkie AC), ponowienie po 404 jako sukces.

## TDD plan

**Seam:** ekran SC-07 z MSW.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | 429 / błąd sieci → tekst właściwy dla kodu | component | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm vitest run --project web SC-07`

## QA plan

- **Regression:** usunięcie i opuszczenie listy na SC-07.
- **Edge cases:** błąd dla jednej osoby, potem sukces dla innej.
- **Platforms:** web.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
