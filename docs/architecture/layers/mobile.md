---
layer: mobile
status: approved          # draft | approved
approved: 2026-10-26
---

# Przewodnik warstwy: mobile

## Cel

Aplikacja natywna Android + iOS: ekrany SC-01…SC-09 korzystające z tego samego API co web. Specyfikacje ekranów te same co dla web (`docs/design/screens/`), z konwencjami platformy: gest i przycisk „wstecz”, natywny arkusz zamiast okna dialogowego, bezpieczne obszary ekranu. Linki zaproszenia (SC-08) i resetu hasła (SC-03) otwierają web; aplikacja nie obsługuje deep linków w MVP (`../architecture.md`).

## Technologia

Expo (React Native), expo-router, TypeScript strict, TanStack Query, `expo-secure-store` przez plugin Expo Better Auth, tokeny z `packages/tokens` (`tokens.ts`), zod z `packages/shared` (`../tech-stack.md`). Dystrybucja: development build / EAS internal, bez sklepów.

## Gdzie jest kod

Istnieje (T-003), pakiet `@lista/mobile` (Expo SDK 58, React Native 0.88):

- `apps/mobile/app/` — trasy expo-router (`_layout.tsx`: `SafeAreaProvider`, `QueryClientProvider`, `Stack` bez nagłówka; `index.tsx` → ekran startowy).
- `apps/mobile/src/screens/<ekran>/` — ekrany z `messages.ts` (teksty) i hookami danych; `start/` pokazuje stan API i bazy.
- `apps/mobile/src/api/` — wywołania API (`health.ts`); adres z `src/config.ts` (`Constants.expoConfig.extra.apiUrl`).
- `apps/mobile/src/theme.ts` — jedyne miejsce, które czyta `@lista/tokens/tokens` (wartości `px` → liczby dp).
- `apps/mobile/app.config.ts` — konfiguracja Expo; `extra` zawiera tylko `apiUrl` z `API_URL` (domyślnie `http://10.0.2.2:3000`); HTTP bez TLS na Androidzie tylko dla adresu `http://` (lokalne api).
- `apps/mobile/e2e/` — flowy Maestro (`health.yaml`); raport w `e2e/results/` (ignorowany).
- `apps/mobile/test/` — setup Jest: `environment.js` + `node-fetch.js` (fetch z Node zamiast natywnego fetch Expo, żeby przechwytywał MSW), `setup.ts` (serwer MSW, atrapa `expo-constants`), `render.tsx` (`renderWithApi`).
- `apps/mobile/android/`, `apps/mobile/ios/` — generuje `expo prebuild`, poza repo (`.gitignore`).
- Skrypty CI: `scripts/android-emulator.sh`, `scripts/mobile-e2e.sh`, `scripts/ios-simulator-build.sh` (wszystkie z `--dry-run`, test `scripts/test/mobile.test.sh`).

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| install | `pnpm install` | korzeń repo |
| uruchom lokalnie (Expo) | `pnpm services:up`, api (`pnpm dev` albo `pnpm --filter @lista/api dev`), potem `pnpm --filter @lista/mobile start` i `a` (emulator Androida, Expo Go). Telefon w tej samej sieci: api z `HOST=0.0.0.0`, aplikacja z `API_URL=http://<IP komputera>:3000` | korzeń repo |
| type check / lint | `pnpm --filter @lista/mobile typecheck`; `pnpm exec eslint apps/mobile --max-warnings 0` (w tym `eslint-plugin-react-native-a11y` i zakaz sesji w AsyncStorage, TH-16) | korzeń repo |
| testy jednego pliku | `pnpm --filter @lista/mobile test -- src/screens/start/StartScreen.test.tsx` | korzeń repo |
| wszystkie testy warstwy | `pnpm test:mobile` (Jest; `pnpm check` też je uruchamia) | korzeń repo |
| E2E (Maestro) | uruchomiony emulator Androida (CI: `bash scripts/android-emulator.sh`), `maestro` w `PATH`, JDK 17+; potem `bash scripts/mobile-e2e.sh` (baza, migracje, api, build wydania z `API_URL=http://10.0.2.2:3000`, flowy z `apps/mobile/e2e/`) | korzeń repo, Git Bash na Windows |
| build (EAS / lokalny) | lokalnie Android: `pnpm --filter @lista/mobile exec expo run:android --variant release` (Gradle, bez EAS); iOS na symulator: `bash scripts/ios-simulator-build.sh` (macOS); profile EAS — E-04 | korzeń repo |

## Testy w tej warstwie

- **Seam:** ekran z klientem API podstawionym przez MSW; komponent przez propsy.
- **Narzędzia:** Jest (preset Expo) + React Native Testing Library; Maestro (flowy YAML w `apps/mobile/e2e/`) na emulatorze Androida.
- **Dane testowe:** odpowiedzi MSW z typów `packages/shared`; w Maestro prawdziwe api lokalne.
- **Mocki dozwolone dla:** API (testy komponentów), modułów natywnych bez implementacji w Jest (SecureStore, NetInfo).
- Elementy po roli i etykiecie (`getByRole`, `getByLabelText`).

## Zasady bezpieczeństwa

- Token sesji tylko w `expo-secure-store`; nigdy AsyncStorage, logi ani parametry nawigacji (TH-16).
- Aplikacja zawiera tylko publiczny adres API; żadnych kluczy ani sekretów w `app.config` i paczce (TH-23).
- WebSocket uwierzytelniany nagłówkiem, nie parametrem URL (TH-16).
- Build wydania bez logów debug i bez menu deweloperskiego (TH-23).
- Treść innych osób renderowana jako `Text` (TH-15).

## Konwencje

- Wartości wyglądu tylko z `tokens.ts`; zero kolorów na sztywno (sprawdza `design-check --scan`).
- Ta sama struktura hooków co web (`useList`, `useLiveList`); logika współdzielona przez `packages/shared`, nie przez kopiowanie (współdzielone hooki dopiero przy trzecim powtórzeniu).
- Brak optymistycznych aktualizacji; stan sieci z NetInfo + stanu WebSocket (F-15).
- Cele dotyku ≥ 48 dp; `accessibilityRole`, `accessibilityLabel`, `accessibilityState` na każdym elemencie interaktywnym; tekst skaluje się z ustawieniami systemu.
- Arkusz edycji i okna potwierdzenia jako natywne modale z poprawnym fokusem czytnika ekranu.

## Pułapki

- `localhost` z emulatora Androida to `10.0.2.2`; adres API z konfiguracji środowiska Expo.

## Skille i źródła

- `.claude/skills/brd-to-design/references/accessibility.md` — lista kontrolna (React Native).
- Dokumentacja Expo (expo-router, SecureStore, EAS), Better Auth Expo plugin, Maestro.
