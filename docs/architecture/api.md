---
status: approved          # draft | approved
approved: 2026-10-26
---

# Zarys API

Zarys dla głównych ścieżek; taski doprecyzowują kształty. Kontrakt (typy żądań, odpowiedzi i zdarzeń + schematy zod) żyje w `packages/shared/src/api/` i jest importowany przez api, web i mobile. Konwencje i kody błędów: `architecture.md`, „Konwencje API i błędów”. Wszystkie trasy `/api/v1/*` wymagają sesji (401), chyba że zaznaczono inaczej.

## Konta (Better Auth, `/api/auth/*`)

Nazwy tras Better Auth sprawdzić w dokumentacji wersji użytej w walking skeleton.

| Operacja | Trasa | Żądanie | Odpowiedź | Błędy |
| --- | --- | --- | --- | --- |
| Rejestracja (F-01) | `POST /api/auth/sign-up/email` | `{ name, email, password, termsAccepted: true, ageConfirmed: true, invitationToken? }` | 200 `{ user }` + sesja | 400 `validation_failed`, 409 `email_taken`, 429 |
| Logowanie (F-02) | `POST /api/auth/sign-in/email` | `{ email, password }` | 200 `{ user }` + sesja | 401 `invalid_credentials` (ten sam dla złego e-maila i hasła), 429 |
| Wylogowanie (F-02) | `POST /api/auth/sign-out` | — | 200 | — |
| Prośba o reset (F-03) | `POST /api/auth/request-password-reset` (publiczna) | `{ email, redirectTo }` | 200 zawsze | 429 |
| Nowe hasło (F-03) | `POST /api/auth/reset-password` (publiczna) | `{ token, newPassword }` | 200 | 400 `invalid_token` (użyty lub wygasły), 400 `validation_failed` |

Zgody i 16+ są weryfikowane w hooku rejestracji Better Auth (brak = 400) i zapisywane w `user`.

Stan po T-004: API udostępnia z Better Auth tylko trasy z tabeli, które już mają klienta (rejestracja, logowanie, wylogowanie); pozostałe ścieżki `/api/auth/*` zwracają 404. Most w `modules/konta/http/auth-routes.ts` waliduje treść schematami z `packages/shared` (400 przed Better Auth), zwraca `{ user: { id, name, email } }` bez tokenu sesji w treści (TH-16) i tłumaczy błędy Better Auth na kody API. Obcy `Origin` = 403 `invalid_origin` (TH-14). Limity (`RATE_LIMITS` w `packages/shared`): logowanie 10/min per IP i 5 nieudanych w 15 min per konto (429 także dla poprawnego hasła), rejestracja 5/h per IP, `GET /health/ready` 30/min per IP.

## Konto (`konta`)

| Operacja | Trasa | Żądanie | Odpowiedź | Błędy |
| --- | --- | --- | --- | --- |
| Moje dane | `GET /api/v1/me` | — | `{ id, name, email }` | 401 |
| Zmiana imienia (F-16) | `PATCH /api/v1/me` | `{ name }` | 200 `{ id, name, email }` | 400 |
| Usunięcie konta (F-04) | `DELETE /api/v1/me` | `{ confirm: true }` | 204; zdarzenia `list.deleted` / `access.revoked` / `lists.changed` do dotkniętych osób; sesje zamknięte | 400 bez `confirm` |

## Listy (`listy`)

| Operacja | Trasa | Żądanie | Odpowiedź | Błędy |
| --- | --- | --- | --- | --- |
| Moje listy (F-06) | `GET /api/v1/lists` | — | `[{ id, name, role: "owner" \| "participant", owner: { id, name }, toBuyCount, members: [{ id, name }], updatedAt }]` (od ostatnio zmienionej) | — |
| Utwórz (F-05) | `POST /api/v1/lists` | `{ name }` | 201 lista | 400, 409 `limit_reached` (`lists`) |
| Szczegóły z pozycjami | `GET /api/v1/lists/:listId` | — | `{ id, name, role, owner, members: [{ id, name }], items: [Item] }` (`members` — liczba uczestników w oknie usunięcia, SC-06) | 404 |
| Zmień nazwę (F-05) | `PATCH /api/v1/lists/:listId` | `{ name }` | 200 lista | 400, 403 `owner_only`, 404 |
| Usuń (F-05) | `DELETE /api/v1/lists/:listId` | — | 204 | 403 `owner_only`, 404 |
| Uczestnicy (F-13) | `GET /api/v1/lists/:listId/members` | — | `{ owner: Person, participants: [Person] }`; `Person = { id, name, email? }` — `email` tylko gdy pyta właściciel | 404 |
| Usuń uczestnika (F-13) | `DELETE /api/v1/lists/:listId/members/:userId` | — | 204; `access.revoked` do usuniętego | 403 `owner_only`, 404 |
| Opuść listę (F-13) | `POST /api/v1/lists/:listId/leave` | — | 204 | 403 `owner_cannot_leave`, 404 |

Stan po T-005: trasy listy (bez uczestników F-13) działają; typy `ListSummary`, `ListDetails`, `Person` i schemat `listNameRequestSchema` w `packages/shared/src/api/lists.ts`. Odpowiedź utworzenia i zmiany nazwy to `ListSummary` (kształt elementu `GET /api/v1/lists`). `members` to uczestnicy bez właściciela, w kolejności dołączenia; `toBuyCount` = 0 do czasu pozycji (T-006). Niepoprawny `listId` (nie UUID) daje ten sam 404 `not_found`. Żądania `POST` / `PATCH` / `DELETE` pod `/api/v1/*` z `Origin` innym niż `APP_ORIGIN` (także bez `Origin`) dostają 403 `invalid_origin` (TH-14, `http/trusted-origin.ts`). Odmowy dostępu (`list_access_denied`) i limit (`limit_reached`) trafiają do logu `security` z identyfikatorami.

