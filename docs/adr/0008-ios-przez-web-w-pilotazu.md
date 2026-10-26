# 0008. iOS w pilotażu przez web, aplikacja natywna tylko na Androidzie

- Status: przyjęty
- Data: 2026-10-26
- Decyduje: Tomasz Brążkiewicz

## Kontekst

`tech-stack.md` zakłada aplikację Expo na Android i iOS bez sklepów. Instalacja poza App Store na iPhone'ach (ad hoc / EAS internal distribution) wymaga Apple Developer Program (99 USD/rok); Expo Go z App Store obsługuje tylko jedną wersję SDK, a darmowe konto Apple wymaga Maca i ponownej instalacji co 7 dni (docs.expo.dev/build/internal-distribution, expo.dev/changelog/expo-go-and-app-store-may-2026, developer.apple.com, sprawdzone 2026-10-26).

## Decyzja

W pilotażu aplikacja natywna trafia do domowników tylko na Androidzie (APK z EAS internal distribution). Domownicy z iPhone'em używają wersji web w przeglądarce telefonu. Kod mobile pozostaje wieloplatformowy; build iOS (symulator) powstaje w CI, żeby nie dopuścić do rozjazdu, ale nie jest dystrybuowany.

## Rozważane alternatywy

- **Apple Developer Program, 99 USD/rok:** pełna aplikacja na zarejestrowanych iPhone'ach; koszt ponad budżet pilotażu.
- **Expo Go z przypiętym SDK:** blokuje aktualizację SDK i natywne moduły.

## Konsekwencje

- E2E mobile (Maestro) tylko na Androidzie.
- Wersja web musi być wygodna na iPhonie (N-01 — już wymagane przez design).
- Wrócić przed udostępnieniem aplikacji szerzej lub gdy iPhone'owi domownicy zgłoszą braki web.
