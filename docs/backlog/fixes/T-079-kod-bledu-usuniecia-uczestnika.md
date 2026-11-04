---
id: T-079
title: "SC-07: błąd usunięcia uczestnika pokazuje tekst według kodu błędu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
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

T-058 (e76d67d) zapisywał w `useRemoveParticipant` tylko `person.id` nieudanej próby, a `Members.tsx` wstawiał stały `messages.remove.failed` — kod błędu ginął w `onError`, więc ominięto `errorText` (CODING_STANDARDS.md:35). Testy T-058 sprawdzały tylko błąd 500 i ponowienie po zerwanym połączeniu; ten drugi utrwalał wręcz ogólny tekst dla błędu `network`, więc nic nie pilnowało mapowania kodu.

Poprawka: hook pamięta `{ userId, code }` i zwraca `error(person)` = `removeErrorText(code)` (`messages.ts`, przez `errorText`, jak `leaveErrorText`). `rate_limited`: trasa `DELETE …/members/:userId` nie zwraca 429 (`api.md:44`), a `errorText` nie ma dla niego wspólnego tekstu, więc trafia do tekstu domyślnego „Nie udało się usunąć. Spróbuj ponownie.” — tak samo jak opuszczenie listy. Własnego tekstu dla 429 nie dodano (brak copy i brak takiej odpowiedzi API).

Inne wystąpienia: brak — pozostałe hooki zapisu web (`useCheckItem`, `useEditItem`, `useInvitations`, `useLeaveList`, SC-01…SC-09) przekazują kod do `errorText`.

## Evidence

- Red: `ParticipantsScreen.remove.test.tsx` › „SC-07 removing a participant fails › shows the connection text when the request fails on the network” — `Unable to find an element with the text: Brak połączenia. Sprawdź internet i spróbuj ponownie.` (dialog pokazywał „Nie udało się usunąć. Spróbuj ponownie.”).
- Green: ten sam test przechodzi. Zaktualizowane oczekiwanie w „removes the row without an error when the retry after a lost response gets 404” (pierwsza próba to błąd sieci → teraz tekst o połączeniu; ponowienie z 404 nadal kończy się sukcesem bez błędu).
- `pnpm test`: 151 plików, 1184 testy — pass. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — pass.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Zakres: 9520ed9. `pnpm test` 151 plików / 1184 testy — pass; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — pass; `pnpm vitest run --project web SC-07` 52/52 — pass; `design-check --scan SC-07-uczestnicy` — 0 hard-coded.

Kryteria:
- AC1 — pass. Błąd sieci: test „shows the connection text when the request fails on the network” sprawdza tekst wspólny z `errorText` (`COMMON.network`) i brak ogólnego. 429 `rate_limited`: sprawdzone tymczasowym testem QA (MSW `apiError(429, { code: "rate_limited" })`) — dialog pokazuje „Nie udało się usunąć. Spróbuj ponownie.”, czyli to, co `errorText` daje dla tego kodu (brak wspólnego tekstu dla `rate_limited`; trasa i tak nie zwraca 429, `api.md:44`). Tekst idzie przez `removeErrorText` → `errorText`, jak `leaveErrorText`.
- AC2 — pass. Pozostałe testy T-058 zielone; ponowienie po 404 po błędzie sieci kończy się sukcesem bez błędu.

Spot-check: `error()` z kodem zastąpionym stałym `"internal"` → 2 testy czerwone (nowy test i test ponowienia po 404); przywrócone, `git status` czysty. Root cause wyjaśnia, czemu testy T-058 nie złapały błędu (sprawdzały tylko 500, a test zerwanego połączenia utrwalał ogólny tekst). Red evidence obecne.

Eksploracja (tymczasowy test, usunięty): błąd sieci dla Tomka, potem „Anuluj” i usunięcie Oli — dialog Oli bez tekstu błędu, wiersz Oli znika, brak resztek błędu.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Testy | Wiersz planu TDD „429 / błąd sieci” pokryty w repozytorium tylko dla błędu sieci; przypadek 429 nie ma testu. | `ParticipantsScreen.remove.test.tsx` — brak testu z `apiError(429, …)`; QA sprawdziło 429 testem tymczasowym (pass). | Test 429 → tekst domyślny usuwania (albo zawężenie planu do błędu sieci, skoro trasa nie zwraca 429). |
| 2 | note | Copy | `COMMON` w `errorText.ts` ma tylko `network`; `rate_limited` wszędzie spada do tekstu domyślnego ekranu. | `apps/web/src/errorText.ts:7-9` | Ewentualnie wspólny tekst dla `rate_limited` z tabeli „Copy” (decyzja projektowa). |
