---
id: T-111
title: "Wiersze Copy bez kodu web: rozstrzygnięcie dla każdego z 9 wierszy i kontrola w teście Copy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-109]
layers: [web]
requirements: []
threats: []
screens: [SC-02, SC-03, SC-06, SC-07, SC-08, SC-09]
related_tasks: [T-100, T-108]
---

# T-111 Wiersze Copy bez kodu web: rozstrzygnięcie dla każdego z 9 wierszy i kontrola w teście Copy

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-09-1.md`, P3 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** przy T-108 właściciel zdecydował 2026-11-09, że pełna kontrola odwrotna (wiersz Copy, którego tekstu nie pokazuje kod web) trafi do osobnego zadania. Pomiar dał 9 wierszy w SC-02, SC-03 i SC-06–SC-09 (lista w `docs/backlog/fixes/T-108-wiersz-legal-sc-01-po-copy-komponentow.md`, „Other occurrences”), ale zadania nie utworzono. Sprawdzono dwa wiersze:
  - SC-02 `consent.terms`: kod składa tekst z części (`SC-02-rejestracja/messages.ts:15`).
  - SC-08 `joined`: komunikat pokazuje SC-06 (`SC-06-lista/messages.ts:20`).

  Oba to tekst złożony albo pokazany na innym ekranie, a nie brak w kodzie. Pozostałe wymagają decyzji.
- **Expected:** każdy wiersz Copy ma swój tekst w kodzie albo opisany powód (mail, API, mobile, wiersz-źródło części, tekst pokazany na innym ekranie). Wiersz bez kodu i bez powodu jest błędem testu. Źródło: `web.md:103` (Copy jest pełnym rejestrem tekstów ekranu), decyzja właściciela przy T-108 AC2.
- **Steps to reproduce:** lista 9 wierszy w T-108, „Other occurrences”.
- **Environment:** lokalnie, commit `f0eb4d6`.
- **Evidence:** `docs/reviews/E-02-2026-11-09-1.md`, P3; T-108 AC2.

## Acceptance criteria

- [ ] AC1: Given 9 wierszy z T-108, then każdy ma zapisaną decyzję właściciela. Wiersz usunięty (martwy), dopisek w komórce wskazujący źródło (np. `(mail; T-055)`, `(część consent.terms)`, `(pokazuje SC-06)`) albo błąd kodu z osobnym zadaniem. — verified by: przegląd QA, tabela decyzji w „Root cause”
- [ ] AC2: Given wiersz Copy ekranu, którego tekstu nie ma w tekstach ekranu ani w tekstach z dopiskiem źródła, when uruchamia się test Copy, then test jest czerwony i wskazuje ekran i klucz. — verified by: fikstura w `apps/web/src/screens/copyRegister.test.ts`
- [ ] AC3: Given repo po zmianie, then test Copy repo jest zielony. — verified by: `pnpm vitest run --project web copyRegister`
- [ ] AC4: No regression in: T-100, T-108 (dublet Copy komponentów), T-109.

## TDD plan

**Seam:** `findCopyGaps` z fikstur.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | wiersz Copy bez kodu i bez dopisku → błąd | unit | Vitest | AC2 |
| 2 | wiersz z dopiskiem źródła → brak błędu | unit | Vitest | AC2 |

**Run:** `pnpm vitest run --project web copyRegister`

## QA plan

- **Regression:** Copy SC-01–SC-09, Copy komponentów w `design-system.md`.
- **Edge cases:** wiersz-źródło części (`leave.confirm` i `leave.confirm.question`), tekst z parametrem `{nazwa}`, tekst z maila (T-055), tekst pokazywany na innym ekranie (SC-08 `joined`).
- **Platforms:** web.

## Root cause

<Tabela decyzji dla 9 wierszy.>

## Evidence

<Reproducing test: red failure message, then passing. Full suite and static checks result.>

## Prevention

Kontrola w obu kierunkach w teście Copy (AC2).

<!-- QA rounds are appended below by /qa-task -->
