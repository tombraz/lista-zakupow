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
- `apps/web/src/routes.tsx` — trasy (`/logowanie`, `/rejestracja`, `/regulamin`, `/zaproszenie/:token` (publiczna), `/listy`, `/listy/:listId`, `/listy/:listId/uczestnicy`, `/konto`); test routera `routes.test.tsx`
- `apps/web/src/queryClient.ts` — `QueryClient` aplikacji: ponawiane tylko błędy sieci i 5xx (`shouldRetry`), nigdy 4xx
- `apps/web/src/lists/` — `useLists`, `useList` (`noAccess` przy 404), `listName.ts` (`useListNameForm`, teksty błędów nazwy), `ListNameField.tsx` (pole nazwy listy dla SC-05 i SC-06)
- `apps/web/src/session/` — `useSession` (`GET /api/v1/me`), strażnicy tras `RequireSession` / `PublicOnly` (z kontekstem zaproszenia po zalogowaniu: `afterEntry`); 401 z `/api/v1/*` u zalogowanego i zerwane połączenie na żywo bez sesji kończą sesję w kliencie → SC-01 (`useEndSessionOnUnauthenticated`, `useCheckSession`, T-018)
- `apps/web/src/invitations/` (T-008) — `invitationContext.ts` (kontekst zaproszenia SC-08 → SC-01 / SC-02 w stanie nawigacji, `afterEntry`, `invitationPath`), `EntryLink.tsx` (SC-01 ↔ SC-02 z e-mailem i kontekstem)
- `apps/web/src/screens/SC-07-uczestnicy/` — `ParticipantsScreen` (wiersz właściciela, sekcja „Zaproszenia”), `useInvitations` (`useInvitations`, `useInvitationChanges`)
- `apps/web/src/screens/SC-08-zaproszenie/` — `InvitationScreen` (stany, auto-dołączenie po powrocie z SC-01), `useInvitation` (podgląd, przyjęcie, `replace` na SC-06)
- `apps/web/src/screens/SC-06-lista/` — `ListScreen` (pasek, przewijany `main`, AddBar w przepływie pod nim — nie zasłania fokusu, 2.4.11), `Items` (wiersze, pusty stan, fokus po usunięciu), `AddItemBar` + `useAddItem` (jedno `id` klienta na wpisywaną pozycję), `EditItemSheet` + `useEditItem` (zapis tylko zmienionych pól, 404 = „usunięta przez inną osobę”), `sameName.ts` (lokalne sprawdzenie duplikatu przez `normalizeItemName`), `itemsCache.ts` (pozycje w cache po odpowiedzi API; `inListOrder`, `replaceItem`); T-007: `useCheckItem` (checkbox, zapisywanie, ogłoszenie „Odhaczono …”), `useCheckboxFocus` (fokus po odhaczeniu, gdy lista już się przerysowała), `BoughtSection` („Kupione (N)”), `ClearBoughtDialog`, `confirmMutation.ts` (ConfirmDialog nad zapisem)
- `apps/web/src/screens/SC-xx-*/` — ekran, `messages.ts` (teksty ekranu i jego kody błędów przez `errorText`), `*.module.css`, hooki, `*.test.tsx`
- `apps/web/src/api/useGuardedMutation.ts` (T-020) — `useMutation` z synchroniczną blokadą podwójnego wysłania (`lockOf`: blokada na klucz)
- `apps/web/src/errorText.ts` — kod błędu żądania → komunikat: wspólne kody (np. `network`) w jednym miejscu, ekran podaje swoje teksty i tekst domyślny; `api/client.ts` — `apiRequest`, `ApiRequestError`, `asRequestError`
- `apps/web/src/api/` — `client.ts` (`apiRequest(path, { method, body })`, `ApiRequestError` z `details.limit` / `details.listId`), `account.ts`, `lists.ts`, `items.ts`, `invitations.ts`
- `apps/web/src/live/` (T-009) — `liveSocket.ts` (`LiveSocket`: jedno połączenie `/api/v1/live`, pong na ping, bez pingu 35 s albo po zamknięciu ponowne połączenie z odnowieniem subskrypcji, `onReconnect`, `onDrop`), `LiveProvider.tsx` (w `RequireSession`: połączenie po zalogowaniu, `lists.changed` i powrót połączenia odświeżają SC-05; `useLive`), `useLiveList.ts` (SC-06, SC-07: subskrypcja listy, zdarzenia w cache z pominięciem nie nowszego `updatedAt`, podświetlenie zmian innych (bez „ogranicz ruch” i przy własnym zapisie w toku), `list.deleted` / `access.revoked` → `/listy` ze stanem `removedList`); `lists/deleteListKey.ts` (klucz mutacji usuwania: własne usunięcie bez komunikatu); SC-05 `useNewListAnnouncement`; SC-07 `useInvitations` słucha `invitations.changed`
- `apps/web/src/styles/global.css` — import `@lista/tokens/tokens.css`, style bazowe; `page.module.css` — kolumna, tytuł ekranu i `visuallyHidden` (`composes`)
- `apps/web/src/components/` — komponenty design systemu (AddBar, AppBar z `AppBarLink` / `AppBarButton`, AuthPage, Avatar (`Avatar` 32 px, `AvatarStack`), Button (`primary`, `secondary`, `danger`, `accent`), ItemRow, ConfirmDialog, ConsentCheckbox, EmptyState, FieldError, InlineAlert (`urgent` — `role="alert"` dla ostrzeżenia), ListCard, LoadError, Modal (portal, pułapka fokusu, Esc, powrót fokusu — baza ConfirmDialog i arkuszy), MoreMenu, PasswordField, Skeleton, InviteLinkBox, Toast (`useToast`, 5 s), TextField (`variant="onBrand"` na pasku marki: błąd i licznik na jasnym tle)), `useFocus.ts`, `cx.ts`
- `apps/web/test/` — setup Vitest (`disabledFocus.ts`: fokus z elementu `disabled` spada na `body` jak w przeglądarce, T-023), serwer MSW (`msw-server.ts`: domyślnie cichy serwer `/api/v1/live` przez `ws.link`; `live.ts`: `liveServer()` — wiadomości klienta, `send`, `dropAll`), `renderApp(adres | historia)` (cała aplikacja w `createMemoryRouter`; tablica = wpisy historii, ostatni aktywny), `sessionIs(user | null)`, `lists.ts` (`aList`, `anItem`, `detailsOf(list, items?)`, `listsAre`, `apiError`, `ANIA`, `TOMEK`)
- `apps/web/e2e/` — testy Playwright (J-05 `j05-na-zywo.spec.ts`: dwa konteksty), `lists.ts` (`openNewList`, `add`, `api`, `addViaApi`), `fixtures.ts` (`test` i `newClient` — każdy klient z własnym losowym adresem, `expectNoAxeViolations`, `signUp`) i `server.ts` (kontener bazy + zbudowane API)
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
- Stan „w trakcie” (ładowanie, zapis, kliknięcia w czasie zapisu): odpowiedź MSW wstrzymana przez `heldResponse()` (`test/held.ts`) i zwalniana po asercjach, nie `delay(ms)` — pod obciążeniem odpowiedź z `delay` przychodzi przed drugim kliknięciem (lint: `no-restricted-syntax` na `delay(ms)` w testach `apps/web/src`). Pola wejścia (imię, e-mail, hasło) wypełnia `fillIn` (`test/user.ts`, wklejenie, jedno przerysowanie); `user.type` tam, gdzie test sprawdza pisanie. Zimny start workera płaci `warmUp()` w `test/setup.ts`, nie pierwszy test pliku (T-021).

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
- E2E na Windows: otwarcie drugiej strony (`context.newPage()`) w trakcie testu wstrzymuje API na ~10 s (w logu API przerwa po ostatnim żądaniu), więc następne żądanie przekracza limit asercji. Zmianę „innej osoby” test robi przez `page.request` w tej samej sesji; drugą kartę sprawdza QA ręcznie (T-006).
- Po `page.reload()` AddBar jest nieaktywny, dopóki lista się nie wczyta: przed `focus()` / `fill()` czekać na `toBeEnabled()` (T-006).
- E2E: dane przygotowane przez API (`page.request`) — każda odpowiedź sprawdzona (status), najwyżej 10 żądań naraz (pula połączeń API; nadmiar czeka > 3 s i dostaje 500), a przed akcją w UI czekanie na stan na ekranie (np. „N do kupienia”), nie na samo `toBeEnabled()`. Bez tego błąd przygotowania wygląda jak błąd ekranu: w T-023 część z 50 równoległych `POST` dostawała 500, lista miała 497 zamiast 499 pozycji i test padał na fokusie (T-031). Pozycje masowo: `addViaApi` z `e2e/lists.ts`.
- Każdy hook zapisu (`useMutation`) ma testy komponentu (MSW) z: **opóźnioną odpowiedzią** — użytkownik pisze, klika lub naciska Enter w trakcie zapisu i nic nie ginie po cichu; **zerwaną odpowiedzią** (`HttpResponse.error()` po zapisie na serwerze) — ponowienie tej samej treści nie dubluje, zmieniona treść nie zwraca starej, a stan na ekranie zgadza się z serwerem; **zmianą danych w międzyczasie** — ostrzeżenie z odpowiedzi API (limit, duplikat) wygasa, gdy jego przyczyna zniknie. Bez tych testów T-006 wróciło z QA dwa razy (runda 1 #1–#3, runda 2 #2).
- Test zmian na żywo (`live.send(...)`) wysyła tylko te zdarzenia, które serwer naprawdę wysyła po danej akcji — typy i adresatów sprawdź w trasie API (`live.publish` / `live.notify` w `apps/api/src/modules/*/http/`). Zmianę „w innej karcie”, po której serwer nic nie wysyła, test odwzorowuje samą zmianą odpowiedzi MSW, bez `live.send`. Sztuczne zdarzenie odświeża ekran za kod i ukrywa brak odświeżenia: w T-025 test przechodził, a w Chrome „+ Nowa lista” zostawał nieaktywny, bo `POST /lists` nie wysyłał `lists.changed` (QA runda 1 #1; brak zdarzenia — T-032).
- Blokada podwójnego wysłania musi być synchroniczna. `isPending` → `loading` działa dopiero po przerysowaniu, więc drugie kliknięcie albo Enter wysłane przed nim tworzy drugi zapis. Robi to `useGuardedMutation` (`api/useGuardedMutation.ts`): zamiennik `useMutation`, `mutate` w czasie zapisu nic nie wysyła; `lockOf` daje osobną blokadę na klucz (unieważnianie różnych linków). Każdy zapis z przycisku używa `useGuardedMutation` (lint: `no-restricted-imports` na `useMutation` w `apps/web/src`, bez wyjątków; `eslint-comments/no-restricted-disable` zabrania wyłączania tej reguły komentarzem — wyjątek tylko przez `eslint.config.js`); checkbox pozycji też, z `lockOf` po `itemId` (różne pozycje naraz, ta sama raz; T-030). Stan zapisu elementu (`loading` / `saving` przycisku na klucz) tylko z `isLocked(key)` tego hooka: `isPending` i `variables` mutacji opisują ostatnie z równoległych wywołań, więc przy dwóch zapisach naraz pierwszy element traci `aria-disabled`, choć blokada dalej działa, a kliknięcie nic nie robi i nic tego nie pokazuje (lint: `no-restricted-syntax` na `variables` w `apps/web/src`; T-043). Test: dwa zapisy naraz z osobnymi `heldResponse()` — oba w stanie zapisu do swojej odpowiedzi, a błąd jednego zwalnia tylko jego. Dodawanie pozycji od T-029 też idzie przez `useGuardedMutation`: AddBar w czasie zapisu nic nie wysyła, więc zapis jest jeden naraz. Test: dwa `fireEvent.click` bez `await` między nimi → jedno żądanie. Uwaga: gdy handler przed `mutate` ustawia stan, `act` przerysowuje przycisk i test przechodzi także bez blokady — nie dowodzi to ochrony (przegląd E-01, C2; T-020). Wtedy oba kliknięcia w jednym `act(() => { fireEvent.click(…); fireEvent.click(…); })`: React przerysowuje dopiero po nim (T-030).
- `onSuccess` / `onError` / `onSettled` tylko w opcjach `useGuardedMutation` / `useMutation`, nie w drugim argumencie `mutate(vars, { … })`. Te z `mutate` TanStack Query wywołuje tylko dla ostatniego wywołania (kolejne `mutate` odpina poprzednie) i nie po odmontowaniu, więc przy dwóch zapisach naraz wynik albo błąd pierwszego ginie po cichu. Dane potrzebne w wywołaniu zwrotnym (wpisana treść, szkic) idą w zmiennych mutacji. Lint: `no-restricted-syntax` na `mutate` / `mutateAsync` z dwoma argumentami w `apps/web/src` (przegląd E-01, C1; T-029).
- Po zmianie trasy fokus trafia na `h1` ekranu (`tabIndex={-1}`), chyba że ekran sam ustawia fokus (np. pusty SC-06 → „Co kupić?”). Inaczej fokus zostaje na `body` i czytnik ekranu nie ogłasza nowego ekranu (WCAG 2.4.3; przegląd E-01, S2). Robi to `AppBar` (`useRouteFocus`: fokus, gdy tytuł ma tekst); ekran bez AppBar ustawia fokus sam (SC-01/SC-02: pierwsze pole, SC-08: `Heading`, SC-04: `useEntryFocus` — przy montowaniu, nie przy zmianie `#`, a `#sekcja` w adresie → jej `h2`; T-022). Fokusowalny element na pasku marki ma obwódkę `focus.ring-on-brand` — globalna `focus.ring` ma kolor tła paska i jest niewidoczna (WCAG 2.4.7; T-014). Test: przejście linkiem między ekranami (`routeFocus.test.tsx`), nie tylko `renderApp(adres)`; nowa trasa w `routes.tsx` wymaga wpisu w `ROUTES` tego pliku (test „every route” sprawdza, że fokus nie zostaje na `body`, i pada przy trasie bez wpisu).
- Fokus po zapisie, który może iść równolegle z innym (`useGuardedMutation` z `lockOf`, np. odhaczanie różnych pozycji), nie celuje w jeden element wybrany w chwili kliknięcia: ten element mógł w międzyczasie zniknąć (inny zapis, zdarzenie na żywo) i fokus spada na `body` (WCAG 2.4.3). Przy kliknięciu zapamiętaj kolejność kandydatów, a cel wybierz dopiero przy fokusie, wobec aktualnego stanu ekranu; bez pasującego kandydata — stały element zastępczy (np. „Kupione (N)”; `useCheckItem` + `useCheckboxFocus`, T-039). Test: dwa zapisy naraz z `heldResponse()` i asercja, gdzie trafił fokus — testy pojedynczego zapisu tego nie łapią.
- Przycisk w stanie zapisu dostaje `aria-disabled="true"` i ignoruje kliknięcia, ale nie dostaje `disabled`. Atrybut `disabled` zabiera fokus (spada na `body`, także poza pułapkę dialogu) (WCAG 2.4.3; przegląd E-01, S3). Robi to `Button` z `loading` (także blokada wysłania formularza); jawne `disabled` zostaje dla trwałej niedostępności. Element, który może mieć fokus, nie dostaje `disabled` bez przeniesienia fokusu (np. na ostrzeżenie), także gdy stan przychodzi z odpowiedzi API albo na żywo — np. limit 500 pozycji wyłącza AddBar, a fokus przechodzi na ostrzeżenie (`useLimitFocus` z `components/useFocus.ts` — jedno miejsce dla SC-05, SC-06 i SC-07; T-023, T-025). jsdom sam nie zdejmuje fokusu z elementu `disabled`; robi to atrapa w `test/setup.ts` (`test/disabledFocus.ts`), więc asercja fokusu w teście komponentu widzi spadek na `body` jak w przeglądarce. E2E (`toBeFocused()`, J-02 T-015, J-03 T-023) potwierdza w przeglądarce. Lista kontrolna: każde `disabled={…}` zależne od danych z API lub zdarzenia na żywo (limit, pełna lista) ma test komponentu, który ustawia fokus na tym elemencie, wywołuje zmianę stanu i sprawdza, gdzie trafił fokus — samo `toBeDisabled()` nie wystarczy (przegląd E-01 runda 2, S1/S2: SC-05 „+ Nowa lista”, SC-07 „Utwórz link”).
- Odmowa limitu z API (409 `limit_reached`) wygasa po liczbie, nie po danych z cache: tylko przez `useLimitRefusal` (`api/useLimitRefusal.ts`) — pamięta liczbę z chwili odmowy (podnosi ją, gdy odświeżenie pokaże więcej) i obowiązuje, dopóki liczba nie spadnie (SC-05 listy, SC-06 pozycje). Porównanie tożsamości tablicy z cache (`refused === lists`) zawodzi, bo structural sharing TanStack zostawia tę samą referencję przy tych samych danych, a nowa tablica z tą samą liczbą zdejmuje blokadę (T-042). Ostrzeżenie, które dostaje fokus przy limicie, renderuje się jednym elementem poza gałęziami stanu ekranu (pusty stan / dane): w osobnej gałęzi nie istnieje w chwili odmowy (fokus spada na `body`), a po odświeżeniu montuje się na nowo bez zmiany `limitReached`, więc `useLimitFocus` już nie przenosi fokusu. Test: 409 przy nieaktualnym ekranie (pusty stan; odświeżenie z tą samą liczbą w nowej tablicy) z `heldResponse()` na odświeżeniu.
- Odpowiedź 401 u zalogowanego (sesja wygasła, wylogowanie w innej karcie) obsługuje jedno miejsce: `RequireSession` (`useEndSessionOnUnauthenticated` słucha cache zapytań i zapisów), a zerwane połączenie na żywo sprawdza sesję (`useCheckSession`). Ekran nie obsługuje 401 sam i nie pokazuje go jako „Nie udało się wczytać…”. Sesję kończy się tylko przez `useSetSession(null)` (`endSession`). `queryClient.clear()` usuwa też zapytanie sesji obserwowane przez `RequireSession`, więc strażnik nie widzi `null` i nie prowadzi na SC-01 (lint: `no-restricted-syntax` na `clear()` klienta poza `session/useSession.ts`). Test końca sesji to test całej aplikacji (`renderApp`), nie samego ekranu (`session/sessionEnded.test.tsx`; E2E: wylogowanie przez `page.request` w J-01; T-018).
- Każde przejście SC-01 ↔ SC-02 (także link w komunikacie błędu) idzie przez `EntryLink` (`invitations/EntryLink.tsx`), który niesie wpisany e-mail (WCAG 3.3.7) i kontekst zaproszenia. Zwykły `<Link to="/logowanie">` gubi oba, a token zaproszenia zniknął już z historii (`replace`), więc zaproszona osoba nie dołącza do listy (przegląd E-01, P1; T-028). Lint: `no-restricted-syntax` na `<Link to="/logowanie">` / `<Link to="/rejestracja">` w `apps/web/src`; wyjątek z uzasadnieniem: „Wróć” na SC-04 (cofa w historii). Test linku klika go i sprawdza stan ekranu docelowego (e-mail, „Info — zaproszenie”), nie sam `href`.
- Rozmiar tekstu idzie za ustawieniem przeglądarki (WCAG 1.4.4): `font-size` tylko z tokenów `--typography-size-*` (w `rem`), nigdy w `px` (`pnpm design-check` odrzuca `font-size` / `font` / `fontSize` w `px`). Przy 200% tekstu przyciski z etykietą rosną razem z tekstem i zabierają miejsce sąsiadom w wierszu: nowy komponent lub ekran sprawdź przy 200% na telefonie 390 px i 320 px (tekst nie ucięty, słowa nie łamane w środku). Przełącznik układu zależny od rozmiaru tekstu robi media query w `em` (liczone od rozmiaru tekstu przeglądarki; np. `AppBar` od `max-width: 24em`). E2E zmienia rozmiar tekstu przez CDP `Page.setFontSizes({ fontSizes: { standard: 32 } })`; `page.addStyleTag` blokuje CSP (`style-src 'self'`) (`e2e/rozmiar-tekstu.spec.ts`; T-016).

## Skille i źródła

- `frontend-design` przy budowie komponentów design systemu.
- `.claude/skills/brd-to-design/references/accessibility.md` — lista kontrolna dostępności.
- Dokumentacja React Router, TanStack Query, Playwright, axe-core.

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-10-30 | T-042: „Pułapki” — odmowa limitu z API tylko przez `useLimitRefusal` (liczba, nie tożsamość danych z cache); ostrzeżenie z fokusem poza gałęziami stanu ekranu. |
| 2026-10-30 | T-039: „Pułapki” — cel fokusu po zapisach równoległych wybierany przy fokusie z listy kandydatów; test fokusu dla dwóch zapisów naraz. |
| 2026-10-30 | T-030: „Pułapki” — checkbox przez `useGuardedMutation` z `lockOf` (bez wyjątku od lintu, zakaz `eslint-disable` dla `no-restricted-imports`); test blokady przy stanie ustawianym przed `mutate`: dwa kliknięcia w jednym `act`. |
| 2026-10-30 | T-028: „Pułapki” — przejścia SC-01 ↔ SC-02 tylko przez `EntryLink` (lint na `<Link to="/logowanie">` / `"/rejestracja"`); test linku sprawdza stan ekranu docelowego. |
| 2026-10-30 | T-029: „Pułapki” — wywołania zwrotne zapisu tylko w opcjach hooka (lint na `mutate(vars, { … })`); dodawanie pozycji przez `useGuardedMutation`. |
| 2026-10-30 | T-031: „Pułapki” — dane E2E przez API: sprawdzone statusy, najwyżej 10 żądań naraz, czekanie na stan ekranu; `addViaApi` w `e2e/lists.ts`. |
| 2026-10-30 | T-025: „Pułapki” — test na żywo wysyła tylko zdarzenia, które wysyła serwer; zmiana bez zdarzenia tylko w MSW. |
| 2026-10-30 | Przegląd E-01 runda 2 (`docs/reviews/E-01-2026-10-30-1.md`): „Pułapki” — lista kontrolna testu fokusu dla `disabled` zależnego od API lub zdarzeń na żywo. |
| 2026-10-30 | T-016: „Pułapki” — rozmiary tekstu tylko z tokenów w `rem` (`design-check` odrzuca `px`), sprawdzenie przy 200% tekstu, media query w `em`, CDP `Page.setFontSizes` w E2E. |
| 2026-10-30 | T-018: „Pułapki” i „Gdzie jest kod” — 401 u zalogowanego i zerwane połączenie na żywo kończą sesję w jednym miejscu (`RequireSession`, `LiveProvider`); zakaz `clear()` klienta (lint). |
| 2026-10-29 | T-021: „Testy w tej warstwie” — `heldResponse()` zamiast `delay(ms)`, `fillIn` dla pól wejścia, `warmUp()` w setupie; domyślny `asyncUtilTimeout`; lint na `delay(ms)`. |
| 2026-10-29 | T-020: „Pułapki” i „Gdzie jest kod” — `useGuardedMutation` jako wspólna blokada podwójnego wysłania (wymusza lint `no-restricted-imports`); wyjątki; test, który przechodzi bez blokady. |
| 2026-10-30 | T-023: „Pułapki” — `disabled` na elemencie z fokusem wymaga przeniesienia fokusu; atrapa utraty fokusu w `test/setup.ts`. |
| 2026-10-30 | T-022: „Pułapki” — fokus ekranów bez AppBar (SC-04 `useEntryFocus`); kontrola fokusu dla każdej trasy w `routeFocus.test.tsx`. |
| 2026-10-29 | T-015: „Pułapki” — `aria-disabled` robi `Button`; jsdom nie zdejmuje fokusu z `disabled`, fokus w stanie zapisu sprawdza E2E. |
| 2026-10-29 | T-014: „Pułapki” — fokus po zmianie trasy robi `AppBar`; obwódka `focus.ring-on-brand` na pasku marki; test przejścia między ekranami. |
| 2026-10-29 | Przegląd E-01 (`docs/reviews/E-01-2026-10-29-1.md`): „Pułapki” — synchroniczna blokada podwójnego wysłania, fokus po zmianie trasy, `aria-disabled` zamiast `disabled` w stanie zapisu. |
| 2026-10-28 | T-008: „Gdzie jest kod” (SC-07, SC-08, `invitations/`, Toast, InviteLinkBox, `api/invitations.ts`, `renderApp` z historią). |
| 2026-10-28 | T-007: „Gdzie jest kod” (odhaczanie, „Kupione”, usuń kupione; ItemRow z checkboxem; `e2e/lists.ts`). |
| 2026-10-28 | QA T-006 (krok 10): „Pułapki” — testy hooków zapisu z opóźnioną i zerwaną odpowiedzią oraz zmianą danych w międzyczasie. |
| 2026-10-28 | T-006: „Gdzie jest kod” (SC-06 z pozycjami, AddBar, ItemRow, warianty Button / TextField / InlineAlert, `api/items.ts`, `anItem`); „Pułapki”: druga strona w E2E na Windows, AddBar po przeładowaniu. |
| 2026-10-28 | T-005: „Gdzie jest kod” (SC-05, SC-06, `src/lists/`, `queryClient.ts`, nowe komponenty, helpery testów). |
| 2026-10-27 | T-004: „Gdzie jest kod” (router, sesja, komponenty, helpery testów, fixtures E2E). |
| 2026-10-27 | T-002: „Pułapki” — równoległość E2E na Linuksie w CI. |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
