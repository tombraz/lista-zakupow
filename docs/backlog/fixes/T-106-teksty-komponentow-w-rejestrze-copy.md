---
id: T-106
title: "Teksty komponentów design systemu (`components/*.tsx`) w plikach komunikatów i w rejestrze Copy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-103]
layers: [web]
requirements: []
threats: []
screens: [SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09]
related_tasks: [T-100, T-103]
---

# T-106 Teksty komponentów design systemu (`components/*.tsx`) w plikach komunikatów i w rejestrze Copy

## Report

Źródło: T-103 (decyzja właściciela 2026-11-06: osobny task). Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-106-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** kontrola T-103 (tekst interfejsu w `.tsx` modułu wspólnego = błąd testu Copy) pomija `components/`, bo teksty komponentów nie mają tabeli Copy: `design-system.md` opisuje je w tekście, a test zgodności nie czyta `design-system.md`. Po włączeniu `components/` test zgłasza (stan z commitu T-103):
  - `components/AppBar/AppBar.tsx` · „{…} · Wspólna lista zakupów”
  - `components/AuthPage/AuthPage.tsx` · „{…} · Wspólna lista zakupów”, „Wspólna lista zakupów”, „Regulamin i polityka prywatności”
  - `components/LoadError/LoadError.tsx` · „Spróbuj ponownie”
  - `components/OfflineBanner/OfflineBanner.tsx` · „Brak połączenia. Zmiany nie są zapisywane.”, „Połączenie przywrócone.”
  - `components/PasswordField/PasswordField.tsx` · „Pokaż”
- **Expected:** teksty w plikach komunikatów (`web.md`, „Konwencje”), z wierszem Copy ekranu albo komponentu w `design-system.md` (`web.md`, „Pułapki”, Copy jako rejestr), sprawdzane testem bez listy wyjątków.
- **Steps to reproduce:** w `apps/web/test/copyRegister.ts` (`sharedTsxTexts`) usunąć warunek `!file.startsWith("components/")` i uruchomić `pnpm vitest run --project web copyRegister`.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-103.

## Acceptance criteria

- [ ] AC1: Given komponenty z listy, then ich teksty są w plikach `.ts` (`<nazwa>Messages.ts` albo `messages.ts` komponentu), a `.tsx` je importują. — verified by: test zgodności Copy (kontrola `.tsx` obejmuje `components/`)
- [ ] AC2: Given `design-system.md`, then ma tabelę Copy komponentów (albo ekrany mają wiersze), a test zgodności ją czyta; braki rozstrzyga właściciel (`web.md`: nie wymyślać tekstów). — verified by: `copyRegister.test.ts`
- [ ] AC3: Given plik `.tsx` modułu wspólnego (także `components/` po AC1) z tekstem JSX, który ma literę, ale nie wygląda na polski tekst (np. `<span>Zamknij</span>`), when uruchamia się test zgodności Copy, then test jest czerwony ze wskazaniem pliku. Test ma fixture tego przypadku, a zakres w nagłówku testu i w `web.md` jest z nim zgodny. Źródło: uwaga minor QA T-103, runda 1 (zaakceptowana przez właściciela 2026-11-06). — verified by: test jednostkowy `copyRegister` z fixture
- [ ] AC4: No regression in: testy komponentów `components/`, E2E bez zmian.

## Prevention

Domknięcie zakresu kontroli z T-103 (`components/`) oraz uwagi QA T-103: w `.tsx` modułu wspólnego każdy tekst JSX z literą to błąd, nie tylko ten, który `looksLikeText` uznaje za tekst (AC3).

<!-- QA rounds are appended below by /qa-task -->
