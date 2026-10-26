# 0001 Monorepo TypeScript: web (React) i aplikacja natywna (Expo) na wspólnym API

- Status: przyjęty (2026-10-26, razem z `docs/architecture/`)
- Data: 2026-10-26

## Kontekst

BRD N-01 wymaga wygodnego używania na komputerze i telefonie; forma techniczna należała do tej fazy. Design powstał jako responsywny web mobile-first. Pilotaż (`docs/PILOT.md`) ma przetestować proces na wszystkich warstwach typowego stosu, w tym mobile.

## Decyzja

Monorepo pnpm z `apps/api` (Fastify), `apps/web` (React + Vite), `apps/mobile` (Expo / React Native, Android + iOS, bez sklepów), `packages/shared` (zod, kontrakt API, kody błędów) i `packages/tokens`. Cały kod w TypeScript strict.

## Rozważane alternatywy

- **Sam web + PWA:** najprostsze i zgodne z designem; odrzucone, bo pilotaż ma sprawdzić warstwę mobile.
- **Osobne repozytoria:** więcej koordynacji przy jednym epiku i jednym autorze.
- **Inny język backendu:** traci wspólny pakiet walidacji i kontraktu.

## Konsekwencje

- Dwa klienty UI do zbudowania i przetestowania; aplikacja mobilna używa tych samych specyfikacji ekranów co web z konwencjami platformy (decyzja 2026-10-26, `architecture.md`); linki zaproszenia i resetu otwierają web, bez deep linków w MVP.
- Reguły (limity, długości, normalizacja) w jednym pakiecie dla trzech aplikacji.
- Expo w monorepo pnpm wymaga konfiguracji Metro dla workspace'ów (walking skeleton).
