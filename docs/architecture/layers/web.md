---
layer: web
status: approved          # draft | approved
approved: 2026-10-26
---

# Przewodnik warstwy: web

## Cel

SPA w przeglądarce (telefon i komputer): ekrany SC-01…SC-09 według `docs/design/`, w tym strony docelowe linku zaproszenia (SC-08) i resetu hasła (SC-03). Pakiet `packages/tokens` (generowanie tokenów) też należy do tej warstwy.

## Technologia

React + Vite, TypeScript strict, CSS Modules, zmienne CSS z `packages/tokens`, React Router, TanStack Query, zod z `packages/shared` (`../tech-stack.md`).

## Gdzie jest kod

<Uzupełnia task walking skeleton. Planowane: `apps/web/src/screens/SC-xx-*/`, `apps/web/src/components/` (komponenty design systemu), `apps/web/src/api/` (klient HTTP i WS), `packages/tokens/`.>

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| install | | |
| uruchom lokalnie | | |
| type check / lint | | |
| testy jednego pliku | | |
| wszystkie testy warstwy | | |
| E2E | | |
| build | | |

<Uzupełnia task walking skeleton.>

## Testy w tej warstwie

- **Seam:** ekran / trasa z klientem API podstawionym przez MSW; komponent design systemu przez jego propsy.
- **Narzędzia:** Vitest + React Testing Library (jsdom); Playwright + `@axe-core/playwright` dla E2E (viewport 390 × 844 i 1280 × 800).
- **Dane testowe:** odpowiedzi MSW budowane z typów `packages/shared`; w E2E prawdziwe api na czystej bazie.
- **Mocki dozwolone dla:** API (tylko w testach komponentów), schowka, zegara.
- Elementy wyszukiwane po roli i nazwie dostępnej (`getByRole`); test ID tylko, gdy rola nie istnieje.

## Zasady bezpieczeństwa

- Zakaz `dangerouslySetInnerHTML` (lint); treść innych osób zawsze jako tekst (TH-15).
- Sesja wyłącznie w ciasteczku `HttpOnly` ustawianym przez API; nic o sesji w `localStorage` ani `sessionStorage` (TH-16).
- Żądania z `credentials: "include"` tylko do adresu API z konfiguracji (TH-14).
- Token zaproszenia czytany ze ścieżki `/zaproszenie/:token`; po przyjęciu przekierowanie usuwa go z historii (`replace`); brak zasobów z zewnętrznych domen (TH-08).
- Nagłówki CSP, HSTS, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` ustawia hosting statyczny (`/ci-cd`) (TH-08, TH-15, TH-24).

## Konwencje

- Wartości wyglądu tylko z tokenów (`var(--color-text-primary)`); zero kolorów i odstępów na sztywno (sprawdza `design-check --scan`).
- Komponent renderuje; pobieranie danych i reguły w hookach (`useList`, `useAddItem`), subskrypcja na żywo w jednym hooku `useLiveList`.
- Brak optymistycznych aktualizacji: pozycja pojawia się po odpowiedzi API; w czasie zapisu stan „zapisywanie” (F-15).
- Teksty z tabeli „Copy” specyfikacji ekranu, w plikach komunikatów obok ekranu; kody błędów API mapowane na teksty w jednym miejscu.
- `lang="pl"`, daty przez `Intl.DateTimeFormat("pl-PL")`.
- Zachowania dostępności z sekcji „Accessibility” specyfikacji ekranu i `design-system.md` (fokus, `role="alert"` / `status`, pułapka fokusu w arkuszu i oknach).

## Pułapki

<Rośnie z ustaleniami QA.>

## Skille i źródła

- `frontend-design` przy budowie komponentów design systemu.
- `.claude/skills/brd-to-design/references/accessibility.md` — lista kontrolna dostępności.
- Dokumentacja React Router, TanStack Query, Playwright, axe-core.
