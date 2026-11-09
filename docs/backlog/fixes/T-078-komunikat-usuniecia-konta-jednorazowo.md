---
id: T-078
title: "SC-01: „Konto zostało usunięte.” pokazane raz, nie przy każdym późniejszym przekierowaniu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given komunikat po usunięciu konta już pokazany, when wejście na chroniony adres, then SC-01 bez tego komunikatu, z zachowanym `from`. — verified by: test ekranu/trasy
- [x] AC2: No regression in: T-062 (komunikat po usunięciu), T-018 (wygasła sesja na SC-01), komunikat po resecie hasła.

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

Od T-062 (0c44e62) `endSession("accountDeleted")` zapisuje powód w cache zapytań (`SESSION_END_KEY`), a `RequireSession` czyta go przy każdym przekierowaniu anonima; usuwało go tylko ustawienie sesji przy logowaniu (`useSetSession`). Powód nie był więc jednorazowy: każde późniejsze wejście na chroniony adres w tej karcie (nawigacja w aplikacji, przycisk wstecz) znów dawało SC-01 z „Konto zostało usunięte.” i bez `from`. Testy tego nie wykryły, bo test T-062 po usunięciu sprawdzał tylko ścieżkę `/logowanie` po przejściu na `/listy`, a nie stan wejścia (`accountDeleted` kontra `from`).

**Poprawka:** `useSessionEnd` (`apps/web/src/session/useSession.ts`) zużywa powód — usuwa go z cache w efekcie po renderze, który zbudował przekierowanie (efekt, nie render: podwójny render StrictMode zgubiłby komunikat). Komunikat na SC-01 zostaje, bo jest w `location.state`. **Inne wystąpienia:** brak — inne komunikaty wejścia (reset hasła, zaproszenie) idą tylko przez `location.state`, który jest jednorazowy z natury.

## Evidence

- Test: `apps/web/src/session/sessionEnded.test.tsx` › „after the account was deleted › shows the deletion message once; a later protected address leads to plain SC-01 with `from` (AC1)”.
- Przed poprawką: czerwony — `AssertionError: expected { accountDeleted: true } to deeply equal { from: '/listy' }`.
- Po poprawce: zielony; `pnpm check` (format, lint, typy, depcruise, backlog, testy) exit 0 — 151 plików / 1183 testy web+api, mobile 10/10; `pnpm build` bez błędów. Regresja: `AccountScreen.delete.test.tsx` (T-062), `sessionEnded.test.tsx` (T-018), `SignInScreen.test.tsx` (komunikat po resecie) zielone.

## Prevention

**Co by temu zapobiegło:** jedna zasada dla komunikatu po końcu sesji i test drugiego wejścia na chroniony adres, który sprawdza stan wejścia (`from`), a nie samą ścieżkę. Zrobione (zaakceptowane przez użytkownika): wpis w „Pułapkach” `docs/architecture/layers/web.md` (przegląd E-02, C12) — komunikat tylko w `location.state`, powód poza nim zużywany przy pierwszym przekierowaniu (efekt, nie render). Niezastosowane: `StrictMode` w `renderApp` (uwaga QA #1) — do ewentualnego zadania przez `/plan-backlog`.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Kryteria:

- **AC1 — pass.** Test `sessionEnded.test.tsx` › „after the account was deleted…” sprawdza komunikat, `location.state` `{ accountDeleted: true }`, a po wejściu na `/listy` SC-01 z `{ from: "/listy" }`. Spot-check: bez `removeQueries` w `useSessionEnd` test czerwony (`expected { accountDeleted: true } to deeply equal { from: '/listy' }`), po przywróceniu zielony. Dodatkowy tymczasowy test QA (usunięty) w `StrictMode` z historią `/listy` → `/konto`: komunikat zostaje na SC-01 po podwójnym renderze i efektach; przycisk wstecz → SC-01 bez komunikatu, z `from: "/listy"`.
- **AC2 — pass.** `pnpm check` exit 0 (format, lint, typy, jscpd, depcruise, design-check, backlog, workflow, 151 plików / 1183 testy web+api, mobile 10/10). Zielone m.in. `AccountScreen.delete.test.tsx` (T-062), `sessionEnded.test.tsx` (T-018, 401, wylogowanie w innej karcie), `SignInScreen.test.tsx` (reset hasła).

Przegląd: zmiana minimalna (14 linii w `useSession.ts`), zgodna z opisaną przyczyną; komentarz wyjaśnia wybór efektu zamiast renderu. Root cause wyjaśnia, czemu test T-062 tego nie złapał. Brak zmian UI, brak nowych powierzchni ataku (`threats: []`). Odświeżenie strony: cache znika, komunikat zostaje tylko z `history.state` SC-01 — zgodnie z oczekiwaniem.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | Testy | `renderApp` nie owija aplikacji w `StrictMode`, choć `main.tsx` go używa; zachowanie zależne od efektów (jak ta poprawka) sprawdzono w StrictMode tylko ręcznie przez QA. | `apps/web/test/render.tsx:38`, `apps/web/src/main.tsx:15` | Rozważyć `StrictMode` w `renderApp`, by testy odpowiadały uruchomieniu w przeglądarce. |
| 2 | note | E2E | Nie uruchomiono `j01-usuniecie-konta.spec.ts` (Playwright, wymaga usług); ścieżka pokryta testami RTL. | — | Przebieg e2e w CI. |
