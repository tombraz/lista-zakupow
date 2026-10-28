---
id: T-003
title: Szkielet aplikacji mobilnej
epic: E-01
story: S-01-01
status: in-progress           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-001, T-002]
size: M                # S | M (L must be split)
layers: [mobile, infra]
requirements: [N-01, N-04]
threats: [TH-16, TH-23]
screens: []
---

# T-003 Szkielet aplikacji mobilnej

## Goal

Aplikacja Expo (Android i iOS) uruchamia się, pokazuje stan API i bazy z lokalnego api i używa tokenów z `tokens.ts`. Działają testy ekranów (Jest + RNTL), lint z regułami dostępności RN, flow Maestro na emulatorze Androida w CI i build iOS na symulator. Przewodnik warstwy mobile ma prawdziwe ścieżki i komendy.

## Demo

1. Komenda z przewodnika mobile uruchamia Expo; na emulatorze Androida (i na telefonie w tej samej sieci) aplikacja pokazuje „Wspólna lista zakupów” i „API działa · baza działa”.
2. Po zatrzymaniu api: „Nie można połączyć się z serwerem”.
3. PR zmieniający `apps/mobile/**` uruchamia w CI job mobile: lint, typy, testy, design check, Maestro na emulatorze, build iOS symulatora — `ci-ok` zielony.

## Context

- `docs/architecture/layers/mobile.md` — technologia, testy, zasady bezpieczeństwa, pułapka `10.0.2.2`.
- `docs/architecture/pipeline.md` — job mobile (Maestro na emulatorze, lokalny build Gradle bez EAS, KVM), etap 7 (profile EAS w E-04).
- `docs/design/design-system.md`, „Uwagi platformowe”.
- Depends on: T-001 — `/health/ready`, `packages/tokens` (`tokens.ts`), `packages/shared`; T-002 — `ci.yml` z filtrem ścieżek i `ci-ok`, do którego dochodzi job mobile.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given ekran startowy z podstawionym API (MSW), when API zwraca „gotowe” / „baza niedostępna” / błąd sieci, then ekran pokazuje odpowiedni polski tekst z rolą i etykietą dostępną. — verified by: test ekranu (Jest + RNTL, `getByRole` / `getByText`)
- [ ] AC2: Given lokalne api, when uruchomię flow Maestro na emulatorze Androida, then aplikacja pokazuje „API działa · baza działa”. — verified by: Maestro flow `health.yaml`
- [ ] AC3: Given PR zmieniający `apps/mobile/**` lub `packages/shared/**`, when CI się zakończy, then job mobile (lint z `eslint-plugin-react-native-a11y`, typy, testy, design check, Maestro Android, build iOS symulatora) przeszedł i wchodzi do `ci-ok`; PR bez tych zmian go pomija. — verified by: rung 3, link do przebiegu
- [ ] AC4: Given aplikacja, when sprawdzę wygląd, then wartości kolorów, odstępów i typografii pochodzą wyłącznie z `tokens.ts`; `design-check --scan apps/mobile/src` przechodzi. — verified by: `design-check` w CI
- [ ] AC5: Given `docs/architecture/layers/mobile.md`, when nowa osoba wykona komendy z sekcji „Komendy” (install, start, testy, E2E, build lokalny), then działają; adres API pochodzi z konfiguracji środowiska Expo (emulator: `10.0.2.2`). — verified by: ręczne przejście przez QA
- [ ] SEC1 (TH-23): Given paczka aplikacji i `app.config`, when przeszukam je, then zawierają tylko publiczny adres API, bez kluczy i sekretów; build wydania nie ma menu deweloperskiego. — verified by: test konfiguracji (unit) sprawdzający dozwolone klucze `extra` + przegląd w QA
- [ ] SEC2 (TH-16): Given konfiguracja projektu, when ktoś doda zapis do AsyncStorage pod kluczem związanym z sesją, then lint zgłasza błąd (sesja tylko w `expo-secure-store`). — verified by: reguła `no-restricted-imports` / `no-restricted-syntax` + celowe naruszenie (Evidence)

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- ekran startowy z klientem API podstawionym przez MSW
- aplikacja na emulatorze (Maestro) z prawdziwym lokalnym api
- przebieg CI (job mobile)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | ekran startowy: trzy stany | component | Jest + RNTL + MSW | AC1 |
| 2 | konfiguracja `extra` zawiera tylko `apiUrl` | unit | Jest | SEC1 |
| 3 | flow Maestro: start → tekst stanu | E2E | Maestro | AC2 |
| 4 | job mobile w CI na PR | real run | GitHub Actions | AC3, AC4 |

