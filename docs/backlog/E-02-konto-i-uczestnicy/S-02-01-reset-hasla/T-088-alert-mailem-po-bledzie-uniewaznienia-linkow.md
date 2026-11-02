---
id: T-088
title: Alert mailem do właściciela, gdy reset nie unieważni pozostałych linków
epic: E-02
story: S-02-01
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-087]
size: S                # S | M (L must be split)
layers: [backend, infra]
requirements: [F-03, N-03, N-02]
threats: [TH-10, TH-21]
screens: []
---

# T-088 Alert mailem do właściciela, gdy reset nie unieważni pozostałych linków

## Goal

Gdy po udanej zmianie hasła nie uda się unieważnić pozostałych linków resetu konta (zdarzenie `reset_tokens_revoke_failed`, T-087), API wysyła mail do właściciela projektu. Właściciel dowiaduje się o oknie ryzyka (linki działają do 1 h, F-03, TH-10) bez czytania logów Fly. Seria takich błędów (np. awaria bazy) daje najwyżej jeden mail na okno czasowe, więc nie wyczerpuje limitu Brevo (300/dzień) potrzebnego na maile resetu.

## Demo

1. Lokalnie (`pnpm dev`, Mailpit) wywołaj błąd unieważnienia tak jak test T-087 (pula odrzucająca `DELETE FROM verification …`) i ustaw nowe hasło z linku.
2. Klient dostaje 200 jak dotąd. W Mailpicie jest mail na `ALERT_EMAIL` z tematem „Alarm: linki resetu hasła nie zostały unieważnione” i treścią z `userId`, czasem zdarzenia i godziną, do której pozostałe linki mogą działać. Mail nie zawiera e-maila konta ani tokenów.
3. Drugi taki błąd w ciągu okna nie daje nowego maila. Pierwszy mail po oknie podaje, ile zdarzeń pominięto.

## Context

- BRD: F-03 — „link jednorazowy, ważny 1 godzinę”; N-03 — „Alarm o awarii mailem do właściciela projektu”; N-02 — bez zewnętrznej analityki i śledzenia (dlatego mail z API, a nie zewnętrzne narzędzie do logów; decyzja właściciela 2026-11-02, `/plan-backlog`).
- Architektura: `architecture.md` „Obserwowalność”; `pipeline.md` „Monitoring i alarmy”; `deployment.md` (Brevo 300/dzień, sekrety Fly); ADR 0003 (jedna instancja API, więc licznik okna może być w pamięci).
- Depends on: T-087 — miejsce, w którym błąd `revokeAll` jest łapany i logowany (`revokeOtherLinks` w `newPasswordRoute`).
- Istniejący kod: `apps/api/src/modules/konta/http/auth-routes.ts` (`revokeOtherLinks`), `apps/api/src/modules/konta/domain/mailer.ts` (`Mailer`, błędy dostawcy), `apps/api/src/config.ts` (`MAILER`, `REQUIRED_FOR_MAILER`), test `apps/api/test/password-reset.revoke-failure.test.ts` i `test/failing-pool.ts`.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given ustawiony adres alarmu i błąd unieważnienia linków po udanej zmianie hasła, when trasa kończy reset, then mailer dostaje jeden mail na adres alarmu z tematem „Alarm: linki resetu hasła nie zostały unieważnione”, `userId`, czasem zdarzenia i godziną, do której pozostałe linki mogą działać (zdarzenie + 1 h). — verified by: test integracyjny (mailer przechwytujący)
- [ ] AC2: Given kolejne błędy unieważnienia w oknie 15 minut od wysłanego alarmu, when występują, then nie wychodzi nowy mail. Pierwszy błąd po oknie wysyła mail z liczbą pominiętych zdarzeń. — verified by: test integracyjny ze sterowanym zegarem (`clock.ts`)
- [ ] AC3: Given mailer odrzuca wysyłkę alarmu (błąd dostawcy albo timeout), when trasa kończy reset, then klient dalej dostaje 200, a `password_reset` w `security` i zamknięcie połączeń na żywo działają jak w T-087. Błąd wysyłki trafia do logu jako `owner_alert_failed` (nazwa zdarzenia alarmu i status, bez adresu). — verified by: test integracyjny
- [ ] AC4: Given wysyłka alarmu trwa (mailer odpowiada z opóźnieniem), when klient czeka na odpowiedź resetu, then odpowiedź nie czeka na mail. — verified by: test integracyjny z mailerem wstrzymanym do zwolnienia
- [ ] AC5: Given `MAILER=brevo` bez `ALERT_EMAIL`, when API startuje, then start kończy się czytelnym błędem konfiguracji. Given `MAILER=mailpit` bez `ALERT_EMAIL`, then start działa, a alarm jest tylko w logu. — verified by: `config.test.ts`
- [ ] AC6: Given udany reset bez błędu unieważnienia, then nie wychodzi żaden alarm. — verified by: test integracyjny
- [ ] AC7: Given staging, then sekret `ALERT_EMAIL` jest ustawiony w Fly (`fly secrets list` pokazuje nazwę, bez wartości) przed merge E-02 na `main`. `deployment.md` (tabela zmiennych) i `.env.example` opisują zmienną. — verified by: ręczna kontrola (właściciel uruchamia `fly secrets set`), wpis w Evidence
- [ ] SEC1 (TH-21): Given alarm, when mail powstaje, then treść i temat nie zawierają e-maila konta, tokenów, haseł ani komunikatu błędu bazy (tylko `errorSummary`-owy kod, np. `57P01`), a log `owner_alert_failed` nie zawiera adresu alarmu. — verified by: test integracyjny (szuka e-maila konta, obu tokenów i `ALERT_EMAIL` w mailu i w całym logu)
- [ ] SEC2 (TH-10): Given osoba spoza projektu, when wywołuje dowolną trasę `/api/*`, then nie może wywołać wysyłki alarmu ani zmienić adresu alarmu. Alarm uruchamia wyłącznie błąd po stronie serwera po udanym resecie. — verified by: test integracyjny, że nieudany reset (zły lub zużyty token) nie wysyła alarmu, oraz przegląd tras w QA

