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

<Uzupełnia task walking skeleton. Planowane: `apps/mobile/app/` (trasy expo-router), `apps/mobile/src/screens/`, `apps/mobile/src/components/`, `apps/mobile/src/api/`.>

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| install | | |
| uruchom lokalnie (Expo) | | |
| type check / lint | | |
| testy jednego pliku | | |
| wszystkie testy warstwy | | |
| E2E (Maestro) | | |
| build (EAS / lokalny) | | |

<Uzupełnia task walking skeleton.>

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