**Run:** komendy „wszystkie testy warstwy” i „E2E (Maestro)” z przewodnika mobile (ustalane w tym tasku)

**Mocks:** API (MSW) w testach ekranów; moduły natywne bez implementacji w Jest (SecureStore, NetInfo).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** api niedostępne przy starcie i pojawiające się później (ponowienie); brak sieci na telefonie.
- **Design states:** gotowe, baza niedostępna, brak połączenia z serwerem.
- **Platforms / devices:** emulator Androida, prawdziwy telefon z Androidem (development build lub Expo Go, jeśli zgodne), symulator iOS (build z CI lub lokalnie na Macu, jeśli dostępny).
- **Accessibility:** TalkBack czyta tytuł i stan; największy rozmiar tekstu systemowego nie ucina treści; bezpieczne obszary ekranu.
- **Security / privacy:** brak sekretów w `app.config` i paczce; logi aplikacji bez danych osobowych.
- **Regression:** web i api z T-001 działają bez zmian; `ci-ok` dla PR bez zmian mobile.

## Implementation notes

- Expo z expo-router; struktura z przewodnika: `apps/mobile/app/`, `apps/mobile/src/screens/`, `apps/mobile/src/components/`, `apps/mobile/src/api/`.
- Mobile używa Jest (preset Expo), nie Vitest (`testing-strategy.md`).
- W CI emulator Androida wymaga KVM na runnerze Linux; build Gradle lokalnie w jobie, nie przez EAS (limit 15 buildów). Profile EAS i dystrybucja APK — E-04.
- Better Auth Expo i SecureStore przychodzą z logowaniem w E-04; tu tylko reguła lint chroniąca przed sesją w AsyncStorage.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Przebieg 2026-10-28 (implementer, autonomicznie), gałąź `epic/E-01-szkielet-i-wspolna-lista`, Windows 11 + Docker Desktop.

**TDD plan**