## TDD plan

**Test seams:**

- HTTP `POST /api/auth/reset-password` przez `buildTestApp` z mailerem przechwytującym (`test/reset-token.ts`) i pulą odrzucającą unieważnienie (`test/failing-pool.ts`, T-087), bez `vi.mock`.
- Zegar przez istniejący `clock.ts` (granica systemu).
- `loadConfig` w `config.test.ts`.

**Tests in order:**

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Błąd unieważnienia → jeden mail na adres alarmu z `userId`, czasem i godziną wygaśnięcia linków | integration | Vitest + Testcontainers | AC1 |
| 2 | Udany reset bez błędu i nieudany reset (zły token) → brak alarmu | integration | Vitest + Testcontainers | AC6, SEC2 |
| 3 | Mail i cały log bez e-maila konta, tokenów, `ALERT_EMAIL` i treści błędu bazy | integration | Vitest + Testcontainers | SEC1 |
| 4 | Drugi błąd w oknie → bez maila; po 15 min (zegar) → mail z liczbą pominiętych | integration | Vitest + Testcontainers | AC2 |
| 5 | Mailer odrzuca / nie odpowiada → 200, `password_reset`, WS zamknięte, `owner_alert_failed` w logu | integration | Vitest + Testcontainers | AC3 |
| 6 | Mailer wstrzymany → odpowiedź resetu przychodzi przed zwolnieniem mailera | integration | Vitest + Testcontainers | AC4 |
| 7 | `MAILER=brevo` bez `ALERT_EMAIL` → błąd startu; `mailpit` bez niego → start działa | unit | Vitest | AC5 |

**Run:** `pnpm vitest run --project api password-reset config`

**Mocks:** tylko granice: mailer (adapter przechwytujący), zegar, pula bazy odrzucająca jedno zapytanie. Asynchroniczną wysyłkę sprawdzać czekaniem na warunek, bez stałej pauzy (T-082).

## QA plan

- **Edge cases:** seria błędów z wielu kont w jednym oknie (jeden mail, licznik pominiętych obejmuje wszystkie konta); błąd unieważnienia przy równoczesnym drugim resecie tego samego konta (kolejka `ResetTokens.exclusive` się nie blokuje, T-087); restart API zeruje okno (akceptowane: jedna instancja, ADR 0003; zapisz to w notatkach architektury).
- **Design states:** brak ekranu; SC-03 bez zmian (200 i komunikat sukcesu).
- **Platforms:** API lokalnie z Mailpitem; staging tylko konfiguracja (sekret i start aplikacji, weryfikacja maili po merge w T-069).
- **Accessibility:** nie dotyczy (mail tekstowy do właściciela).
- **Security / privacy:** TH-21: przejrzyj mail w Mailpicie i log pod kątem danych osobowych i sekretów. TH-10: spróbuj wywołać alarm z zewnątrz (zły token, zużyty token, brak tokenu, zalew `request-password-reset`). Żadna z tych prób nie może dać maila. Sprawdź, czy wysyłka alarmów nie wpływa na limit maili resetu (najwyżej jeden alarm na 15 min).
- **Regression:** T-087 (`password-reset.revoke-failure.test.ts`), T-075 (`other reset links of the account`), T-054 (`live.password-reset.test.ts`, `password-reset.logs.test.ts`), T-053 / T-055 (mail resetu dalej wychodzi, błąd Brevo nie zmienia odpowiedzi `request-password-reset`).

## Implementation notes

- Mechanizm alarmu nazwij ogólnie (np. alarm do właściciela z nazwą zdarzenia, treścią i oknem tłumienia). E-03 (S-03-02, monitoring) może go użyć dla innych zdarzeń. W tym tasku podłączamy tylko `reset_tokens_revoke_failed`; inne zdarzenia są poza zakresem.
- Wysyłka nie może opóźnić ani zmienić odpowiedzi resetu i nie może odrzucić kolejki `ResetTokens.exclusive` (pułapka „krok mostu po zatwierdzeniu w Better Auth” w `backend.md`).
- Okno tłumienia trzymaj w pamięci procesu (jedna instancja, ADR 0003). Długość okna (15 min) to stała przypięta testem, jak inne limity (T-044).
- Zaktualizuj komentarz w `mailer.ts` („aplikacja wysyła tylko mail resetu”), `architecture.md` „Obserwowalność” (alarm mailowy z API dla wybranych zdarzeń `error`), `pipeline.md` „Monitoring i alarmy” oraz `deployment.md` (zmienna `ALERT_EMAIL`, sekret Fly per aplikacja). Mail alarmu idzie tym samym dostawcą co reset (Brevo), więc nie przybywa nowy podmiot (N-02).
- `ALERT_EMAIL` na staging ustawia właściciel (`fly secrets set ALERT_EMAIL=… -a lista-staging`). Bez tego wdrożenie staging po merge nie wystartuje (AC5). Implementujący przygotowuje komendę i prosi właściciela o jej uruchomienie.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
