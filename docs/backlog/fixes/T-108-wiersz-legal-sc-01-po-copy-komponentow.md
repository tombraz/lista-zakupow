---
id: T-108
title: "Wiersz Copy SC-01 `legal` po przeniesieniu tekstu do Copy komponentów; wykrywanie wierszy Copy bez kodu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-106]
layers: [web]
requirements: []
threats: []
screens: [SC-01]
related_tasks: [T-100, T-106]
---

# T-108 Wiersz Copy SC-01 `legal` po przeniesieniu tekstu do Copy komponentów; wykrywanie wierszy Copy bez kodu

## Report

Źródło: QA T-106, runda 1, notatka #3 (właściciel 2026-11-06: osobny task). Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-108-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** po T-106 tekst „Regulamin i polityka prywatności” na SC-01 pochodzi z komponentu (`components/AuthPage/authPageMessages.ts`, Copy komponentów `AuthPage.legal` w `design-system.md`). Wiersz `legal` w Copy SC-01 (`docs/design/screens/SC-01-logowanie.md:75`) nie odpowiada już żadnemu tekstowi kodu SC-01, a nowa sekcja „## Copy” w `design-system.md` mówi, że ekran nie powtarza wierszy komponentów. Test zgodności sprawdza tylko kierunek kod → Copy, więc wiersze Copy bez kodu nie są wykrywane. (SC-09 `legal` jest używany: `screens/SC-09-konto/messages.ts:15`.)
- **Expected:** Copy SC-01 nie dubluje wiersza komponentu: wiersz `legal` usunięty albo oznaczony jako tekst komponentu (np. dopisek „(z Copy komponentów `AuthPage.legal`, T-108)”) — decyzja właściciela. Ocenić, czy test ma wykrywać wiersze Copy, których nie używa żaden kod.
- **Steps to reproduce:** usunąć wiersz `legal` z Copy SC-01 i uruchomić `pnpm vitest run --project web copyRegister`: test przechodzi, czyli wiersz jest zbędny dla kodu.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-106 (`f82e372`).

## Acceptance criteria

- [ ] AC1: Given Copy SC-01, then wiersz `legal` jest usunięty albo oznaczony jako tekst komponentu, zgodnie z decyzją właściciela; reguła z sekcji „## Copy” w `design-system.md` jest z tym spójna. — verified by: przegląd QA
- [ ] AC2: Given wiersz Copy ekranu, którego tekstu nie używa żaden kod web tego ekranu, when uruchamia się test zgodności, then test to zgłasza — albo, jeśli właściciel uzna to za zbyt szerokie (Copy zawiera też teksty spoza kodu web: tematy maili, stany z Layout/States, mobile E-04), decyzja i powód są zapisane w tasku, a kontrola zostaje poza zakresem. Jeśli kontrola wymaga więcej niż jednej sesji, przenieść ją do `/plan-backlog`. — verified by: test jednostkowy `copyRegister` z fixture albo zapis decyzji
- [ ] AC3: No regression in: test zgodności Copy na repo (zielony), T-100, T-106.

## Prevention

Rejestr Copy w obu kierunkach: tekst w kodzie ma wiersz (T-100), a wiersz ma tekst w kodzie albo jawne źródło spoza kodu web.

<!-- QA rounds are appended below by /qa-task -->