| # | Test | Red (przed) | Green (po) |
| --- | --- | --- | --- |
| 1 | `apps/mobile/src/screens/start/StartScreen.test.tsx` (nagłówek z rolą `header`, trzy stany w `Text` z rolą `text` i etykietą „Stan serwera: …”) | stub `return null`: `Unable to find an element with role: header, name: Wspólna lista zakupów`; `Unable to find an element with role: text, name: Stan serwera: API działa · baza działa` (i analogicznie „baza niedostępna”, „Nie można połączyć się z serwerem”) | 4/4 ✔ |
| 1a | (dopisany do planu, edge case z QA planu) ten sam plik, „checks again until the API answers”: pierwszy `/health/ready` to błąd sieci, po 5 s odpowiedź „gotowe” | bez `refetchInterval`: `Unable to find an element with text: API działa · baza działa` | ✔ |
| 2 | `apps/mobile/test/app-config.test.ts`: `extra` = tylko `{ apiUrl }` z `API_URL` (domyślnie `http://10.0.2.2:3000`) | konfiguracja z `extra: { apiUrl: "http://localhost:3000", eas: {…} }`: diff `+ "eas": Object {…}` w obu testach | 2/2 ✔ |
| 2a | (dopisany) ten sam plik: HTTP bez TLS na Androidzie (`android:usesCleartextTraffic`) tylko dla API `http://`, brak dla `https://` | `Expected: "true" Received: undefined` | ✔ |
| 2b | (dopisany) ten sam plik: brak `expo-dev-client` w zależnościach (wydanie bez menu deweloperskiego) | przechodzi od początku (opisuje stan); dowód przeglądowy | ✔ |
| 2c | (dopisany, infra rung 2) `bash scripts/test/mobile.test.sh`: `--dry-run` trzech skryptów porównany z `scripts/test/*.dry-run.txt` | brak skryptów: `FAIL android-emulator --dry-run wypisuje kroki`, `FAIL mobile-e2e …`, `FAIL ios-simulator-build …` | 3× `ok` |
| 2d | (dopisany po przebiegu CI 1) `scripts/test/android-emulator-boot.test.sh` (wołany z `mobile.test.sh`): atrapy `sdkmanager`/`avdmanager`/`adb`/`emulator` w PATH; emulator pada od razu albo wisi, `BOOT_TIMEOUT_S=4` → skrypt kończy się błędem (nie 124) i wypisuje koniec logu emulatora | stary skrypt wisiał na `adb wait-for-device`: `FAIL emulator padł… (exit 124)`, `FAIL emulator wisi… (exit 124)` (limit 60 s testu) | 2× `ok`, ~7 s |
| 3 | `apps/mobile/e2e/health.yaml` (Maestro) | **nieuruchomiony**, zob. „Open question” | — |
| 4 | job mobile w CI na PR | **nieuruchomiony** (wymaga push), zob. „Open question” | — |

**Weryfikacja lokalna (ten przebieg):** `pnpm lint` 0, `pnpm typecheck` 0 (z `@lista/mobile`), `pnpm format:check` 0, `pnpm quality` (jscpd 0 klonów, także `apps/mobile/src`; dependency-cruiser 0 naruszeń), `pnpm design-check` 0 błędów i 0 kolorów na sztywno, `pnpm test` 49 plików / 247 testów ✔, `pnpm test:mobile` 10/10 ✔, `bash scripts/test/mobile.test.sh` 3× ok, `bash scripts/test/protect-main.test.sh` 2× ok, actionlint `1.7.12@sha256:b1934ee5…` exit 0, `pnpm audit --audit-level high` exit 0. Pierwszy przebieg `pnpm check` miał 12 czerwonych plików api (`Connection terminated due to connection timeout`) i timeout jednego testu web: maszyna była obciążona równoległym buildem Gradle i emulatorem. Powtórka bez obciążenia: zielona.

**Kryteria**

