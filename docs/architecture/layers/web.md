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

- `apps/web/index.html`, `src/main.tsx` — wejście SPA (`lang="pl"`, `QueryClientProvider`, `createBrowserRouter`)
- `apps/web/src/routes.tsx` — trasy (`/logowanie`, `/rejestracja`, `/regulamin`, `/listy`, `/konto`); test routera `routes.test.tsx`
- `apps/web/src/session/` — `useSession` (`GET /api/v1/me`), strażnicy tras `RequireSession` / `PublicOnly`
- `apps/web/src/screens/SC-xx-*/` — ekran, `messages.ts` (teksty ekranu i jego kody błędów przez `errorText`), `*.module.css`, hooki, `*.test.tsx`
- `apps/web/src/errorText.ts` — kod błędu żądania → komunikat: wspólne kody (np. `network`) w jednym miejscu, ekran podaje swoje teksty i tekst domyślny; `api/client.ts` — `apiRequest`, `ApiRequestError`, `asRequestError`
- `apps/web/src/api/` — `client.ts` (`apiRequest`, `ApiRequestError`), `account.ts`; WS dojdzie z modułem `na-zywo`
- `apps/web/src/styles/global.css` — import `@lista/tokens/tokens.css`, style bazowe; `page.module.css` — kolumna i tytuł ekranu (`composes`)
- `apps/web/src/components/` — komponenty design systemu (AppBar, AuthPage, Button, ConsentCheckbox, FieldError, InlineAlert, PasswordField, TextField), `useFocus.ts`, `cx.ts`
- `apps/web/test/` — setup Vitest, serwer MSW, `renderApp(adres)` (cała aplikacja w `createMemoryRouter`), `sessionIs(user | null)`
- `apps/web/e2e/` — testy Playwright, `fixtures.ts` (`test` z własnym adresem klienta, `expectNoAxeViolations`, `signUp`) i `server.ts` (kontener bazy + zbudowane API)
- `packages/tokens/` — `src/build.ts` (Style Dictionary), wynik w `packages/tokens/generated/` (`tokens.css`, `tokens.ts`; poza gitem)

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| install | `pnpm install`; tokeny ponownie: `pnpm --filter @lista/tokens build` | korzeń repo |
| uruchom lokalnie | `pnpm dev` (Vite `http://localhost:5173`, proxy `/api` i `/health` do API) | korzeń repo |
| type check / lint | `pnpm typecheck` / `pnpm lint`; kolory na sztywno `pnpm design-check` | korzeń repo |
| testy jednego pliku | `pnpm vitest run apps/web/src/screens/SC-01-logowanie/SignInScreen.test.tsx` | korzeń repo |
| wszystkie testy warstwy | `pnpm vitest run --project web --project tokens` | korzeń repo |
| E2E | `pnpm test:e2e` (buduje web i API, startuje kontener bazy; pierwszy raz `pnpm --filter @lista/web exec playwright install chromium`; log API w `apps/web/test-results/api.log`; na Windows 1 worker) | korzeń repo |
| build | `pnpm --filter @lista/web build` (`apps/web/dist`, serwowany przez API) | korzeń repo |

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

- E2E: na Windows 1 worker (zamieranie API przy wielu workerach, T-001); na Linuksie w CI równoległe workery (Playwright domyślnie: 2 na `ubuntu-latest`) — stabilne w 5 przebiegach T-002 (4 testy, ~15 s). Decyzja: zostaje `workers` domyślne poza Windows (T-002).

## Skille i źródła

- `frontend-design` przy budowie komponentów design systemu.
- `.claude/skills/brd-to-design/references/accessibility.md` — lista kontrolna dostępności.
- Dokumentacja React Router, TanStack Query, Playwright, axe-core.

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-10-27 | T-004: „Gdzie jest kod” (router, sesja, komponenty, helpery testów, fixtures E2E). |
| 2026-10-27 | T-002: „Pułapki” — równoległość E2E na Linuksie w CI. |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