## Pozycje (`pozycje`)

`Item = { id, name, note: string | null, addedBy: { id, name } | null, checked: boolean, checkedBy: { id, name } | null, checkedAt, createdAt, updatedAt }`; `null` przy autorze = „usunięty użytkownik” (F-10).

| Operacja | Trasa | Żądanie | Odpowiedź | Błędy |
| --- | --- | --- | --- | --- |
| Dodaj (F-07, F-09) | `POST /api/v1/lists/:listId/items` | `{ id?: uuid, name, note? }` | 201 Item; 200 Item gdy pozycja o tym `id` już istnieje | 400, 404, 409 `duplicate_item`, 409 `limit_reached` (`items`) |
| Edytuj (F-07, F-09) | `PATCH /api/v1/lists/:listId/items/:itemId` | `{ name?, note? }` | 200 Item | 400, 404 (także usunięta w międzyczasie), 409 `duplicate_item` |
| Odhacz / odznacz (F-08) | `PATCH /api/v1/lists/:listId/items/:itemId` | `{ checked: boolean }` | 200 Item | 404 |
| Usuń (F-07) | `DELETE /api/v1/lists/:listId/items/:itemId` | — | 204 | 404 |
| Usuń odhaczone (F-08) | `POST /api/v1/lists/:listId/items/clear-checked` | — | 200 `{ deletedIds: [uuid] }` | 404 |

Stan po T-006: dodawanie, edycja nazwy i notatki oraz usuwanie działają (odhaczanie i „usuń odhaczone” — T-007); typ `Item`, schematy `createItemRequestSchema` / `updateItemRequestSchema` i `normalizeItemName` w `packages/shared/src/api/items.ts`. Pusta notatka (także `""` w `PATCH`) = `null`. `PATCH` zmienia tylko podane pola; web wysyła tylko zmienione. `id` klienta należące do pozycji innej listy daje 404 `not_found` (nie zdradza jej istnienia). Niepoprawny `itemId` (nie UUID) = 404. Limit sprawdzany przed duplikatem: przy 500 pozycjach odpowiedź to `limit_reached`. Każda zmiana pozycji przesuwa listę na początek `GET /api/v1/lists` (`updated_at`). `GET /api/v1/lists/:listId` zwraca `items` od najnowszej. Przekroczenie limitu 500 trafia do logu `security` (`userId`, `listId`).

## Zaproszenia (`zaproszenia`)

| Operacja | Trasa | Żądanie | Odpowiedź | Błędy |
| --- | --- | --- | --- | --- |
| Aktywne linki (F-11) | `GET /api/v1/lists/:listId/invitations` | — | `[{ id, url, expiresAt }]` (nieużyte, nieunieważnione, niewygasłe) | 403 `owner_only`, 404 |
| Utwórz link (F-11) | `POST /api/v1/lists/:listId/invitations` | — | 201 `{ id, url, expiresAt }` | 403, 404, 409 `limit_reached` (`participants`), 429 |
| Unieważnij (F-11) | `DELETE /api/v1/lists/:listId/invitations/:invitationId` | — | 204 | 403, 404 |
| Podgląd (SC-08), publiczna | `GET /api/v1/invitations/:token` | — | `{ listName, ownerName }` | 410 `invitation_invalid`, 429 |
| Przyjmij (F-12) | `POST /api/v1/invitations/:token/accept` | — | 200 `{ listId }` | 401, 409 `own_list` / `already_member` / `limit_reached` (`participants`), 410, 429 |

`url` = `https://<web>/zaproszenie/<token>`. Rejestracja z `invitationToken` (F-01, F-12) przyjmuje zaproszenie w tej samej operacji po założeniu konta; błąd zaproszenia nie blokuje rejestracji (konto powstaje, klient pokazuje komunikat z SC-08).

## Zmiany na żywo (`na-zywo`)

`GET /api/v1/live` → upgrade do WebSocket (sesja jak przy HTTP; web: sprawdzenie `Origin`). Wiadomości JSON `{ type, ... }`, typy w `packages/shared/src/api/live.ts`.

| Kierunek | `type` | Pola | Kiedy |
| --- | --- | --- | --- |
| klient → serwer | `subscribe` / `unsubscribe` | `listId` | wejście / wyjście z SC-06, SC-07 |
| serwer → klient | `subscribed` | `listId` | dostęp potwierdzony |
| serwer → klient | `error` | `code: "not_found"`, `listId` | brak dostępu |
| serwer → klient | `item.upserted` | `listId`, `item: Item` | dodanie, edycja, odhaczenie |
| serwer → klient | `item.deleted` | `listId`, `itemId` | usunięcie pozycji |
| serwer → klient | `items.cleared` | `listId`, `itemIds` | usuń odhaczone |
| serwer → klient | `list.updated` | `listId`, `name` | zmiana nazwy |
| serwer → klient | `list.deleted` | `listId` | usunięcie listy |
| serwer → klient | `members.changed` | `listId` | dołączenie, usunięcie, opuszczenie (klient pobiera uczestników) |
| serwer → klient | `invitations.changed` | `listId` | tylko do właściciela: link użyty lub unieważniony |
| serwer → klient | `access.revoked` | `listId` | utrata dostępu (MC-03) |
| serwer → klient | `lists.changed` | — | kanał użytkownika: odśwież SC-05 |
| serwer ↔ klient | ping / pong | — | co 25 s |

Zdarzenia trafiają do wszystkich subskrybentów listy, także autora zmiany; klient ignoruje zdarzenie pozycji, której `updatedAt` nie jest nowsze niż stan, który już ma.