- [x] AC1: testy 1 i 1a. Tytuł z rolą `header`; stan w `Text` z `accessibilityRole="text"`, `accessibilityLabel="Stan serwera: <stan>"` i `accessibilityLiveRegion="polite"`; ekran w `SafeAreaView`. Zapytania `getByRole` / `findByRole` / `getByText`.
- [ ] AC2: flow `apps/mobile/e2e/health.yaml` i `scripts/mobile-e2e.sh` są napisane, ale **nieuruchomione** (Open question).
- [ ] AC3: w `ci.yml` są joby `mobile` (Jest, design check), `mobile-android` (KVM, JDK 17, Maestro 2.11.0 z sumą SHA-256, `scripts/android-emulator.sh`, `scripts/mobile-e2e.sh`, artefakty przy porażce) i `mobile-ios` (`macos-latest`, `scripts/ios-simulator-build.sh`). Wszystkie są w `needs` joba `ci-ok`, z warunkiem `needs.changes.outputs.mobile == 'true'` (filtr `apps/mobile/**`, `packages/shared/**`, `packages/tokens/**` plus wspólna konfiguracja). Lint (z `eslint-plugin-react-native-a11y`) i typy `apps/mobile` biegną w istniejącym jobie `static` (`pnpm lint`, `pnpm typecheck`), który też startuje przy zmianie mobile. actionlint czysty; **brak przebiegu na GitHub** (Open question).
- [x] AC4 (lokalnie; w CI razem z AC3): `src/theme.ts` jest jedynym miejscem, które importuje `@lista/tokens/tokens`. `StartScreen` bierze z `theme` kolory, odstępy, rozmiar i wagę fontu oraz interlinię. `node scripts/design-check.mjs --scan apps/web/src apps/mobile/src --allow generated` → `Hard-coded colours: 0`, `OK: no errors`.
- [ ] AC5: sekcje „Gdzie jest kod” i „Komendy” w `layers/mobile.md` są uzupełnione; adres API idzie z `app.config.ts` (`API_URL`, emulator `10.0.2.2`). Sprawdzone lokalnie: install, testy, typy, lint, `expo config` (`extra.apiUrl` z `API_URL`), `expo prebuild --platform android`. **Niesprawdzone:** build Androida i E2E (Open question). Ręczne przejście należy do QA.
- [x] SEC1 (TH-23): testy 2, 2a i 2b. `npx expo config --type public --json` z `API_URL=https://example.test` daje `extra = {"apiUrl":"https://example.test","router":{"asyncRoutes":{"web":true}}}`; `router` dokłada plugin expo-router (konfiguracja tras, nie sekret). Brak `expo-dev-client`. Brak menu deweloperskiego w buildzie `--variant release` sprawdza QA na urządzeniu.
- [x] SEC2 (TH-16): `no-restricted-syntax` w bloku `apps/mobile/**` w `eslint.config.js` łapie `setItem` / `mergeItem` z kluczem (literał albo szablon) pasującym do `/sess|token|auth|cookie|jwt/i`. Celowe naruszenie w `apps/mobile/src/session-violation.ts` (plik usunięty po teście): przed regułą lint zgłaszał tylko `no-unsafe-call` (brak paczki). Po dodaniu reguły: `error Sesja tylko w expo-secure-store, nigdy w AsyncStorage (TH-16) no-restricted-syntax` dla `setItem("session_token", …)` i dla `setItem` z szablonem `authToken:${user}`; `setItem("lastFilter", …)` przechodzi bez błędu.

**Spot-check lintu a11y:** `<TouchableOpacity accessibilityRole="buton">` → błąd `react-native-a11y/has-valid-accessibility-role` (plik usunięty). Wyłączyłem regułę `has-accessibility-hint`, bo wymaga podpowiedzi także na nieinteraktywnym tekście stanu. Propozycja do potwierdzenia.

**Decyzje i odstępstwa (do przeglądu)**

- Wersje: Expo SDK 58 (`expo` 58.0.19, `expo-router` 58.0.26, React Native 0.88.0, React 19.3.0, zgodnie z `bundledNativeModules.json` tej wersji Expo), `jest` 30.5.2, `jest-expo` 58.0.12, `@testing-library/react-native` 14.1.0 (z peerem `test-renderer` 1.3.0), `msw` 3.0.3 (jak w web), `eslint-plugin-react-native-a11y` 3.5.1 (deklaruje peer `eslint` ≤ 8, ale działa w flat config ESLint 9). Wszystkie pochodzą z `tech-stack.md` albo `CODING_STANDARDS.md`.
- `pnpm-workspace.yaml`, `overrides: "@expo/cli>zod": 4.6.7`. `@expo/cli` deklaruje `zod ^3.25.76`, a ta wersja ma advisory high GHSA-mrhx-c7xc-m3w5 (poprawka tylko w 4.6.6+), więc bramka `pnpm audit --audit-level high` (TH-22, job `always`) była czerwona. CLI używa z zod tylko API zgodnego z v4 (schematy devtools/MCP); te moduły się ładują, `expo config` działa. Dodatkowo `allowBuilds: false` dla `@parcel/watcher` i `unrs-resolver`.
- Testy Jest: preset Expo podmienia globalne `fetch` / `Request` / `Response` / `Headers` na natywny fetch Expo (w Jest bez implementacji), a tego MSW nie przechwytuje. `test/environment.js` zapamiętuje fetch API z Node, a `test/node-fetch.js` przywraca je po setupie presetu. W MSW 3 opcja nazywa się `onUnhandledFrame: "error"` (nie `onUnhandledRequest`). `expo-constants` jest zamockowany w `test/setup.ts` (moduł natywny, mock dozwolony).
- Tokeny mają jednostki CSS (`"24px"`); `theme.ts` przelicza je na liczby dp.
- Identyfikator aplikacji `dev.tombraz.listazakupow` (Android `package`, iOS `bundleIdentifier`) wybrałem sam; do potwierdzenia przed EAS (E-04).
- Stan jest sprawdzany ponownie co 5 s, dopóki nie jest „gotowe” (QA plan: api, które pojawia się później).
- Katalogi `android/` i `ios/` są poza repo (CNG, `expo prebuild`).
- `pipeline.md` (etap 2) mówi o jednym „jobie mobile”, a zrobiłem trzy joby (`mobile`, `mobile-android`, `mobile-ios`; iOS na `macos-latest`). Propozycja: dopisać to w `pipeline.md` (nie edytuję `docs/architecture/` poza przewodnikami warstw).

