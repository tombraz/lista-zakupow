---
id: T-107
title: "Test Copy: jednowyrazowe teksty w atrybutach JSX (`aria-label`, `title`, `alt`, `placeholder`) w `.tsx` modułu wspólnego"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-106]
layers: [web]
requirements: []
threats: []
screens: []
related_tasks: [T-100, T-103, T-106]
---

# T-107 Test Copy: jednowyrazowe teksty w atrybutach JSX w `.tsx` modułu wspólnego

## Report

Źródło: QA T-106, runda 1, uwaga minor #2 (właściciel 2026-11-06: osobny task). Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-107-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** `sharedTsxTexts()` w `apps/web/test/copyRegister.ts` zgłasza każdy tekst JSX z literą (T-106), ale literał w atrybucie JSX nadal przechodzi przez `looksLikeText`. Dlatego jednowyrazowy tekst bez polskiej litery w atrybucie dostępności (`aria-label="Zamknij"`, `title="Menu"`) w `.tsx` modułu wspólnego nie jest zgłaszany i omija rejestr Copy. Dziś w `components/` takich atrybutów nie ma (grep QA).
- **Expected:** atrybuty, które trafiają do użytkownika albo do czytnika ekranu (`aria-label`, `aria-description`, `title`, `alt`, `placeholder`), są traktowane jak tekst JSX: każda wartość z literą jest błędem ze wskazaniem pliku. Inne atrybuty (`className`, `type`, `role`, `id`) nie są tekstem.
- **Steps to reproduce:** w `components/Modal/Modal.tsx` (albo innym `.tsx` modułu wspólnego) dopisać `<span aria-label="Zamknij" />` i uruchomić `pnpm vitest run --project web copyRegister`: test przechodzi.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-106 (`f82e372`).

## Acceptance criteria

- [ ] AC1: Given plik `.tsx` modułu wspólnego (poza `screens/`) z atrybutem `aria-label`, `aria-description`, `title`, `alt` albo `placeholder`, którego wartość to literał z literą (także jednowyrazowy, bez polskiej litery), when uruchamia się test zgodności Copy, then test jest czerwony ze wskazaniem pliku i tekstu. — verified by: test jednostkowy `copyRegister` z fixture
- [ ] AC2: Given atrybuty niebędące tekstem (`className`, `type`, `role`, `id`, `data-*`), then nie są zgłaszane. — verified by: ten sam fixture
- [ ] AC3: Zakres w nagłówku `copyRegister.test.ts` i w `web.md` („Pułapki”) jest zgodny z testem.
- [ ] AC4: No regression in: test zgodności Copy na repo (zielony), T-100, T-103, T-106.

## Prevention

Domknięcie klasy z T-103/T-106: tekst w `.tsx` modułu wspólnego nie może ominąć rejestru Copy przez położenie w atrybucie.

<!-- QA rounds are appended below by /qa-task -->
