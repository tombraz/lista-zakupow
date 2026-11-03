---
id: T-071
title: "SC-03 i SC-01: komunikaty sukcesu ogłaszane czytnikowi ekranu (stały region status)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-03, F-04]
threats: []
screens: [SC-01, SC-03]
related_tasks: [T-053, T-054, T-062]
---

# T-071 SC-03 i SC-01: komunikaty sukcesu ogłaszane czytnikowi ekranu (stały region status)

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, S1 (major).

- **Actual:** `InlineAlert` z `role="status"` montuje się warunkowo, razem z treścią. Region live wstawiony do drzewa już z tekstem zwykle nie jest ogłaszany (NVDA/JAWS + Chrome). Dotyczy to:
  - „wysłaliśmy link” na SC-03 (`apps/web/src/screens/SC-03-reset-hasla/RequestLinkStep.tsx:28-30`); ponowne wysłanie z tym samym adresem nie zmienia treści, więc nic nie jest ogłaszane;
  - „Hasło zmienione…” i „Konto zostało usunięte.” na SC-01 (`apps/web/src/screens/SC-01-logowanie/SignInScreen.tsx:36-41`); fokus idzie od razu na pole „E-mail”.
- **Expected:** komunikat sukcesu jest ogłaszany (`role="status"`), a fokus zostaje tam, gdzie mówi spec. Źródło: WCAG 4.1.3; `docs/design/screens/SC-03-reset-hasla.md:79`; tabela „Build” w `.claude/skills/brd-to-design/references/accessibility.md`.
- **Steps to reproduce:**
  1. Na SC-03 wpisz e-mail i kliknij „Wyślij link” z włączonym czytnikiem ekranu: komunikat nie jest odczytany.
  2. Wyślij ponownie ten sam adres: nadal nic.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.
- **Evidence:** poprawny wzorzec w tym samym epiku: `apps/web/src/components/OfflineBanner/OfflineBanner.tsx:13-25` (region jest zawsze w drzewie).

## Acceptance criteria

- [ ] AC1: Given SC-03 krok 1, when „Wyślij link” kończy się sukcesem (także drugi raz z tym samym adresem), then tekst trafia do regionu `role="status"`, który był w drzewie przed zdarzeniem; fokus zostaje na przycisku. — verified by: test komponentu
- [ ] AC2: Given wejście na SC-01 po resecie hasła albo po usunięciu konta, then komunikat jest w regionie `role="status"` obecnym w drzewie przed wpisaniem tekstu (albo jest ogłaszany innym udokumentowanym sposobem, który działa przy fokusie na polu e-mail). — verified by: test komponentu
- [ ] AC3: Given `eslint.config.js`, then `no-restricted-syntax` w `apps/web/src` odrzuca `InlineAlert` z `tone="success"` montowany warunkowo (`cond && <InlineAlert tone="success">`, operator `?:`), z komunikatem odsyłającym do `web.md`, „Pułapki”. Wyjątki tylko przez `eslint.config.js`, nie komentarzem. — verified by: `pnpm lint` zielony po poprawce; kontrola ręczna: przywrócony warunkowy alert daje błąd lintu (Evidence), zmiana cofnięta
- [ ] AC4: No regression in: błąd logowania na SC-01 (`role="alert"`, fokus na alercie), zaproszenie na SC-01, axe w E2E.

## TDD plan

**Seam:** ekran przez React Testing Library (MSW).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Region `role="status"` istnieje przed wysłaniem i dostaje tekst po sukcesie; drugie wysłanie odświeża ogłoszenie | component | Vitest + RTL | AC1 |
| 2 | SC-01 z `EntryState` po resecie / usunięciu konta: region status istniał przed tekstem | component | Vitest + RTL | AC2 |

**Run:** `pnpm vitest run --project web SC-03 SC-01`

## QA plan

- **Regression:** reset hasła (T-053, T-054), usunięcie konta (T-062), logowanie z zaproszeniem.
- **Edge cases:** dwa wysłania z rzędu, zmiana adresu między wysłaniami, 200% tekstu.
- **Platforms:** Chrome + NVDA albo VoiceOver (ręcznie), web 390 × 844.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Zaakceptowane przez właściciela 2026-11-02: linia w `web.md`, „Pułapki” (dodana przy przeglądzie) i lint z AC3 (w tym tasku, bo przed poprawką padałby na obecnym kodzie).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