**Przewodniki warstw (Step 8b):** `layers/mobile.md`: „Gdzie jest kod”, „Komendy”; `layers/infra.md`: „Gdzie jest kod” (T-003), „Komendy” (testy skryptów).

<!-- QA rounds are appended below by /qa-task -->

## Open question

AC2 (Maestro na emulatorze) i AC3 (przebieg CI) nie mają dowodu, bo nie mogłem ich uruchomić:

1. Nie wolno mi pushować, a joby `mobile-android` i `mobile-ios` startują dopiero na PR.
2. Lokalnie (Windows) uprawnienia sesji zablokowały uruchomienie pobranego CLI Maestro (2.11.0, suma SHA-256 sprawdzona). Build Gradle (`assembleRelease`) przerywa zadanie Expo `:expo:generateInlineModules` z błędem `expo-modules-autolinking … SyntaxError: Unexpected non-whitespace character after JSON at position 2`: argument JSON gubi cudzysłowy, gdy Gradle wywołuje go na Windows. To błąd Expo SDK 58; na Linuksie w CI nie powinien wystąpić. Wcześniej wrapper Gradle nie mógł pobrać dystrybucji z Javy (TLS i timeout).

Kod, skrypty (tryb `--dry-run` przetestowany), flow `health.yaml` i joby CI (actionlint czysty) są gotowe. Pozostałe kryteria mają dowody w Evidence.

**Pytanie:** jak zweryfikować AC2 i AC3?

