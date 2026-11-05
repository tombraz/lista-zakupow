---
id: T-097
title: "SC-07: zamknięcie okna i fokus po zniknięciu osoby w efekcie, nie w renderze"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-13]
threats: []
screens: [SC-07]
related_tasks: [T-058, T-079]
---

# T-097 SC-07: zamknięcie okna i fokus po zniknięciu osoby w efekcie, nie w renderze

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-04-1.md`, S3 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** gdy osoba z otwartego okna „Usunąć …?” znika (odeszła, usunięta w innej karcie), `Members` w trakcie renderu woła `setConfirming(null)` i `focusAfter(confirming)`. `focusAfter` mutuje zapamiętaną kolejność (`orders.current`) i przenosi fokus (`apps/web/src/screens/SC-07-uczestnicy/Members.tsx:38-41`). W `StrictMode` (`apps/web/src/main.tsx:15`) render wykonuje się dwa razy. Druga kopia może już nie znaleźć kolejności i przenieść fokus na nagłówek zamiast na następny wiersz. To ryzyko dla WCAG 2.4.3, w przeglądarce niesprawdzone. Testy renderują bez `StrictMode`.
- **Expected:** efekty uboczne (fokus, mutacja refów) tylko w efekcie. Źródło: `docs/architecture/layers/web.md`, „Pułapki” (StrictMode: „w efekcie, nie w renderze”); T-058 (fokus po usunięciu).

## Acceptance criteria

- [x] AC1: Given SC-07 właściciela w `StrictMode` z otwartym oknem usunięcia osoby B, when B znika z listy (zdarzenie na żywo), then okno się zamyka, a fokus trafia na wiersz po B (albo na nagłówek, gdy B był ostatni) — tak samo jak bez `StrictMode`. Test czerwony przed poprawką albo, jeśli nie da się go zaczerwienić, opis w Evidence, dlaczego. — verified by: test komponentu renderowany w `<StrictMode>`
- [x] AC2: `Members.tsx` nie wywołuje `setState` ani funkcji fokusu w ciele renderu. — verified by: przegląd QA
- [x] AC3: No regression in: T-058 (fokus po usunięciu, Anuluj), T-079, `ParticipantsScreen.*.test.tsx`.

## TDD plan

**Seam:** ekran SC-07 z MSW i sztucznym zdarzeniem `members.changed`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | osoba znika przy otwartym oknie, render w StrictMode → fokus na następny wiersz | component | Vitest + RTL + MSW | AC1 |
| 2 | znika ostatni uczestnik przy otwartym oknie, StrictMode → fokus na nagłówek | component | Vitest + RTL + MSW | AC1 (QA edge case) |
| 3 | znika inna osoba niż ta w oknie, StrictMode → okno zostaje, fokus na „Anuluj” | component | Vitest + RTL + MSW | AC1 (QA edge case) |

**Run:** `pnpm vitest run --project web SC-07`

## QA plan

- **Regression:** T-058, T-059, T-079.
- **Edge cases:** znika ostatni uczestnik; znika osoba inna niż ta w oknie (okno zostaje).
- **Platforms:** web.

## Root cause

`Members` wykrywał zniknięcie osoby z otwartego okna w ciele renderu i tam wywoływał `setConfirming(null)` oraz `focusAfter(confirming)`. `focusAfter` usuwał zapamiętaną kolejność z refa (`orders.current.delete`) i zlecał przeniesienie fokusu — skutek uboczny w renderze, wbrew `web.md` „Pułapki” (StrictMode). Drugie wywołanie `focusAfter` dla tej samej osoby nie znajdowało już kolejności i celowało w nagłówek.

## Evidence

Poprawka:
- `apps/web/src/screens/SC-07-uczestnicy/Members.tsx`: w renderze tylko wartość pochodna `vanished` (osoba z okna, której nie ma już wśród uczestników); zamknięcie okna i `focusAfter` w `useEffect`. Reguła `react-hooks/set-state-in-effect` (error) wyłączona jednym `eslint-disable-next-line` z uzasadnieniem: zmiana przychodzi z danych na żywo, nie ma handlera zdarzenia, w którym można zamknąć okno. `CODING_STANDARDS.md` zakazuje takich komentarzy tylko dla `no-restricted-*` i `eslint-comments/*`; wzorzec jak w `Modal.tsx`.
- `apps/web/src/screens/SC-07-uczestnicy/useRemovalFocus.ts`: `focusAfter` jest idempotentne (nie usuwa kolejności z `orders`); powtórne wywołanie celuje w ten sam wiersz. Kolejność nadpisuje następne `remember` (otwarcie okna, potwierdzenie); mapa ma najwyżej 20 wpisów.
- `apps/web/test/render.tsx`: `renderApp(entry, { strict: true })` renderuje w `StrictMode` (opcja `reactStrictMode` z RTL 16), jak `main.tsx`.

Testy (`ParticipantsScreen.remove.test.tsx`, „SC-07 removing a participant while things change”):
1. „moves focus to the next row in StrictMode when that participant left meanwhile” — **nie dało się zaczerwienić na starym kodzie** (AC1 dopuszcza opis): na React 19.3.1 aktualizacja stanu w renderze (`setConfirming(null)`) sprawia, że React porzuca bieżący render i od razu renderuje ponownie z `confirming = null`, zanim wykona drugie wywołanie StrictMode. Sprawdzone tymczasowym logiem w `Members`: przy włączonym StrictMode render z dwoma uczestnikami szedł dwa razy (`RENDER Tomek 2` ×2), a gałąź zniknięcia — raz (`RENDER Tomek 1`, `FOCUSAFTER` ×1); log usunięty. Ryzyko z przeglądu było więc realne co do zasady (skutek uboczny w renderze), ale nieobserwowalne w tej wersji Reacta. Test jest czerwony na błędnej poprawce: pierwsza wersja efektu przekazywała `focusAfter` wartość logiczną zamiast osoby (`confirming && !…`) i test padł z `Received element with focus: <h2 id="members-heading">` — teraz przechodzi.
2. „moves focus to the „Na liście” heading in StrictMode when the last participant left meanwhile” — przechodzi (na starym i nowym kodzie; przypadek brzegowy z QA planu).
3. „keeps another participant's dialog open in StrictMode when someone else left” — przechodzi (na starym i nowym kodzie; przypadek brzegowy z QA planu).

Kryteria:
- AC1: testy 1–2 (render w `<StrictMode>`); okno zamknięte, fokus na „Usuń Ola z listy” / na nagłówku „Na liście (1 z 20)”. Dlaczego bez czerwieni — wyżej.
- AC2: `Members.tsx` nie woła `setState` ani `focusAfter` w ciele renderu — oba tylko w `useEffect` i handlerach. Lint `react-hooks/set-state-in-render` przechodzi.
- AC3: `pnpm vitest run --project web SC-07` — 5 plików, 55 testów zielonych (T-058: fokus po usunięciu, Anuluj/Escape; T-079: tekst błędu sieci; dotychczasowy test bez StrictMode „closes the dialog without an error when that participant left meanwhile”).
- Pełna weryfikacja: `pnpm check` (format:check, lint, typecheck, quality, design-check, backlog-check, workflow-check, test, test:mobile) — exit 0, 154 pliki / 1239 testów; `pnpm build` — exit 0.

Dla QA: zwróć uwagę na `eslint-disable-next-line react-hooks/set-state-in-effect` (alternatywą bez wyłączenia reguły byłaby subskrypcja cache zapytań z `setState` w callbacku — więcej kodu i ryzyko podwójnego `focusAfter` przy własnym usunięciu, bo `dropParticipant` też zmienia cache) oraz na idempotentne `focusAfter`. W przeglądarce niesprawdzone ręcznie.

## Prevention

Propozycja (do decyzji właściciela): testy ekranów, które przenoszą fokus po zmianie danych na żywo, renderować przez `renderApp(…, { strict: true })`, żeby test widział to samo co `main.tsx`. Ten przypadek pokazał, że w React 19 nie każdy skutek uboczny w renderze daje się wykryć podwójnym renderem, więc podstawą zostaje reguła z `web.md` „Pułapki” i lint `react-hooks/set-state-in-render`.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-05)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Prevention / lint | Sekcja „Prevention” i Evidence AC2 opierają ochronę na lincie `react-hooks/set-state-in-render`, ale reguła nie wykrywa starego wzorca (warunkowy `setState` w renderze to wzorzec dopuszczany przez Reacta). | Kod `Members.tsx` sprzed poprawki (`17834ba^`) przywrócony na chwilę: `pnpm exec eslint Members.tsx` → exit 0, brak zgłoszeń; plik przywrócony. | Prevention nie powinna obiecywać ochrony lintem; nawrót tego błędu złapie tylko przegląd kodu (albo własna reguła, np. zakaz wywołań `focus*`/mutacji refów w ciele komponentu). |
| 2 | note | Testy / TDD | Nowe testy StrictMode są zielone na kodzie sprzed poprawki, więc nie odtwarzają błędu. AC1 to dopuszcza, a Evidence uczciwie opisuje dlaczego (React 19 porzuca render po `setState` w renderze). | Stare `Members.tsx` + `useRemovalFocus.ts` z `17834ba^` → `pnpm vitest run --project web SC-07`: 55/55 zielonych; pliki przywrócone. | — (zaakceptowane w ramach AC1). |
| 3 | note | Web / UX | Po zniknięciu osoby okno zamyka się w efekcie, czyli o jeden commit później niż wcześniej. Okno z nieaktualną osobą może więc mignąć przez jedną klatkę. | Przegląd kodu `Members.tsx:40-48`. | Pomijalne. Gdyby było widoczne, można nie renderować okna, gdy `vanished` (`confirming && !vanished`). |
| 4 | note | Weryfikacja | Nie sprawdzono w przeglądarce (dwie karty, odejście na żywo). Odpowiednikiem jest test w jsdom w `StrictMode`, tak jak w `main.tsx`. | — | — |

Sprawdzone:
- `pnpm install --frozen-lockfile`, `pnpm check`: exit 0, web 154 pliki / 1239 testów, mobile 10 testów. `pnpm build`: exit 0.
- AC1 **pass**: testy 1–2 w `<StrictMode>` (`reactStrictMode` z RTL) sprawdzają, że okno jest zamknięte i fokus trafia na „Usuń Ola z listy” albo na nagłówek. Spot-check: po usunięciu `focusAfter(vanished)` z efektu oba testy padają (oraz dotychczasowy „closes the dialog … (members.changed)”). Po przywróceniu `git status` czysty.
- AC2 **pass**: w ciele renderu `Members.tsx` nie ma `setState` ani `focusAfter`, tylko pochodna `vanished`. Wywołania są w `useEffect` i w handlerach. `eslint-disable-next-line react-hooks/set-state-in-effect` jest dozwolony przez `CODING_STANDARDS.md` (zakaz obejmuje tylko `no-restricted-*` i `eslint-comments/*`) i ma uzasadnienie.
- AC3 **pass**: SC-07 55/55, pełny zestaw zielony.
- Przypadki brzegowe: znika ostatni uczestnik (test 2); znika inna osoba, okno zostaje z fokusem na „Anuluj” (test 3). Własne usunięcie: bez optymistycznej zmiany (`useRemoveParticipant`), a `dropParticipant` i `onRemoved` idą w jednym wywołaniu z batchingiem. Efekt `vanished` nie odpala się więc przedwcześnie. Ewentualne podwójne `focusAfter` jest nieszkodliwe dzięki idempotencji.
- `useRemovalFocus`: `orders` bez `delete` ma najwyżej tyle wpisów, ilu jest uczestników (≤ 20). Wpis nadpisuje `remember` przy każdym otwarciu okna.
- Bez zmian UI i tokenów, `threats: []`. Root cause wyjaśnia, dlaczego testy go nie złapały (render bez StrictMode i zachowanie Reacta 19).