- **Rekomendacja:** właściciel pushuje gałąź epiku (CI na PR #1 przeliczy się z jobami mobile, bo zmiana `.github/**` uruchamia wszystkie warstwy) i wznawia T-003. Implementer poprawia błędy jobów (pierwszy przebieg emulatora i buildu iOS prawie na pewno coś pokaże) i wpisuje linki do przebiegów. Dowód „PR bez zmian mobile pomija job” daje PR testowy z gałęzi `ci-test/T-003-docs` (jak w T-002), też wypchnięty przez właściciela.
- **Alternatywa:** właściciel pozwala implementerowi na czas tego taska pushować gałęzie `ci-test/T-003-*` i używać `gh pr create` (jak w T-002), żeby poprawki CI szły bez czekania na człowieka.

Przy okazji do potwierdzenia: override `"@expo/cli>zod": 4.6.7` (zamiast wyjątku w audycie) i identyfikator aplikacji `dev.tombraz.listazakupow`.

Answer: Rekomendacja przyjęta: właściciel pushuje gałąź epiku (CI na PR #1 uruchomi joby mobile); implementer po wznowieniu poprawia błędy jobów i wpisuje linki do przebiegów. Gałąź ci-test/T-003-docs przygotuj lokalnie (commit) i zgłoś przez NEEDS_USER do wypchnięcia przez właściciela; nie pushuj sam. Override "@expo/cli>zod": 4.6.7 i app id dev.tombraz.listazakupow zatwierdzone.

## Przebieg CI 1 (wznowienie 2026-10-28)

Właściciel wypchnął gałąź epiku. Przebieg [40734724299](https://github.com/tombraz/lista-zakupow/actions/runs/40734724299) (PR #1): `changes`, `static`, `tests`, `build`, `migrations`, `e2e-web`, `infra`, `always`, `mobile` i **`mobile-ios` zielone** (build iOS na symulator działa w CI). **`mobile-android` zawisł** w kroku „Emulator Androida” na `adb wait-for-device` (17:21:11 → anulowany przez właściciela 18:04). Log emulatora nie trafił do artefaktów, bo upload miał tylko `if: failure()`. `ci-ok` czerwony.

Poprawka (commit „T-003: WIP - needs user” po tej sekcji):

- `scripts/android-emulator.sh`: bez `adb wait-for-device`. Pętla `getprop sys.boot_completed` (każde `adb` z `timeout 10`) sprawdza też, czy proces emulatora żyje. Gdy emulator padnie albo nie wstanie w `BOOT_TIMEOUT_S` (domyślnie 300, nadpisywalne env), skrypt kończy się błędem i wypisuje 60 ostatnich linii `emulator.log`. Nowy krok `emulator -accel-check` pokazuje w logu stan KVM.
- `ci.yml`, `mobile-android`: `timeout-minutes: 12` na kroku emulatora i 25 na kroku E2E. Upload raportu i logów `if: failure() || cancelled()`.
- Test 2d (powyżej) odtwarza zawieszenie (red: exit 124) i jest zielony. `mobile.test.sh` 5× ok, actionlint `1.7.12@sha256:b1934ee5…` exit 0, `pnpm format:check` 0.

Przyczyna padnięcia emulatora jest **nieznana**, bo log nie został zachowany. Następny przebieg pokaże ją w logu kroku albo w artefakcie `e2e-mobile-android`.

Gałąź `ci-test/T-003-docs` (zgodnie z odpowiedzią): przygotowana lokalnie, oparta na commicie z poprawką, zmienia tylko `docs/ci-test.md`. Nie wypchnięta.

## Open question

Poprawka zawieszenia emulatora jest w commicie na gałęzi epiku, a gałąź `ci-test/T-003-docs` jest gotowa lokalnie. Obie czekają na push przez właściciela.

**Pytanie:** proszę wypchnąć gałąź epiku i `ci-test/T-003-docs`, potem otworzyć PR testowy do gałęzi epiku i wznowić T-003.

- **Rekomendacja:** `git push origin epic/E-01-szkielet-i-wspolna-lista ci-test/T-003-docs`, potem `gh pr create --base epic/E-01-szkielet-i-wspolna-lista --head ci-test/T-003-docs --draft --title "ci-test T-003: docs-only (nie mergować)"`. Po wznowieniu implementer czyta przebiegi: albo `mobile-android` przechodzi (link do dowodu AC2/AC3), albo log emulatora wskazuje kolejną poprawkę. Dla PR testowego dowodem jest pominięcie jobów mobile.
- **Alternatywa:** wypchnąć na razie tylko gałąź epiku, a PR testowy otworzyć dopiero po zielonym `mobile-android`. Każdy wznowiony przebieg zmienia wtedy jedną rzecz, kosztem jeszcze jednej rundy pushu.

Answer: Właściciel wypchnął epic/E-01-szkielet-i-wspolna-lista (94a2e03) i ci-test/T-003-docs (cb7f308) oraz otworzył draft PR testowy https://github.com/tombraz/lista-zakupow/pull/8 (baza: gałąź epiku). Zbierz dowody z przebiegów na PR #1 i PR #8; kolejne pushe nadal przez NEEDS_USER.
